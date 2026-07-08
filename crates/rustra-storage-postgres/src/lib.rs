//! # rustra-storage-postgres
//!
//! PostgreSQL storage backend for Rustra: one database that implements every
//! `rustra-storage` domain trait — [`MemoryStore`], [`WorkflowStore`],
//! [`ObservabilityStore`], [`TaskStore`], [`DefinitionStore`], [`AclStore`],
//! and [`InfraStore`] — and therefore the composite [`Storage`] supertrait
//! (via the blanket impl). Vector search is provided by the separate
//! [`PostgresVectorStore`].
//!
//! Semantics mirror `rustra_storage::InMemoryStorage` and the SQLite backend
//! (the executable specification): ordering, `LIMIT`/`OFFSET` pagination,
//! `put_definition` latest-version handling, `delete_thread` message
//! cascading, and `due_schedules` filtering behave identically.
//!
//! ## Concurrency model
//!
//! One `tokio_postgres::Client` held in an `Arc`; the connection driver runs
//! on a spawned Tokio task and queries are pipelined on that single
//! connection. Methods are naturally async — no blocking pool involved.
//! Multi-step invariants (`delete_thread` cascade, `put_definition` version
//! bump) are executed as single atomic statements using data-modifying CTEs,
//! so they cannot interleave with other pipelined statements.
//!
//! ## Storage conventions
//!
//! * Table names are prefixed `rustra_` (same 18 domain tables as the SQLite
//!   backend plus `rustra_vectors`).
//! * Timestamps are `TIMESTAMPTZ` (note: Postgres stores **microsecond**
//!   precision, so sub-microsecond fractions of `DateTime<Utc>` values are
//!   truncated on write).
//! * JSON payloads and string-list columns (roles, actions) are `JSONB`;
//!   booleans are `BOOLEAN`; `u32` counters/versions are `BIGINT`; enums
//!   (`ResourceKind`, `Visibility`) are their snake_case serde strings.
//! * `rustra_messages` and `rustra_spans` carry a `BIGSERIAL seq` column as
//!   the insertion-order tiebreaker (the equivalent of SQLite's `rowid`).
//! * The schema is versioned through the `rustra_meta` table
//!   (`schema_version` key); see [`migrations`].
//!
//! ## Tech debt
//!
//! * Connections use `NoTls`; TLS support has not been wired up yet.
//! * [`PostgresVectorStore`] does brute-force cosine similarity in Rust over
//!   `BYTEA`-encoded vectors. **pgvector would be the production choice**;
//!   this implementation keeps dependencies minimal at the cost of loading
//!   the whole index per query.
//!
//! [`MemoryStore`]: rustra_storage::MemoryStore
//! [`WorkflowStore`]: rustra_storage::WorkflowStore
//! [`ObservabilityStore`]: rustra_storage::ObservabilityStore
//! [`TaskStore`]: rustra_storage::TaskStore
//! [`DefinitionStore`]: rustra_storage::DefinitionStore
//! [`AclStore`]: rustra_storage::AclStore
//! [`InfraStore`]: rustra_storage::InfraStore
//! [`Storage`]: rustra_storage::Storage

mod acl;
mod definitions;
mod infra;
mod memory;
mod migrations;
mod observability;
mod tasks;
mod util;
mod vector;
mod workflow;

pub use vector::PostgresVectorStore;

use std::sync::Arc;

use rustra_core::{Error, Result};
use tokio_postgres::types::ToSql;
use tokio_postgres::{Client, NoTls, Row};

use crate::util::storage_err;

/// A shared handle to one `tokio_postgres` connection. Internal building
/// block for [`PostgresStorage`] and [`PostgresVectorStore`].
#[derive(Clone)]
pub(crate) struct Db {
    client: Arc<Client>,
}

impl Db {
    /// Connect, spawn the connection driver task, and run migrations.
    pub(crate) async fn connect(conn_str: &str) -> Result<Self> {
        let (mut client, connection) = tokio_postgres::connect(conn_str, NoTls)
            .await
            .map_err(|e| Error::Unavailable(format!("postgres connect failed: {e}")))?;
        tokio::spawn(async move {
            if let Err(e) = connection.await {
                tracing::error!(error = %e, "postgres connection driver exited with error");
            }
        });
        migrations::run(&mut client).await?;
        Ok(Self { client: Arc::new(client) })
    }

    pub(crate) async fn execute(
        &self,
        sql: &str,
        params: &[&(dyn ToSql + Sync)],
    ) -> Result<u64> {
        self.client.execute(sql, params).await.map_err(storage_err)
    }

    pub(crate) async fn query(
        &self,
        sql: &str,
        params: &[&(dyn ToSql + Sync)],
    ) -> Result<Vec<Row>> {
        self.client.query(sql, params).await.map_err(storage_err)
    }

    pub(crate) async fn query_opt(
        &self,
        sql: &str,
        params: &[&(dyn ToSql + Sync)],
    ) -> Result<Option<Row>> {
        self.client.query_opt(sql, params).await.map_err(storage_err)
    }

    pub(crate) async fn query_one(
        &self,
        sql: &str,
        params: &[&(dyn ToSql + Sync)],
    ) -> Result<Row> {
        self.client.query_one(sql, params).await.map_err(storage_err)
    }
}

/// The PostgreSQL Rustra storage backend: every domain store on one Postgres
/// database. See the crate docs for conventions.
pub struct PostgresStorage {
    pub(crate) db: Db,
}

impl PostgresStorage {
    /// Connect to Postgres (e.g. `postgres://user:pass@localhost/rustra`),
    /// spawn the connection driver task, and run any pending migrations.
    pub async fn connect(conn_str: &str) -> Result<Self> {
        Ok(Self { db: Db::connect(conn_str).await? })
    }
}
