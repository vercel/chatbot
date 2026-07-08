//! Schema migrations, versioned via `PRAGMA user_version`.
//!
//! Each migration is applied inside a transaction that also bumps
//! `user_version`, so a crash mid-migration leaves the database at the
//! previous version. To add a schema change, append a new
//! `(version, sql)` pair to [`MIGRATIONS`] — never edit an existing one.

use rusqlite::Connection;
use rustra_core::Result;

use crate::util::storage_err;

/// Ordered list of `(target_version, batch_sql)` migrations.
const MIGRATIONS: &[(i64, &str)] = &[(1, V1)];

/// Bring `conn` up to the latest schema version.
pub(crate) fn run(conn: &mut Connection) -> Result<()> {
    let current: i64 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(storage_err)?;
    for (version, sql) in MIGRATIONS {
        if current >= *version {
            continue;
        }
        let tx = conn.transaction().map_err(storage_err)?;
        tx.execute_batch(sql).map_err(storage_err)?;
        tx.pragma_update(None, "user_version", version)
            .map_err(storage_err)?;
        tx.commit().map_err(storage_err)?;
    }
    Ok(())
}

/// Version 1: the full initial schema.
///
/// Conventions: timestamps are RFC3339 TEXT (fixed-width, so lexicographic
/// order is chronological), JSON is TEXT, booleans are INTEGER, enums are
/// snake_case serde strings.
const V1: &str = r#"
-- memory domain -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rustra_threads (
    id          TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL,
    title       TEXT,
    metadata    TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_threads_resource
    ON rustra_threads (resource_id, updated_at);

CREATE TABLE IF NOT EXISTS rustra_messages (
    id          TEXT PRIMARY KEY,
    thread_id   TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_messages_thread
    ON rustra_messages (thread_id, created_at);

CREATE TABLE IF NOT EXISTS rustra_resources (
    id             TEXT PRIMARY KEY,
    working_memory TEXT,
    metadata       TEXT NOT NULL,
    updated_at     TEXT NOT NULL
);

-- workflow domain ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rustra_workflow_snapshots (
    run_id      TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    status      TEXT NOT NULL,
    snapshot    TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_workflow_snapshots_resource
    ON rustra_workflow_snapshots (resource_id, updated_at);

-- observability domain -------------------------------------------------------
CREATE TABLE IF NOT EXISTS rustra_runs (
    id         TEXT PRIMARY KEY,
    kind       TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    status     TEXT NOT NULL,
    input      TEXT NOT NULL,
    output     TEXT NOT NULL,
    error      TEXT,
    trace_id   TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at   TEXT,
    metadata   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_runs_user
    ON rustra_runs (user_id, started_at);

CREATE TABLE IF NOT EXISTS rustra_spans (
    id         TEXT PRIMARY KEY,
    trace_id   TEXT NOT NULL,
    parent_id  TEXT,
    name       TEXT NOT NULL,
    kind       TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    input      TEXT NOT NULL,
    output     TEXT NOT NULL,
    error      TEXT,
    started_at TEXT NOT NULL,
    ended_at   TEXT,
    metadata   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_spans_trace
    ON rustra_spans (trace_id, started_at);

CREATE TABLE IF NOT EXISTS rustra_logs (
    id         TEXT PRIMARY KEY,
    level      TEXT NOT NULL,
    message    TEXT NOT NULL,
    fields     TEXT NOT NULL,
    user_id    TEXT,
    run_id     TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_logs_user
    ON rustra_logs (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rustra_logs_run
    ON rustra_logs (run_id, created_at);

-- task domain ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rustra_tasks (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    "trigger"   TEXT NOT NULL,
    spec        TEXT NOT NULL,
    status      TEXT NOT NULL,
    attempts    INTEGER NOT NULL,
    max_retries INTEGER NOT NULL,
    last_error  TEXT,
    output      TEXT NOT NULL,
    run_id      TEXT,
    schedule_id TEXT,
    created_at  TEXT NOT NULL,
    started_at  TEXT,
    ended_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_rustra_tasks_user
    ON rustra_tasks (user_id, created_at);

CREATE TABLE IF NOT EXISTS rustra_schedules (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    cron        TEXT NOT NULL,
    timezone    TEXT,
    spec        TEXT NOT NULL,
    enabled     INTEGER NOT NULL,
    next_run_at TEXT,
    last_run_at TEXT,
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_schedules_due
    ON rustra_schedules (enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_rustra_schedules_user
    ON rustra_schedules (user_id);

CREATE TABLE IF NOT EXISTS rustra_subscriptions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    event_name TEXT NOT NULL,
    spec       TEXT NOT NULL,
    enabled    INTEGER NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_subscriptions_user
    ON rustra_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS rustra_decisions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    run_id      TEXT NOT NULL,
    kind        TEXT NOT NULL,
    prompt      TEXT NOT NULL,
    payload     TEXT NOT NULL,
    status      TEXT NOT NULL,
    resolution  TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_rustra_decisions_user
    ON rustra_decisions (user_id, status);

-- definitions domain ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS rustra_definitions (
    id         TEXT NOT NULL,
    kind       TEXT NOT NULL,
    owner_id   TEXT NOT NULL,
    name       TEXT NOT NULL,
    version    INTEGER NOT NULL,
    spec       TEXT NOT NULL,
    visibility TEXT NOT NULL,
    latest     INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (kind, id, version)
);
CREATE INDEX IF NOT EXISTS idx_rustra_definitions_latest
    ON rustra_definitions (kind, latest, owner_id);

-- acl domain -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rustra_users (
    id           TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    roles        TEXT NOT NULL,
    token_hash   TEXT,
    profile      TEXT NOT NULL,
    created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_users_token
    ON rustra_users (token_hash);

CREATE TABLE IF NOT EXISTS rustra_grants (
    id            TEXT PRIMARY KEY,
    resource_kind TEXT NOT NULL,
    resource_id   TEXT NOT NULL,
    grantee       TEXT NOT NULL,
    actions       TEXT NOT NULL,
    granted_by    TEXT NOT NULL,
    created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_grants_resource
    ON rustra_grants (resource_kind, resource_id);
CREATE INDEX IF NOT EXISTS idx_rustra_grants_grantee
    ON rustra_grants (grantee);

-- infra domain -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rustra_workspaces (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    name       TEXT NOT NULL,
    root_path  TEXT NOT NULL,
    settings   TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_workspaces_user
    ON rustra_workspaces (user_id);

CREATE TABLE IF NOT EXISTS rustra_mcp_servers (
    id         TEXT PRIMARY KEY,
    owner_id   TEXT,
    name       TEXT NOT NULL,
    config     TEXT NOT NULL,
    enabled    INTEGER NOT NULL,
    visibility TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_mcp_servers_owner
    ON rustra_mcp_servers (owner_id);

CREATE TABLE IF NOT EXISTS rustra_ui_artifacts (
    id         TEXT PRIMARY KEY,
    owner_id   TEXT NOT NULL,
    title      TEXT NOT NULL,
    kind       TEXT NOT NULL,
    html       TEXT NOT NULL,
    data       TEXT NOT NULL,
    version    INTEGER NOT NULL,
    visibility TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_ui_artifacts_owner
    ON rustra_ui_artifacts (owner_id, updated_at);

CREATE TABLE IF NOT EXISTS rustra_channel_messages (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    channel    TEXT NOT NULL,
    sender     TEXT NOT NULL,
    content    TEXT NOT NULL,
    metadata   TEXT NOT NULL,
    "read"     INTEGER NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_channel_messages_user
    ON rustra_channel_messages (user_id, created_at);

-- vector store -----------------------------------------------------------------
-- One table holds both index metadata and entries: the row with id = ''
-- is the index sentinel carrying the dimension; real entries have id != ''.
CREATE TABLE IF NOT EXISTS rustra_vectors (
    index_name TEXT NOT NULL,
    id         TEXT NOT NULL,
    dimension  INTEGER NOT NULL,
    vector     BLOB,
    metadata   TEXT,
    PRIMARY KEY (index_name, id)
);
"#;
