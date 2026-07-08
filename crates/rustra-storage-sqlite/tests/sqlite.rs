//! Integration tests for the SQLite backend: the shared conformance
//! specification plus persistence and vector-store coverage.

use chrono::Utc;
use serde_json::json;

use rustra_storage::conformance;
use rustra_storage::types::{ScheduleRecord, StoredMessage, Thread};
use rustra_storage::{Embedder, MemoryStore, MockEmbedder, TaskStore, VectorStore};
use rustra_storage_sqlite::{SqliteStorage, SqliteVectorStore};

#[tokio::test]
async fn thread_and_message_roundtrip() {
    conformance::thread_and_message_roundtrip(&SqliteStorage::in_memory().unwrap()).await;
}

#[tokio::test]
async fn definitions_version_monotonically() {
    conformance::definitions_version_monotonically(&SqliteStorage::in_memory().unwrap()).await;
}

#[tokio::test]
async fn shared_definitions_visible_to_others() {
    conformance::shared_definitions_visible_to_others(&SqliteStorage::in_memory().unwrap()).await;
}

#[tokio::test]
async fn due_schedules_filters_on_enabled_and_next_run() {
    let store = SqliteStorage::in_memory().unwrap();
    let now = Utc::now();
    let mk = |id: &str, enabled: bool, due_offset_secs: Option<i64>| ScheduleRecord {
        id: id.into(),
        user_id: "user-1".into(),
        name: id.into(),
        cron: "* * * * *".into(),
        timezone: None,
        spec: json!({}),
        enabled,
        next_run_at: due_offset_secs.map(|s| now + chrono::Duration::seconds(s)),
        last_run_at: None,
        created_at: now,
    };
    store
        .upsert_schedule(mk("due", true, Some(-60)))
        .await
        .unwrap();
    store
        .upsert_schedule(mk("future", true, Some(60)))
        .await
        .unwrap();
    store
        .upsert_schedule(mk("disabled", false, Some(-60)))
        .await
        .unwrap();
    store
        .upsert_schedule(mk("unscheduled", true, None))
        .await
        .unwrap();

    let due = store.due_schedules(now).await.unwrap();
    assert_eq!(due.len(), 1);
    assert_eq!(due[0].id, "due");
}

#[tokio::test]
async fn similar_text_ranks_higher() {
    let store = SqliteVectorStore::in_memory().unwrap();
    let embedder = MockEmbedder::default();
    store
        .create_index("msgs", embedder.dimension())
        .await
        .unwrap();

    let texts = vec![
        "the deployment pipeline failed on kubernetes".to_string(),
        "my cat likes tuna and sleeping in the sun".to_string(),
    ];
    let vectors = embedder.embed(&texts).await.unwrap();
    store
        .upsert(
            "msgs",
            vectors
                .into_iter()
                .enumerate()
                .map(|(i, v)| (format!("m{i}"), v, json!({"i": i})))
                .collect(),
        )
        .await
        .unwrap();

    let q = embedder
        .embed(&["kubernetes deployment failure".to_string()])
        .await
        .unwrap();
    let hits = store.query("msgs", &q[0], 1).await.unwrap();
    assert_eq!(hits[0].id, "m0");
}

#[tokio::test]
async fn data_survives_reopening_the_file() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("rustra.db");

    let thread = Thread {
        id: "thr_1".into(),
        resource_id: "user-1".into(),
        title: Some("hello".into()),
        metadata: json!({"pinned": true}),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    let message = StoredMessage {
        id: "m1".into(),
        thread_id: "thr_1".into(),
        resource_id: "user-1".into(),
        role: "user".into(),
        content: json!([{"type": "text", "text": "hi"}]),
        created_at: Utc::now(),
    };

    {
        let store = SqliteStorage::open(&path).unwrap();
        store.create_thread(thread.clone()).await.unwrap();
        store.append_message(message.clone()).await.unwrap();
    }

    let reopened = SqliteStorage::open(&path).unwrap();
    let read_back = reopened.get_thread("thr_1").await.unwrap().unwrap();
    assert_eq!(read_back, thread);
    let messages = reopened.recent_messages("thr_1", 10).await.unwrap();
    assert_eq!(messages, vec![message]);
}
