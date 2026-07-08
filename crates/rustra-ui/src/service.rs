//! Owner-scoped CRUD + versioning for UI artifacts.

use chrono::Utc;
use serde_json::Value;

use rustra_core::{new_id, Error, Result, Visibility};
use rustra_storage::types::UiArtifactRecord;
use rustra_storage::{Page, SharedStorage};

/// Maximum artifact HTML size: 2 MiB.
pub const MAX_HTML_BYTES: usize = 2 * 1024 * 1024;
/// Maximum artifact title length in characters.
pub const MAX_TITLE_CHARS: usize = 200;

/// Partial update applied by [`UiService::update`]; `None` fields keep their
/// current value. Any accepted update bumps the version.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct UiArtifactUpdate {
    pub title: Option<String>,
    pub html: Option<String>,
    pub data: Option<Value>,
}

/// The UI-artifact domain service.
///
/// Enforces owner scoping at the service boundary: mutation requires
/// ownership, reads require ownership or `Visibility::Public`. Finer-grained
/// `Shared` grants are resolved by the RBAC layer above this crate.
pub struct UiService {
    storage: SharedStorage,
}

impl UiService {
    pub fn new(storage: SharedStorage) -> Self {
        Self { storage }
    }

    fn validate(title: &str, html: &str) -> Result<()> {
        if html.is_empty() {
            return Err(Error::Validation("artifact html must not be empty".into()));
        }
        if html.len() > MAX_HTML_BYTES {
            return Err(Error::Validation(format!(
                "artifact html is {} bytes; the maximum is {MAX_HTML_BYTES}",
                html.len()
            )));
        }
        if title.chars().count() > MAX_TITLE_CHARS {
            return Err(Error::Validation(format!(
                "artifact title exceeds {MAX_TITLE_CHARS} characters"
            )));
        }
        Ok(())
    }

    /// Create a new private artifact at version 1.
    pub async fn create(
        &self,
        owner_id: &str,
        title: &str,
        html: &str,
        data: Value,
    ) -> Result<UiArtifactRecord> {
        Self::validate(title, html)?;
        let now = Utc::now();
        let record = UiArtifactRecord {
            id: new_id("ui"),
            owner_id: owner_id.to_string(),
            title: title.to_string(),
            kind: "html".into(),
            html: html.to_string(),
            data,
            version: 1,
            visibility: Visibility::Private,
            created_at: now,
            updated_at: now,
        };
        self.storage.upsert_ui_artifact(record.clone()).await?;
        Ok(record)
    }

    /// Fetch by id or map the miss to `NotFound` — access checks are the
    /// callers' job.
    async fn fetch(&self, artifact_id: &str) -> Result<UiArtifactRecord> {
        self.storage
            .get_ui_artifact(artifact_id)
            .await?
            .ok_or_else(|| Error::not_found("ui_artifact", artifact_id))
    }

    /// Fetch an artifact the owner can mutate.
    async fn get_owned(&self, owner_id: &str, artifact_id: &str) -> Result<UiArtifactRecord> {
        let record = self.fetch(artifact_id).await?;
        if record.owner_id != owner_id {
            return Err(Error::PermissionDenied(format!(
                "ui artifact `{artifact_id}` is not owned by `{owner_id}`"
            )));
        }
        Ok(record)
    }

    /// Apply a partial update and bump the version. Owner only.
    pub async fn update(
        &self,
        owner_id: &str,
        artifact_id: &str,
        update: UiArtifactUpdate,
    ) -> Result<UiArtifactRecord> {
        let mut record = self.get_owned(owner_id, artifact_id).await?;
        if let Some(title) = update.title {
            record.title = title;
        }
        if let Some(html) = update.html {
            record.html = html;
        }
        if let Some(data) = update.data {
            record.data = data;
        }
        Self::validate(&record.title, &record.html)?;
        record.version += 1;
        record.updated_at = Utc::now();
        self.storage.upsert_ui_artifact(record.clone()).await?;
        Ok(record)
    }

    /// Read an artifact: the owner always may; others only when the artifact
    /// is `Public`. (`Shared` access goes through the RBAC layer, which uses
    /// the system principal after checking grants.)
    pub async fn get(&self, requester_id: &str, artifact_id: &str) -> Result<UiArtifactRecord> {
        let record = self.fetch(artifact_id).await?;
        if record.owner_id != requester_id && record.visibility != Visibility::Public {
            return Err(Error::PermissionDenied(format!(
                "ui artifact `{artifact_id}` is not visible to `{requester_id}`"
            )));
        }
        Ok(record)
    }

    /// Artifacts owned by `owner_id`, newest first.
    pub async fn list(&self, owner_id: &str, page: Page) -> Result<Vec<UiArtifactRecord>> {
        self.storage.list_ui_artifacts(owner_id, page).await
    }

