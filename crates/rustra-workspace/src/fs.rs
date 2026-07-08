//! Path-jailed filesystem operations for a per-user [`Workspace`].
//!
//! A workspace is a rooted directory tree. Every operation takes a
//! *workspace-relative* path and goes through [`Workspace::resolve`], which
//! rejects absolute paths and `..` components and verifies (after resolving
//! symlinks on the nearest existing ancestor, where a symlink counts as
//! existing even when its target does not, so a dangling link is never
//! skipped over) that the target stays under the workspace root. Nothing
//! outside the root is ever readable or writable through a `Workspace`.

use serde::{Deserialize, Serialize};
use std::path::{Component, Path, PathBuf};
use tokio::io::AsyncWriteExt;

use rustra_core::{Error, Result};

/// Subdirectory holding the user's working files (also the shell cwd).
pub const FILES_DIR: &str = "files";
/// Subdirectory where user-authored skills live.
pub const SKILLS_DIR: &str = "skills";
/// Subdirectory where user-authored knowledge documents live.
pub const KNOWLEDGE_DIR: &str = "knowledge";
/// Subdirectory where user-authored agent definitions live.
pub const AGENTS_DIR: &str = "agents";
/// Subdirectory where user-authored flow definitions live.
pub const FLOWS_DIR: &str = "flows";

/// The standard subdirectories created in every workspace.
pub const STANDARD_SUBDIRS: [&str; 5] =
    [FILES_DIR, SKILLS_DIR, KNOWLEDGE_DIR, AGENTS_DIR, FLOWS_DIR];

/// Largest file `grep` will scan, in bytes.
const GREP_MAX_FILE_BYTES: u64 = 1024 * 1024;
/// How many leading bytes are sniffed for NUL when deciding text vs binary.
const BINARY_SNIFF_BYTES: usize = 8 * 1024;

/// One entry returned by [`Workspace::list_dir`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DirEntryInfo {
    /// File or directory name (not a path).
    pub name: String,
    /// True for directories; false for files and symlinks.
    pub is_dir: bool,
    /// File size in bytes; `0` for directories.
    pub size: u64,
}

/// One match returned by [`Workspace::grep`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GrepMatch {
    /// Workspace-relative path of the matching file.
    pub path: String,
    /// 1-based line number.
    pub line: u32,
    /// The matching line, trailing whitespace trimmed.
    pub text: String,
}

/// A rooted, per-user directory supporting jailed file operations, shell
/// execution ([`Workspace::exec`]) and LSP-backed diagnostics.
///
/// Construct through [`crate::WorkspaceManager::workspace_for_user`] in
/// production (which also persists a `WorkspaceRecord`), or directly with
/// [`Workspace::open`] when metadata persistence is not needed.
#[derive(Debug, Clone)]
pub struct Workspace {
    user_id: String,
    /// Canonicalized workspace root.
    root: PathBuf,
}

impl Workspace {
    /// Open (creating if necessary) a workspace rooted at `root` for
    /// `user_id`. Creates the root and the [`STANDARD_SUBDIRS`], then
    /// canonicalizes the root so later containment checks are exact.
    pub async fn open(user_id: impl Into<String>, root: impl Into<PathBuf>) -> Result<Self> {
        let user_id = user_id.into();
        let root: PathBuf = root.into();
        tokio::fs::create_dir_all(&root).await?;
        for sub in STANDARD_SUBDIRS {
            tokio::fs::create_dir_all(root.join(sub)).await?;
        }
        let root = tokio::fs::canonicalize(&root).await?;
        Ok(Self { user_id, root })
    }

    /// The user this workspace belongs to.
    pub fn user_id(&self) -> &str {
        &self.user_id
    }

    /// Deny unless `caller_user_id` owns this workspace.
    pub fn check_owner(&self, caller_user_id: &str) -> Result<()> {
        if caller_user_id == self.user_id {
            Ok(())
        } else {
            Err(Error::PermissionDenied(format!(
                "workspace belongs to `{}` but the caller is `{caller_user_id}`",
                self.user_id
            )))
        }
    }

    /// The canonical workspace root directory.
    pub fn root(&self) -> &Path {
        &self.root
    }

    /// `<root>/files` — the user's working files and the shell cwd.
    pub fn files_dir(&self) -> PathBuf {
        self.root.join(FILES_DIR)
    }

