//! # rustra-storage-sqlite
//!
//! The **default** persistent storage backend for Rustra, mirroring Mastra's
//! LibSQL default store: a single SQLite file (or in-memory database) that
//! implements every `rustra-storage` domain trait — [`MemoryStore`],
//! [`WorkflowStore`], [`ObservabilityStore`], [`TaskStore`],
//! [`DefinitionStore`], [`AclStore`], and [`InfraStore`] — and therefore the
//! composite [`Storage`] supertrait. Vector search is provided by the
//! separate [`SqliteVectorStore`] (brute-force cosine similarity over a
//! `rustra_vectors` table, vectors stored as little-endian `f32` BLOBs).
//!
//! Semantics match `rustra_storage::InMemoryStorage` (the executable
//! specification): ordering, pagination, `put_definition` latest-version
//! handling, `delete_thread` message cascading, and `due_schedules`
//! filtering behave identically.
//!
//! ## Concurrency model
//!
//! One `rusqlite::Connection` behind an `Arc<std::sync::Mutex<_>>`; every
//! trait method runs its SQL on the Tokio blocking pool via
//! `tokio::task::spawn_blocking`, so the async runtime is never blocked.
//! On open the backend sets `journal_mode=WAL` (file-backed databases only),
//! `foreign_keys=ON`, and a 5s busy timeout.
//!
//! ## Storage conventions
//!
//! * Table names are prefixed `rustra_`.
//! * Timestamps are RFC3339 TEXT with fixed nanosecond precision and a `Z`
//!   suffix, so lexicographic order equals chronological order.
//! * JSON payloads are TEXT; booleans are INTEGER; enums
//!   (`ResourceKind`, `Visibility`) are their snake_case serde strings.
//! * The schema is versioned via `PRAGMA user_version` (see [`migrations`]).
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

pub use vector::SqliteVectorStore;

use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use rusqlite::Connection;
use rustra_core::{Error, Result};

use crate::util::storage_err;

/// A shared, mutex-guarded SQLite connection whose operations run on the
/// blocking pool. Internal building block for [`SqliteStorage`] and
/// [`SqliteVectorStore`].
#[derive(Clone)]
pub(crate) struct Db {
    conn: Arc<Mutex<Connection>>,
}

impl Db {
    /// Open a file-backed database, apply pragmas, and run migrations.
    fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path).map_err(storage_err)?;
        Self::init(conn, /* file_backed = */ true)
    }

    /// Open a private in-memory database (WAL is skipped — it does not apply
    /// to in-memory databases).
    fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory().map_err(storage_err)?;
        Self::init(conn, /* file_backed = */ false)
    }

    fn init(mut conn: Connection, file_backed: bool) -> Result<Self> {
        if file_backed {
            // `PRAGMA journal_mode` returns a row, so query rather than execute.
            conn.query_row("PRAGMA journal_mode=WAL", [], |_| Ok(()))
                .map_err(storage_err)?;
        }
        conn.pragma_update(None, "foreign_keys", "ON")
            .map_err(storage_err)?;
        conn.busy_timeout(Duration::from_millis(5000))
            .map_err(storage_err)?;
        migrations::run(&mut conn)?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    /// Run `f` against the connection on the blocking pool.
    pub(crate) async fn call<T, F>(&self, f: F) -> Result<T>
    where
        T: Send + 'static,
        F: FnOnce(&mut Connection) -> Result<T> + Send + 'static,
    {
        let conn = Arc::clone(&self.conn);
        tokio::task::spawn_blocking(move || {
            let mut guard = conn
                .lock()
                .map_err(|_| Error::Storage("sqlite connection mutex poisoned".into()))?;
            f(&mut guard)
        })
        .await
        .map_err(|e| Error::Storage(format!("sqlite worker task failed: {e}")))?
    }
}

/// The default Rustra storage backend: every domain store on one SQLite
/// database. See the crate docs for conventions.
pub struct SqliteStorage {
    pub(crate) db: Db,
}

impl SqliteStorage {
    /// Open (creating if necessary) the database file at `path` and run any
    /// pending migrations.
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        Ok(Self {
            db: Db::open(path.as_ref())?,
        })
    }

    /// A private in-memory database — hermetic, gone on drop. Useful for
    /// tests and ephemeral deployments.
    pub fn in_memory() -> Result<Self> {
        Ok(Self {
            db: Db::open_in_memory()?,
        })
    }
}
