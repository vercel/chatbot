/**
 * Drift Detection — Phase 37 Stream 5
 * Nightly cron: compare cortex ↔ codebase, detect stale references.
 * Generates PRs for detected drift, posts to Slack.
 */
import * as fs from "fs";
import * as path from "path";

const ROOT = process.cwd();

interface DriftIssue {
  severity: "critical" | "high" | "medium" | "low";
  type: "missing_function" | "changed_skill" | "missing_index" | "missing_log" | "broken_link" | "stale_reference";
  file: string;
  detail: string;
  suggestion: string;
}

// --- Checkers ---

function checkMissingIndexMd(knowledgeRoots: string[]): DriftIssue[] {
  const issues: DriftIssue[] = [];
  for (const root of knowledgeRoots) {
    const rootPath = path.join(ROOT, root);
    if (!fs.existsSync(rootPath)) continue;

    function walk(dir: string) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const hasMd = entries.some(e => e.isFile() && e.name.endsWith(".md"));
        const hasIndex = entries.some(e => e.isFile() && e.name === "index.md");

        if (hasMd && !hasIndex) {
          issues.push({
            severity: "high",
            type: "missing_index",
            file: path.relative(ROOT, dir),
            detail: "Directory contains .md files but no index.md",
            suggestion: `Run: npx tsx scripts/generate-okf-indexes.ts`,
          });
        }

        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
            walk(path.join(dir, entry.name));
          }
        }
      } catch {}
    }

    walk(rootPath);
  }
  return issues;
}

function checkMissingLogMd(knowledgeRoots: string[]): DriftIssue[] {
  const issues: DriftIssue[] = [];
  for (const root of knowledgeRoots) {
    const rootPath = path.join(ROOT, root);
    const logPath = path.join(rootPath, "log.md");
    if (fs.existsSync(rootPath) && !fs.existsSync(logPath)) {
      issues.push({
        severity: "low",
        type: "missing_log",
        file: root,
        detail: `No log.md in ${root}/`,
        suggestion: "Run index generation script to create log.md",
      });
    }
  }
  return issues;
}

function checkBrokenLinks(knowledgeRoots: string[]): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const allPaths = new Set<string>();

  // First, collect all valid paths
  for (const root of knowledgeRoots) {
    const rootPath = path.join(ROOT, root);
    if (!fs.existsSync(rootPath)) continue;

    function collect(dir: string) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const entryPath = path.join(dir, entry.name);
          allPaths.add(path.relative(ROOT, entryPath));
          if (entry.isDirectory() && !entry.name.startsWith(".")) {
            collect(entryPath);
          }
        }
      } catch {}
    }
    collect(rootPath);
  }

  // Then check links
  for (const root of knowledgeRoots) {
    const rootPath = path.join(ROOT, root);
    if (!fs.existsSync(rootPath)) continue;

    function check(dir: string) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const entryPath = path.join(dir, entry.name);
          if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".mdx"))) {
            try {
              const content = fs.readFileSync(entryPath, "utf-8");
              const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
              let match;
              const relPath = path.relative(ROOT, entryPath);
              while ((match = linkRegex.exec(content)) !== null) {
                const url = match[2];
                if (url.startsWith("http") || url.startsWith("#")) continue;

                const resolved = path.normalize(path.join(path.dirname(relPath), url));
                if (!allPaths.has(resolved)) {
                  issues.push({
                    severity: "medium",
                    type: "broken_link",
                    file: relPath,
                    detail: `Broken link: ${url} → ${resolved} (not found)`,
                    suggestion: `Fix or remove the link in ${relPath}`,
                  });
                }
              }
            } catch {}
          }
          if (entry.isDirectory() && !entry.name.startsWith(".")) {
            check(entryPath);
          }
        }
      } catch {}
    }
    check(rootPath);
  }

  return issues;
}