    /// `<root>/skills` — authoring location for skills.
    pub fn skills_dir(&self) -> PathBuf {
        self.root.join(SKILLS_DIR)
    }

    /// `<root>/knowledge` — authoring location for knowledge documents.
    pub fn knowledge_dir(&self) -> PathBuf {
        self.root.join(KNOWLEDGE_DIR)
    }

    /// `<root>/agents` — authoring location for agent definitions.
    pub fn agents_dir(&self) -> PathBuf {
        self.root.join(AGENTS_DIR)
    }

    /// `<root>/flows` — authoring location for flow definitions.
    pub fn flows_dir(&self) -> PathBuf {
        self.root.join(FLOWS_DIR)
    }

    /// Resolve a workspace-relative path to an absolute one, enforcing the
    /// jail:
    ///
    /// * absolute paths are rejected,
    /// * `..` (and any non-normal) components are rejected,
    /// * the canonicalized nearest existing ancestor of the joined path must
    ///   still be under the workspace root (defends against symlinks placed
    ///   inside the workspace pointing outside it; a symlink counts as
    ///   existing even when its target does not, so a dangling link is never
    ///   skipped over).
    pub fn resolve(&self, rel: &str) -> Result<PathBuf> {
        let path = Path::new(rel);
        if path.is_absolute() {
            return Err(Error::PermissionDenied(format!(
                "absolute paths are not allowed in a workspace: `{rel}`"
            )));
        }
        for component in path.components() {
            match component {
                Component::Normal(_) | Component::CurDir => {}
                _ => {
                    return Err(Error::PermissionDenied(format!(
                        "path escapes the workspace: `{rel}`"
                    )))
                }
            }
        }
        let joined = self.root.join(path);

        // Canonicalize the nearest existing ancestor (the file itself may not
        // exist yet, e.g. for writes) and verify containment.
        let mut ancestor: &Path = &joined;
        while ancestor.symlink_metadata().is_err() {
            ancestor = ancestor.parent().ok_or_else(|| {
                Error::PermissionDenied(format!("path escapes the workspace: `{rel}`"))
            })?;
        }
        let canonical = ancestor.canonicalize()?;
        if !canonical.starts_with(&self.root) {
            return Err(Error::PermissionDenied(format!(
                "path escapes the workspace: `{rel}`"
            )));
        }
        Ok(joined)
    }

    /// Read a UTF-8 text file.
    pub async fn read_file(&self, rel: &str) -> Result<String> {
        let path = self.resolve(rel)?;
        Ok(tokio::fs::read_to_string(&path).await?)
    }

    /// Write (create or overwrite) a file, creating parent directories.
    pub async fn write_file(&self, rel: &str, contents: &str) -> Result<()> {
        let path = self.resolve(rel)?;
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        tokio::fs::write(&path, contents).await?;
        Ok(())
    }

    /// Append to a file, creating it (and parent directories) if missing.
    pub async fn append_file(&self, rel: &str, contents: &str) -> Result<()> {
        let path = self.resolve(rel)?;
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        let mut file = tokio::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .await?;
        file.write_all(contents.as_bytes()).await?;
        file.flush().await?;
        Ok(())
    }

    /// Delete a file.
    pub async fn delete_file(&self, rel: &str) -> Result<()> {
        let path = self.resolve(rel)?;
        tokio::fs::remove_file(&path).await?;
        Ok(())
    }

    /// Move/rename a file within the workspace, creating destination parent
    /// directories.
    pub async fn move_file(&self, from: &str, to: &str) -> Result<()> {
        let from = self.resolve(from)?;
        let to = self.resolve(to)?;
        if let Some(parent) = to.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        tokio::fs::rename(&from, &to).await?;
        Ok(())
    }

    /// List the immediate entries of a directory (`""` lists the root),
    /// sorted by name.
    pub async fn list_dir(&self, rel: &str) -> Result<Vec<DirEntryInfo>> {
        let path = self.resolve(rel)?;
        let mut read_dir = tokio::fs::read_dir(&path).await?;
        let mut entries = Vec::new();
        while let Some(entry) = read_dir.next_entry().await? {
            let metadata = entry.metadata().await?;
            entries.push(DirEntryInfo {
                name: entry.file_name().to_string_lossy().into_owned(),
                is_dir: metadata.is_dir(),
                size: if metadata.is_file() {
                    metadata.len()
                } else {
                    0
                },
            });
        }
        entries.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(entries)
    }

