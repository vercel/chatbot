//! Integration tests for the Postgres backend, ported from the SQLite /
//! in-memory reference tests.
//!
//! These need a real Postgres server. Set `RUSTRA_PG_URL` (e.g.
//! `postgres://postgres:postgres@localhost:5432/rustra_test`) to run them;
//! when the variable is unset every test returns early (skips silently), so
//! `cargo test` stays green in environments without a database.
//!
//! The tests share one database and may run repeatedly against it, so all
//! ids/owners are freshly generated per run.

use chrono::{DateTime, Utc};
use serde_json::json;

use rustra_core::{new_id, ResourceKind, Visibility};
use rustra_storage::types::{DefinitionRecord, ScheduleRecord, StoredMessage, Thread};
use rustra_storage::{
    DefinitionStore, Embedder, MemoryStore, MockEmbedder, Page, TaskStore, VectorStore,
};
use rustra_storage_postgres::{PostgresStorage, PostgresVectorStore};

fn pg_url() -> Option<String> {
    std::env::var("RUSTRA_PG_URL")
        .ok()
        .filter(|url| !url.is_empty())
}

/// Postgres `TIMESTAMPTZ` stores microsecond precision, so equality
/// assertions must use microsecond-truncated timestamps.
fn now_micros() -> DateTime<Utc> {
    DateTime::from_timestamp_micros(Utc::now().timestamp_micros()).expect("valid timestamp")
}

#[tokio::test]
async fn thread_and_message_roundtrip() {
    let Some(url) = pg_url() else { return };
    let store = PostgresStorage::connect(&url).await.unwrap();

    let user = new_id("user");
    let thread = Thread::new(user.clone());
    let thread_id = thread.id.clone();
    store.create_thread(thread).await.unwrap();

    for i in 0..5 {
        store
            .append_message(StoredMessage {
                id: format!("{thread_id}_m{i}"),
                thread_id: thread_id.clone(),
                resource_id: user.clone(),
                role: "user".into(),
                content: json!([{"type": "text", "text": format!("msg {i}")}]),
                created_at: now_micros() + chrono::Duration::seconds(i),
            })
            .await
            .unwrap();
    }

    let recent = store.recent_messages(&thread_id, 3).await.unwrap();
    assert_eq!(recent.len(), 3);
    assert_eq!(recent[0].id, format!("{thread_id}_m2"));
    assert_eq!(recent[2].id, format!("{thread_id}_m4"));

    assert_eq!(
        store
            .list_threads(&user, Page::default())
            .await
            .unwrap()
            .len(),
        1
    );
    assert!(store
        .list_threads(&new_id("user"), Page::default())
        .await
        .unwrap()
        .is_empty());

    // Cascade: deleting the thread removes its messages.
    store.delete_thread(&thread_id).await.unwrap();
    assert!(store.get_thread(&thread_id).await.unwrap().is_none());
    assert!(store
        .recent_messages(&thread_id, 10)
        .await
        .unwrap()
        .is_empty());
}

