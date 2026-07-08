//! # rustra-storage-firebase
//!
//! **Experimental** Firestore storage backend for Rustra, built directly on
//! the [Firestore REST API] (no gRPC / official SDK dependency). Records map
//! to documents in `rustra_<domain>` collections keyed by record id; filtered
//! lists are `runQuery` calls with `structuredQuery` bodies.
//!
//! > **Experimental backend** — the Firestore value codec and the
//! > structured-query construction are unit-tested; **live Firestore
//! > integration is untested tech debt**. See the scope and debt notes below
//! > before using this in anything that matters.
//!
//! ## What is implemented
//!
//! * [`MemoryStore`], [`WorkflowStore`], [`DefinitionStore`], [`AclStore`],
//!   and [`TaskStore`] are fully implemented over the REST API.
//! * The `firestore` module: precise `serde_json::Value` ⇄ Firestore
//!   document-value JSON encoding (`stringValue` / `integerValue` /
//!   `doubleValue` / `booleanValue` / `timestampValue` / `mapValue` /
//!   `arrayValue` / `nullValue`), document field builders/readers, and
//!   `structuredQuery` builders. This logic is unit-tested in both
//!   directions.
//!
//! ## What is stubbed
//!
//! Every method of [`ObservabilityStore`] (`insert_run`, `update_run`,
//! `get_run`, `list_runs`, `insert_spans`, `list_spans`, `insert_log`,
//! `list_logs`) and [`InfraStore`] (`upsert_workspace`, `get_workspace`,
//! `list_workspaces`, `delete_workspace`, `upsert_mcp_server`,
//! `get_mcp_server`, `list_mcp_servers`, `delete_mcp_server`,
//! `upsert_ui_artifact`, `get_ui_artifact`, `list_ui_artifacts`,
//! `delete_ui_artifact`, `insert_channel_message`, `list_channel_messages`,
//! `mark_message_read`) returns `Error::Config("... not yet implemented for
//! the Firebase backend ...")`. The traits are implemented so
//! [`FirebaseStorage`] still satisfies the composite `Storage` supertrait,
//! but those domains must live in another backend for now.
//!
//! ## TECH DEBT (untested / known gaps)
//!
//! * **No live integration tests.** Nothing in this crate has been run
//!   against real Firestore or the emulator; only the codec and query-body
//!   construction are verified. HTTP paths, auth, error shapes, and index
//!   requirements are unvalidated.
//! * **`put_definition` is read-modify-write**, not a Firestore transaction:
//!   it queries the current max version, demotes the previous `latest`
//!   documents, then writes the new head as separate requests. Concurrent
//!   writers can race (duplicate versions / two `latest` heads). It should
//!   use Firestore `beginTransaction`/`commit`.
//! * **`delete_thread` / `delete_definition` cascades are not atomic** —
//!   they issue one delete per matched document.
//! * **Composite indexes are required** by Firestore for most of the
//!   filtered+ordered queries built here (e.g. `due_schedules`,
//!   `list_tasks` with a status filter, `list_definitions`); they must be
//!   provisioned out of band, and `list_definitions(include_shared = true)`
//!   uses an `OR` composite filter, which requires a recent Firestore API.
//! * **`get_messages` fetches one document per id** (no `batchGet`), and
//!   pagination uses `offset`, which Firestore bills as reads.
//! * **Timestamps**: Firestore stores microsecond precision, so
//!   sub-microsecond fractions of `DateTime<Utc>` values are truncated
//!   server-side. Integers wider than `i64` (JSON `u64`) degrade to
//!   `doubleValue`.
//! * **Document ids are record ids** (definitions use
//!   `<kind>__<id>__v<version>`); ids containing `/` are not supported.
//! * **No retry/backoff**; transport failures map to `Error::Unavailable`,
//!   non-2xx responses to `Error::Storage`, and that is the whole story.
//! * There is no Firestore-backed `VectorStore`.
//!
//! [Firestore REST API]: https://firebase.google.com/docs/firestore/use-rest-api
//! [`MemoryStore`]: rustra_storage::MemoryStore
//! [`WorkflowStore`]: rustra_storage::WorkflowStore
//! [`DefinitionStore`]: rustra_storage::DefinitionStore
//! [`AclStore`]: rustra_storage::AclStore
//! [`TaskStore`]: rustra_storage::TaskStore
//! [`ObservabilityStore`]: rustra_storage::ObservabilityStore
//! [`InfraStore`]: rustra_storage::InfraStore

mod codecs;
pub(crate) mod firestore;
mod queries;
mod rest;
mod stores;

/// Firestore collection names, one per record type (`rustra_<domain>`).
pub(crate) mod coll {
    pub(crate) const THREADS: &str = "rustra_threads";
    pub(crate) const MESSAGES: &str = "rustra_messages";
    pub(crate) const RESOURCES: &str = "rustra_resources";
    pub(crate) const WORKFLOW_SNAPSHOTS: &str = "rustra_workflow_snapshots";
    pub(crate) const TASKS: &str = "rustra_tasks";
    pub(crate) const SCHEDULES: &str = "rustra_schedules";
    pub(crate) const SUBSCRIPTIONS: &str = "rustra_subscriptions";
    pub(crate) const DECISIONS: &str = "rustra_decisions";
    pub(crate) const DEFINITIONS: &str = "rustra_definitions";
    pub(crate) const USERS: &str = "rustra_users";
    pub(crate) const GRANTS: &str = "rustra_grants";
}

/// How requests authenticate against the Firestore REST API.
#[derive(Clone)]
pub enum AuthMode {
    /// Web API key appended as the `key` query parameter. Only useful with
    /// open security rules or the emulator.
    ApiKey(String),
    /// OAuth2 / service-account access token sent as a `Bearer`
    /// authorization header. Token refresh is the caller's responsibility.
    BearerToken(String),
}

impl std::fmt::Debug for AuthMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ApiKey(_) => f.write_str("ApiKey(<redacted>)"),
            Self::BearerToken(_) => f.write_str("BearerToken(<redacted>)"),
        }
    }
}

/// Configuration for [`FirebaseStorage`].
#[derive(Debug, Clone)]
pub struct FirebaseConfig {
    /// The Firebase / GCP project id.
    pub project_id: String,
    /// Request authentication mode.
    pub auth: AuthMode,
    /// Override the API base URL, e.g. `http://localhost:8080/v1` for the
    /// Firestore emulator. Defaults to `https://firestore.googleapis.com/v1`.
    pub base_url: Option<String>,
}

/// The experimental Firestore storage backend. See the crate docs for the
/// precise implemented/stubbed scope and tech-debt notes.
pub struct FirebaseStorage {
    pub(crate) rest: rest::RestClient,
}

impl FirebaseStorage {
    /// Build a storage handle from `config`. Cheap; no network I/O happens
    /// until the first store call.
    pub fn new(config: FirebaseConfig) -> Self {
        Self {
            rest: rest::RestClient::new(config),
        }
    }
}