    /// Recursively list regular files under `rel` (`""` for the whole
    /// workspace) as `(relative path, size)` pairs, sorted by path. Symlinks
    /// are skipped.
    pub async fn walk_files(&self, rel: &str) -> Result<Vec<(String, u64)>> {
        let base = self.resolve(rel)?;
        if tokio::fs::metadata(&base).await.is_err() {
            return Ok(Vec::new());
        }
        let files = tokio::task::spawn_blocking(move || walk_files_sync(&base))
            .await
            .map_err(|e| Error::Other(format!("walk_files task failed: {e}")))??;
        Ok(files)
    }

    /// Find files whose workspace-relative path matches `pattern`, either as
    /// a case-insensitive substring or as a glob (e.g. `files/**/*.md`).
    pub async fn search_files(&self, pattern: &str) -> Result<Vec<String>> {
        let files = self.walk_files("").await?;
        let glob_pattern = glob::Pattern::new(pattern).ok();
        let needle = pattern.to_lowercase();
        Ok(files
            .into_iter()
            .map(|(path, _)| path)
            .filter(|path| {
                path.to_lowercase().contains(&needle)
                    || glob_pattern.as_ref().is_some_and(|g| g.matches(path))
            })
            .collect())
    }

    /// Substring-search text files under the workspace root, returning up to
    /// `max_results` matches. Files over 1 MiB and binary files (NUL byte in
    /// the first 8 KiB) are skipped.
    pub async fn grep(&self, query: &str, max_results: usize) -> Result<Vec<GrepMatch>> {
        let root = self.root.clone();
        let query = query.to_string();
        tokio::task::spawn_blocking(move || grep_sync(&root, &query, max_results))
            .await
            .map_err(|e| Error::Other(format!("grep task failed: {e}")))?
    }
}

/// Blocking recursive file walk; `base` must exist.
fn walk_files_sync(base: &Path) -> Result<Vec<(String, u64)>> {
    let mut files = Vec::new();
    let mut stack = vec![base.to_path_buf()];
    while let Some(dir) = stack.pop() {
        for entry in std::fs::read_dir(&dir)? {
            let entry = entry?;
            let file_type = entry.file_type()?;
            let path = entry.path();
            if file_type.is_dir() {
                stack.push(path);
            } else if file_type.is_file() {
                let rel = path
                    .strip_prefix(base)
                    .map(|p| p.to_string_lossy().into_owned())
                    .unwrap_or_else(|_| path.to_string_lossy().into_owned());
                files.push((rel, entry.metadata()?.len()));
            }
            // Symlinks are intentionally skipped: following them could leave
            // the jail.
        }
    }
    files.sort();
    Ok(files)
}