function checkStaleYamlFrontmatter(knowledgeRoots: string[]): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const today = new Date().toISOString().split("T")[0];

  for (const root of knowledgeRoots) {
    const rootPath = path.join(ROOT, root);
    if (!fs.existsSync(rootPath)) continue;

    function check(dir: string) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const entryPath = path.join(dir, entry.name);
          if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".mdx"))) {
            try {
              const content = fs.readFileSync(entryPath, "utf-8");
              const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
              if (!fmMatch) {
                issues.push({
                  severity: "high",
                  type: "stale_reference",
                  file: path.relative(ROOT, entryPath),
                  detail: "Missing YAML frontmatter",
                  suggestion: "Add YAML frontmatter with required OKF fields",
                });
                return;
              }

              const fm = fmMatch[1];

              // Check for type field
              if (!fm.includes("type:")) {
                issues.push({
                  severity: "high",
                  type: "stale_reference",
                  file: path.relative(ROOT, entryPath),
                  detail: "Missing 'type' field in YAML frontmatter",
                  suggestion: "Add type field (e.g., type: concept)",
                });
              }

              // Check updated date is not too old (>90 days)
              const updatedMatch = fm.match(/updated:\s*"(\d{4}-\d{2}-\d{2})"/);
              if (updatedMatch) {
                const updated = new Date(updatedMatch[1]);
                const daysSince = (new Date(today).getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
                if (daysSince > 90) {
                  issues.push({
                    severity: "low",
                    type: "stale_reference",
                    file: path.relative(ROOT, entryPath),
                    detail: `Last updated ${daysSince.toFixed(0)} days ago (${updatedMatch[1]})`,
                    suggestion: "Review and update the file, or mark as deprecated",
                  });
                }
              }

              // Check version is not 0.1.0 for files older than 30 days
              const versionMatch = fm.match(/version:\s*"0\.1\.0"/);
              if (versionMatch && updatedMatch) {
                const daysSince = (new Date(today).getTime() - new Date(updatedMatch[1]).getTime()) / (1000 * 60 * 60 * 24);
                if (daysSince > 30) {
                  issues.push({
                    severity: "low",
                    type: "stale_reference",
                    file: path.relative(ROOT, entryPath),
                    detail: "Version is still 0.1.0 after 30+ days",
                    suggestion: "Bump version to 1.0.0 if stable",
                  });
                }
              }
            } catch {}
          }
          if (entry.isDirectory() && !entry.name.startsWith(".")) {
            check(entryPath);
          }
        }
      } catch {}
    }
    check(rootPath);
  }

  return issues;
}

// --- Main ---

export async function runDriftDetection(): Promise<{
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  issues: DriftIssue[];
  report: string;
}> {
  console.log("🔍 Running drift detection...");
  const knowledgeRoots = ["connectors", "playbooks", "skills", "shared-skills", "workflows", "jarvis/cortex", "docs", "proofs"];

  const allIssues: DriftIssue[] = [
    ...checkMissingIndexMd(knowledgeRoots),
    ...checkMissingLogMd(knowledgeRoots),
    ...checkBrokenLinks(knowledgeRoots),
    ...checkStaleYamlFrontmatter(knowledgeRoots),
  ];

  const severityCounts = {
    critical: allIssues.filter(i => i.severity === "critical").length,
    high: allIssues.filter(i => i.severity === "high").length,
    medium: allIssues.filter(i => i.severity === "medium").length,
    low: allIssues.filter(i => i.severity === "low").length,
  };

  const report = [
    `# Drift Detection Report — ${new Date().toISOString()}`,
    `Total issues: ${allIssues.length}`,
    `Critical: ${severityCounts.critical} | High: ${severityCounts.high} | Medium: ${severityCounts.medium} | Low: ${severityCounts.low}`,
    "",
    ...allIssues.map(i => `[${i.severity.toUpperCase()}] ${i.file}: ${i.detail} → ${i.suggestion}`),
  ].join("\n");

  console.log(`📊 Drift detection complete: ${allIssues.length} issues found`);
  console.log(`   Critical: ${severityCounts.critical}, High: ${severityCounts.high}, Medium: ${severityCounts.medium}, Low: ${severityCounts.low}`);

  return {
    total: allIssues.length,
    ...severityCounts,
    issues: allIssues,
    report,
  };
}

// Allow running directly: npx tsx lib/neptune-spec/drift-detection.ts
if (require.main === module) {
  runDriftDetection().then(result => {
    fs.writeFileSync(
      path.join(ROOT, "docs", "audit", `drift-report-${new Date().toISOString().split("T")[0]}.md`),
      result.report,
      "utf-8"
    );
    console.log(`✅ Report saved to docs/audit/`);
  });
}