    /// Delete an artifact. Owner only.
    pub async fn delete(&self, owner_id: &str, artifact_id: &str) -> Result<()> {
        self.get_owned(owner_id, artifact_id).await?;
        self.storage.delete_ui_artifact(artifact_id).await
    }

    /// Change who can see the artifact. Owner only; does not bump the
    /// version (the content is unchanged).
    pub async fn set_visibility(
        &self,
        owner_id: &str,
        artifact_id: &str,
        visibility: Visibility,
    ) -> Result<UiArtifactRecord> {
        let mut record = self.get_owned(owner_id, artifact_id).await?;
        record.visibility = visibility;
        record.updated_at = Utc::now();
        self.storage.upsert_ui_artifact(record.clone()).await?;
        Ok(record)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustra_storage::InMemoryStorage;
    use serde_json::json;
    use std::sync::Arc;

    fn service() -> UiService {
        UiService::new(Arc::new(InMemoryStorage::new()))
    }

    #[tokio::test]
    async fn create_then_update_bumps_version() {
        let svc = service();
        let created = svc
            .create("u1", "Dashboard", "<h1>v1</h1>", json!({ "n": 1 }))
            .await
            .unwrap();
        assert!(created.id.starts_with("ui_"));
        assert_eq!(created.version, 1);
        assert_eq!(created.visibility, Visibility::Private);
        assert_eq!(created.kind, "html");

        let updated = svc
            .update(
                "u1",
                &created.id,
                UiArtifactUpdate {
                    html: Some("<h1>v2</h1>".into()),
                    ..Default::default()
                },
            )
            .await
            .unwrap();
        assert_eq!(updated.version, 2);
        assert_eq!(updated.html, "<h1>v2</h1>");
        assert_eq!(updated.title, "Dashboard");
        assert_eq!(updated.data, json!({ "n": 1 }));

        let fetched = svc.get("u1", &created.id).await.unwrap();
        assert_eq!(fetched.version, 2);
    }

    #[tokio::test]
    async fn validation_failures() {
        let svc = service();

        let err = svc.create("u1", "t", "", Value::Null).await.unwrap_err();
        assert!(matches!(err, Error::Validation(_)));

        let big = "x".repeat(MAX_HTML_BYTES + 1);
        let err = svc.create("u1", "t", &big, Value::Null).await.unwrap_err();
        assert!(matches!(err, Error::Validation(_)));

        let long_title = "t".repeat(MAX_TITLE_CHARS + 1);
        let err = svc
            .create("u1", &long_title, "<p>ok</p>", Value::Null)
            .await
            .unwrap_err();
        assert!(matches!(err, Error::Validation(_)));

        // Updates are validated too.
        let record = svc
            .create("u1", "t", "<p>ok</p>", Value::Null)
            .await
            .unwrap();
        let err = svc
            .update(
                "u1",
                &record.id,
                UiArtifactUpdate {
                    html: Some(String::new()),
                    ..Default::default()
                },
            )
            .await
            .unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
        // Failed update must not bump the version.
        assert_eq!(svc.get("u1", &record.id).await.unwrap().version, 1);
    }

    #[tokio::test]
    async fn owner_scoping_and_visibility() {
        let svc = service();
        let record = svc
            .create("u1", "mine", "<p>hi</p>", Value::Null)
            .await
            .unwrap();

        // Private: others cannot read, update, or delete.
        assert!(matches!(
            svc.get("u2", &record.id).await.unwrap_err(),
            Error::PermissionDenied(_)
        ));
        assert!(matches!(
            svc.update("u2", &record.id, UiArtifactUpdate::default())
                .await
                .unwrap_err(),
            Error::PermissionDenied(_)
        ));
        assert!(matches!(
            svc.delete("u2", &record.id).await.unwrap_err(),
            Error::PermissionDenied(_)
        ));

        // Public: others can read but still not mutate.
        let public = svc
            .set_visibility("u1", &record.id, Visibility::Public)
            .await
            .unwrap();
        assert_eq!(public.version, 1, "visibility change does not bump version");
        assert_eq!(svc.get("u2", &record.id).await.unwrap().id, record.id);
        assert!(matches!(
            svc.set_visibility("u2", &record.id, Visibility::Private)
                .await
                .unwrap_err(),
            Error::PermissionDenied(_)
        ));

        // list is owner-scoped.
        assert_eq!(svc.list("u1", Page::default()).await.unwrap().len(), 1);
        assert!(svc.list("u2", Page::default()).await.unwrap().is_empty());

        svc.delete("u1", &record.id).await.unwrap();
        assert!(matches!(
            svc.get("u1", &record.id).await.unwrap_err(),
            Error::NotFound {
                kind: "ui_artifact",
                ..
            }
        ));
    }
}