/// Blocking substring grep over text files under `root`.
fn grep_sync(root: &Path, query: &str, max_results: usize) -> Result<Vec<GrepMatch>> {
    let mut matches = Vec::new();
    if max_results == 0 {
        return Ok(matches);
    }
    for (rel, size) in walk_files_sync(root)? {
        if size > GREP_MAX_FILE_BYTES {
            continue;
        }
        let bytes = match std::fs::read(root.join(&rel)) {
            Ok(bytes) => bytes,
            // Files can disappear or be unreadable mid-walk; skip them.
            Err(_) => continue,
        };
        let sniff_len = bytes.len().min(BINARY_SNIFF_BYTES);
        if bytes[..sniff_len].contains(&0) {
            continue;
        }
        let text = String::from_utf8_lossy(&bytes);
        for (index, line) in text.lines().enumerate() {
            if line.contains(query) {
                matches.push(GrepMatch {
                    path: rel.clone(),
                    line: (index + 1) as u32,
                    text: line.trim_end().to_string(),
                });
                if matches.len() >= max_results {
                    return Ok(matches);
                }
            }
        }
    }
    Ok(matches)
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn workspace() -> (tempfile::TempDir, Workspace) {
        let dir = tempfile::tempdir().unwrap();
        let ws = Workspace::open("u1", dir.path().join("u1")).await.unwrap();
        (dir, ws)
    }

    #[tokio::test]
    async fn resolve_allows_nested_relative_paths() {
        let (_dir, ws) = workspace().await;
        ws.write_file("a/b.txt", "hello").await.unwrap();
        assert_eq!(ws.read_file("a/b.txt").await.unwrap(), "hello");
        assert!(ws.resolve("files/./ok.txt").is_ok());
    }

    #[tokio::test]
    async fn resolve_rejects_escapes() {
        let (_dir, ws) = workspace().await;
        for bad in [
            "../escape",
            "/etc/passwd",
            "a/../../x",
            "..",
            "files/../../y",
        ] {
            let err = ws.resolve(bad).unwrap_err();
            assert!(
                matches!(err, Error::PermissionDenied(_)),
                "`{bad}` should be rejected, got: {err}"
            );
        }
    }

    #[tokio::test]
    async fn resolve_rejects_symlink_escape() {
        let (dir, ws) = workspace().await;
        let outside = dir.path().join("outside");
        std::fs::create_dir_all(&outside).unwrap();
        std::os::unix::fs::symlink(&outside, ws.root().join("sneaky")).unwrap();
        let err = ws.resolve("sneaky/secret.txt").unwrap_err();
        assert!(matches!(err, Error::PermissionDenied(_)));
    }

    #[tokio::test]
    async fn resolve_rejects_dangling_symlink_escape() {
        let (dir, ws) = workspace().await;
        let target = dir.path().join("outside-target.txt");
        std::os::unix::fs::symlink(&target, ws.root().join("files/sneaky.txt")).unwrap();
        assert!(ws.write_file("files/sneaky.txt", "boom").await.is_err());
        assert!(
            !target.exists(),
            "write must not pass through the dangling symlink"
        );
    }

    #[tokio::test]
    async fn file_ops_roundtrip() {
        let (_dir, ws) = workspace().await;
        ws.write_file("files/notes.txt", "line one\n")
            .await
            .unwrap();
        ws.append_file("files/notes.txt", "line two\n")
            .await
            .unwrap();
        assert_eq!(
            ws.read_file("files/notes.txt").await.unwrap(),
            "line one\nline two\n"
        );

        ws.move_file("files/notes.txt", "files/sub/notes.txt")
            .await
            .unwrap();
        assert!(ws.read_file("files/notes.txt").await.is_err());

        let entries = ws.list_dir("files/sub").await.unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "notes.txt");
        assert!(!entries[0].is_dir);
        assert_eq!(entries[0].size, "line one\nline two\n".len() as u64);

        ws.delete_file("files/sub/notes.txt").await.unwrap();
        assert!(ws.list_dir("files/sub").await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn search_and_grep() {
        let (_dir, ws) = workspace().await;
        ws.write_file("files/report.md", "alpha\nneedle here\n")
            .await
            .unwrap();
        ws.write_file("files/deep/other.txt", "no match\n")
            .await
            .unwrap();
        ws.write_file("skills/demo/SKILL.md", "needle in a skill\n")
            .await
            .unwrap();

        let by_substring = ws.search_files("report").await.unwrap();
        assert_eq!(by_substring, vec!["files/report.md".to_string()]);

        let by_glob = ws.search_files("files/**/*.txt").await.unwrap();
        assert_eq!(by_glob, vec!["files/deep/other.txt".to_string()]);

        let hits = ws.grep("needle", 10).await.unwrap();
        assert_eq!(hits.len(), 2);
        assert!(hits
            .iter()
            .any(|h| h.path == "files/report.md" && h.line == 2));
        assert!(hits
            .iter()
            .any(|h| h.path == "skills/demo/SKILL.md" && h.line == 1));

        let capped = ws.grep("needle", 1).await.unwrap();
        assert_eq!(capped.len(), 1);
    }

    #[tokio::test]
    async fn grep_skips_binary_files() {
        let (_dir, ws) = workspace().await;
        let binary = ws.resolve("files/blob.bin").unwrap();
        std::fs::write(&binary, b"needle\0needle").unwrap();
        ws.write_file("files/text.txt", "needle\n").await.unwrap();
        let hits = ws.grep("needle", 10).await.unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].path, "files/text.txt");
    }
}