#[tokio::test]
async fn definitions_version_monotonically() {
    let Some(url) = pg_url() else { return };
    let store = PostgresStorage::connect(&url).await.unwrap();

    let def_id = new_id("def");
    let def = DefinitionRecord {
        id: def_id.clone(),
        kind: ResourceKind::Skill,
        owner_id: new_id("user"),
        name: "My Skill".into(),
        version: 0,
        spec: json!({"a": 1}),
        visibility: Visibility::Private,
        latest: false,
        created_at: now_micros(),
    };
    let v1 = store.put_definition(def.clone()).await.unwrap();
    let v2 = store
        .put_definition(DefinitionRecord {
            spec: json!({"a": 2}),
            ..def
        })
        .await
        .unwrap();
    assert_eq!((v1.version, v2.version), (1, 2));

    let latest = store
        .get_definition(ResourceKind::Skill, &def_id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(latest.version, 2);
    assert!(latest.latest);
    assert_eq!(latest.spec["a"], 2);

    let old = store
        .get_definition_version(ResourceKind::Skill, &def_id, 1)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(old.spec["a"], 1);
    assert!(!old.latest);

    store
        .delete_definition(ResourceKind::Skill, &def_id)
        .await
        .unwrap();
    assert!(store
        .get_definition(ResourceKind::Skill, &def_id)
        .await
        .unwrap()
        .is_none());
}

#[tokio::test]
async fn shared_definitions_visible_to_others() {
    let Some(url) = pg_url() else { return };
    let store = PostgresStorage::connect(&url).await.unwrap();

    let alice = new_id("user");
    let bob = new_id("user");
    let mk = |id: &str, vis: Visibility| DefinitionRecord {
        id: id.to_owned(),
        kind: ResourceKind::Knowledge,
        owner_id: alice.clone(),
        name: id.to_owned(),
        version: 0,
        spec: json!({}),
        visibility: vis,
        latest: false,
        created_at: now_micros(),
    };
    let private_id = new_id("def");
    let shared_id = new_id("def");
    store
        .put_definition(mk(&private_id, Visibility::Private))
        .await
        .unwrap();
    store
        .put_definition(mk(&shared_id, Visibility::Shared))
        .await
        .unwrap();

    // Bob owns nothing, so only shared/public definitions are visible; other
    // tests may have populated the shared table, so filter to this run's ids.
    let bob_sees = store
        .list_definitions(ResourceKind::Knowledge, &bob, true, Page::default())
        .await
        .unwrap();
    assert!(bob_sees.iter().any(|d| d.id == shared_id));
    assert!(!bob_sees.iter().any(|d| d.id == private_id));

    store
        .delete_definition(ResourceKind::Knowledge, &private_id)
        .await
        .unwrap();
    store
        .delete_definition(ResourceKind::Knowledge, &shared_id)
        .await
        .unwrap();
}

#[tokio::test]
async fn due_schedules_filters_on_enabled_and_next_run() {
    let Some(url) = pg_url() else { return };
    let store = PostgresStorage::connect(&url).await.unwrap();

    let user = new_id("user");
    let now = now_micros();
    let mk = |name: &str, enabled: bool, due_offset_secs: Option<i64>| ScheduleRecord {
        id: format!("{user}_{name}"),
        user_id: user.clone(),
        name: name.to_owned(),
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

    // `due_schedules` is global (scheduler loop), so restrict assertions to
    // this run's schedules.
    let due: Vec<_> = store
        .due_schedules(now)
        .await
        .unwrap()
        .into_iter()
        .filter(|s| s.user_id == user)
        .collect();
    assert_eq!(due.len(), 1);
    assert_eq!(due[0].name, "due");

    for name in ["due", "future", "disabled", "unscheduled"] {
        store
            .delete_schedule(&format!("{user}_{name}"))
            .await
            .unwrap();
    }
}

#[tokio::test]
async fn data_survives_reconnecting() {
    let Some(url) = pg_url() else { return };

    let user = new_id("user");
    let thread_id = new_id("thr");
    let thread = Thread {
        id: thread_id.clone(),
        resource_id: user.clone(),
        title: Some("hello".into()),
        metadata: json!({"pinned": true}),
        created_at: now_micros(),
        updated_at: now_micros(),
    };
    let message = StoredMessage {
        id: format!("{thread_id}_m1"),
        thread_id: thread_id.clone(),
        resource_id: user,
        role: "user".into(),
        content: json!([{"type": "text", "text": "hi"}]),
        created_at: now_micros(),
    };

    {
        let store = PostgresStorage::connect(&url).await.unwrap();
        store.create_thread(thread.clone()).await.unwrap();
        store.append_message(message.clone()).await.unwrap();
    }

    let reopened = PostgresStorage::connect(&url).await.unwrap();
    let read_back = reopened.get_thread(&thread_id).await.unwrap().unwrap();
    assert_eq!(read_back, thread);
    let messages = reopened.recent_messages(&thread_id, 10).await.unwrap();
    assert_eq!(messages, vec![message]);

    reopened.delete_thread(&thread_id).await.unwrap();
}

#[tokio::test]
async fn similar_text_ranks_higher() {
    let Some(url) = pg_url() else { return };
    let store = PostgresVectorStore::connect(&url).await.unwrap();
    let embedder = MockEmbedder::default();

    let index = new_id("idx");
    store
        .create_index(&index, embedder.dimension())
        .await
        .unwrap();

    let texts = vec![
        "the deployment pipeline failed on kubernetes".to_string(),
        "my cat likes tuna and sleeping in the sun".to_string(),
    ];
    let vectors = embedder.embed(&texts).await.unwrap();
    store
        .upsert(
            &index,
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
    let hits = store.query(&index, &q[0], 1).await.unwrap();
    assert_eq!(hits[0].id, "m0");

    store.delete_index(&index).await.unwrap();
}
