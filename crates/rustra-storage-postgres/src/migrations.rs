//! Schema migrations, versioned through the `rustra_meta` table.
//!
//! `rustra_meta` holds a single `schema_version` row. Each migration is
//! applied inside a transaction that also bumps `schema_version`, so a crash
//! mid-migration leaves the database at the previous version. To add a
//! schema change, append a new `(version, sql)` pair to [`MIGRATIONS`] —
//! never edit an existing one.

use rustra_core::Result;
use tokio_postgres::Client;

use crate::util::storage_err;

/// Ordered list of `(target_version, batch_sql)` migrations.
const MIGRATIONS: &[(i64, &str)] = &[(1, V1)];

// Compile-time guard: run_locked() applies migrations in slice order and
// skips any version <= the stored schema_version, so the list must be
// strictly increasing (and versions must be positive) or migrations would
// be silently skipped. Appending out of order fails the build.
const _: () = {
    assert!(!MIGRATIONS.is_empty(), "MIGRATIONS must not be empty");
    assert!(MIGRATIONS[0].0 >= 1, "migration versions start at 1");
    let mut i = 1;
    while i < MIGRATIONS.len() {
        assert!(
            MIGRATIONS[i - 1].0 < MIGRATIONS[i].0,
            "MIGRATIONS must be strictly increasing by version"
        );
        i += 1;
    }
};

/// Advisory-lock key serializing concurrent migration runs (ASCII "rustra").
const MIGRATION_LOCK_KEY: i64 = 0x7275_7374_7261;

/// Bring the database up to the latest schema version. Takes `&mut Client`
/// (only available during `connect`, before the client is shared) so real
/// transactions can be used.
pub(crate) async fn run(client: &mut Client) -> Result<()> {
    // Serialize concurrent connectors: even `CREATE TABLE IF NOT EXISTS`
    // races under concurrency in Postgres. The session-level lock is
    // released below (or implicitly when the connection drops on error).
    client
        .execute("SELECT pg_advisory_lock($1)", &[&MIGRATION_LOCK_KEY])
        .await
        .map_err(storage_err)?;
    let result = run_locked(client).await;
    let _ = client
        .execute("SELECT pg_advisory_unlock($1)", &[&MIGRATION_LOCK_KEY])
        .await;
    result
}

async fn run_locked(client: &mut Client) -> Result<()> {
    client
        .batch_execute(
            "CREATE TABLE IF NOT EXISTS rustra_meta (
                 key   TEXT PRIMARY KEY,
                 value BIGINT NOT NULL
             )",
        )
        .await
        .map_err(storage_err)?;
    let current: i64 = client
        .query_opt(
            "SELECT value FROM rustra_meta WHERE key = 'schema_version'",
            &[],
        )
        .await
        .map_err(storage_err)?
        .map(|row| row.get(0))
        .unwrap_or(0);
    for (version, sql) in MIGRATIONS {
        if current >= *version {
            continue;
        }
        let tx = client.transaction().await.map_err(storage_err)?;
        tx.batch_execute(sql).await.map_err(storage_err)?;
        tx.execute(
            "INSERT INTO rustra_meta (key, value) VALUES ('schema_version', $1)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            &[version],
        )
        .await
        .map_err(storage_err)?;
        tx.commit().await.map_err(storage_err)?;
    }
    Ok(())
}

/// Version 1: the full initial schema — the same tables as the SQLite
/// backend, adapted to Postgres types.
///
/// Conventions: timestamps are `TIMESTAMPTZ`, JSON payloads and string lists
/// are `JSONB`, booleans are `BOOLEAN`, `u32` fields are `BIGINT`, enums are
/// snake_case serde strings. `rustra_messages`/`rustra_spans` add a
/// `BIGSERIAL seq` insertion-order tiebreaker (SQLite's `rowid` equivalent).
const V1: &str = r#"
-- memory domain -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rustra_threads (
    id          TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL,
    title       TEXT,
    metadata    JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_threads_resource
    ON rustra_threads (resource_id, updated_at);

CREATE TABLE IF NOT EXISTS rustra_messages (
    id          TEXT PRIMARY KEY,
    thread_id   TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    role        TEXT NOT NULL,
    content     JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL,
    seq         BIGSERIAL
);
CREATE INDEX IF NOT EXISTS idx_rustra_messages_thread
    ON rustra_messages (thread_id, created_at);

CREATE TABLE IF NOT EXISTS rustra_resources (
    id             TEXT PRIMARY KEY,
    working_memory TEXT,
    metadata       JSONB NOT NULL,
    updated_at     TIMESTAMPTZ NOT NULL
);

-- workflow domain ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rustra_workflow_snapshots (
    run_id      TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    status      TEXT NOT NULL,
    snapshot    JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL
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
    input      JSONB NOT NULL,
    output     JSONB NOT NULL,
    error      TEXT,
    trace_id   TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at   TIMESTAMPTZ,
    metadata   JSONB NOT NULL
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
    input      JSONB NOT NULL,
    output     JSONB NOT NULL,
    error      TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at   TIMESTAMPTZ,
    metadata   JSONB NOT NULL,
    seq        BIGSERIAL
);
CREATE INDEX IF NOT EXISTS idx_rustra_spans_trace
    ON rustra_spans (trace_id, started_at);

CREATE TABLE IF NOT EXISTS rustra_logs (
    id         TEXT PRIMARY KEY,
    level      TEXT NOT NULL,
    message    TEXT NOT NULL,
    fields     JSONB NOT NULL,
    user_id    TEXT,
    run_id     TEXT,
    created_at TIMESTAMPTZ NOT NULL
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
    spec        JSONB NOT NULL,
    status      TEXT NOT NULL,
    attempts    BIGINT NOT NULL,
    max_retries BIGINT NOT NULL,
    last_error  TEXT,
    output      JSONB NOT NULL,
    run_id      TEXT,
    schedule_id TEXT,
    created_at  TIMESTAMPTZ NOT NULL,
    started_at  TIMESTAMPTZ,
    ended_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_rustra_tasks_user
    ON rustra_tasks (user_id, created_at);

CREATE TABLE IF NOT EXISTS rustra_schedules (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    cron        TEXT NOT NULL,
    timezone    TEXT,
    spec        JSONB NOT NULL,
    enabled     BOOLEAN NOT NULL,
    next_run_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_schedules_due
    ON rustra_schedules (enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_rustra_schedules_user
    ON rustra_schedules (user_id);

CREATE TABLE IF NOT EXISTS rustra_subscriptions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    event_name TEXT NOT NULL,
    spec       JSONB NOT NULL,
    enabled    BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_subscriptions_user
    ON rustra_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS rustra_decisions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    run_id      TEXT NOT NULL,
    kind        TEXT NOT NULL,
    prompt      TEXT NOT NULL,
    payload     JSONB NOT NULL,
    status      TEXT NOT NULL,
    resolution  JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_rustra_decisions_user
    ON rustra_decisions (user_id, status);

-- definitions domain ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS rustra_definitions (
    id         TEXT NOT NULL,
    kind       TEXT NOT NULL,
    owner_id   TEXT NOT NULL,
    name       TEXT NOT NULL,
    version    BIGINT NOT NULL,
    spec       JSONB NOT NULL,
    visibility TEXT NOT NULL,
    latest     BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (kind, id, version)
);
CREATE INDEX IF NOT EXISTS idx_rustra_definitions_latest
    ON rustra_definitions (kind, latest, owner_id);

-- acl domain -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rustra_users (
    id           TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    roles        JSONB NOT NULL,
    token_hash   TEXT,
    profile      JSONB NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_users_token
    ON rustra_users (token_hash);

CREATE TABLE IF NOT EXISTS rustra_grants (
    id            TEXT PRIMARY KEY,
    resource_kind TEXT NOT NULL,
    resource_id   TEXT NOT NULL,
    grantee       TEXT NOT NULL,
    actions       JSONB NOT NULL,
    granted_by    TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL
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
    settings   JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_workspaces_user
    ON rustra_workspaces (user_id);

CREATE TABLE IF NOT EXISTS rustra_mcp_servers (
    id         TEXT PRIMARY KEY,
    owner_id   TEXT,
    name       TEXT NOT NULL,
    config     JSONB NOT NULL,
    enabled    BOOLEAN NOT NULL,
    visibility TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_mcp_servers_owner
    ON rustra_mcp_servers (owner_id);

CREATE TABLE IF NOT EXISTS rustra_ui_artifacts (
    id         TEXT PRIMARY KEY,
    owner_id   TEXT NOT NULL,
    title      TEXT NOT NULL,
    kind       TEXT NOT NULL,
    html       TEXT NOT NULL,
    data       JSONB NOT NULL,
    version    BIGINT NOT NULL,
    visibility TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_ui_artifacts_owner
    ON rustra_ui_artifacts (owner_id, updated_at);

CREATE TABLE IF NOT EXISTS rustra_channel_messages (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    channel    TEXT NOT NULL,
    sender     TEXT NOT NULL,
    content    TEXT NOT NULL,
    metadata   JSONB NOT NULL,
    "read"     BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rustra_channel_messages_user
    ON rustra_channel_messages (user_id, created_at);

-- vector store -----------------------------------------------------------------
-- One table holds both index metadata and entries: the row with id = ''
-- is the index sentinel carrying the dimension; real entries have id != ''.
CREATE TABLE IF NOT EXISTS rustra_vectors (
    index_name TEXT NOT NULL,
    id         TEXT NOT NULL,
    dimension  BIGINT NOT NULL,
    vector     BYTEA,
    metadata   JSONB,
    PRIMARY KEY (index_name, id)
);
"#;
