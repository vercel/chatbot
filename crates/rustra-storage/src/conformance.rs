//! Test-support: executable specification checks every [`Storage`] backend
//! must pass.
//!
//! Each function asserts one slice of the storage contract against any
//! `dyn Storage`, so the in-memory reference tests and the backend
//! integration tests run the exact same assertions from a single source of
//! truth instead of hand-copied test bodies that drift apart.

use chrono::Utc;
use serde_json::json;

use rustra_core::{ResourceKind, Visibility};

use crate::traits::Storage;
use crate::types::{DefinitionRecord, StoredMessage, Thread};
use crate::Page;

/// Threads and messages round-trip: `recent_messages` returns the
/// chronological tail and `list_threads` scopes by resource.
pub async fn thread_and_message_roundtrip(store: &dyn Storage) {
    let thread = Thread::new("user-1");
    let thread_id = thread.id.clone();
    store.create_thread(thread).await.unwrap();

    for i in 0..5 {
        store
            .append_message(StoredMessage {
                id: format!("m{i}"),
                thread_id: thread_id.clone(),
                resource_id: "user-1".into(),
                role: "user".into(),
                content: json!([{"type": "text", "text": format!("msg {i}")}]),
                created_at: Utc::now() + chrono::Duration::seconds(i),
            })
            .await
            .unwrap();
    }

    let recent = store.recent_messages(&thread_id, 3).await.unwrap();
    assert_eq!(recent.len(), 3);
    assert_eq!(recent[0].id, "m2");
    assert_eq!(recent[2].id, "m4");

    assert_eq!(
        store
            .list_threads("user-1", Page::default())
            .await
            .unwrap()
            .len(),
        1
    );
    assert!(store
        .list_threads("user-2", Page::default())
        .await
        .unwrap()
        .is_empty());
}

/// `put_definition` assigns monotonically increasing versions and keeps
/// every version retrievable.
pub async fn definitions_version_monotonically(store: &dyn Storage) {
    let def = DefinitionRecord {
        id: "my-skill".into(),
        kind: ResourceKind::Skill,
        owner_id: "user-1".into(),
        name: "My Skill".into(),
        version: 0,
        spec: json!({"a": 1}),
        visibility: Visibility::Private,
        latest: false,
        created_at: Utc::now(),
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
        .get_definition(ResourceKind::Skill, "my-skill")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(latest.version, 2);
    assert_eq!(latest.spec["a"], 2);
    let old = store
        .get_definition_version(ResourceKind::Skill, "my-skill", 1)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(old.spec["a"], 1);
}

/// `list_definitions` with `include_shared` shows other owners' shared
/// definitions but never their private ones.
pub async fn shared_definitions_visible_to_others(store: &dyn Storage) {
    let mk = |id: &str, owner: &str, vis: Visibility| DefinitionRecord {
        id: id.into(),
        kind: ResourceKind::Knowledge,
        owner_id: owner.into(),
        name: id.into(),
        version: 0,
        spec: json!({}),
        visibility: vis,
        latest: false,
        created_at: Utc::now(),
    };
    store
        .put_definition(mk("private", "alice", Visibility::Private))
        .await
        .unwrap();
    store
        .put_definition(mk("shared", "alice", Visibility::Shared))
        .await
        .unwrap();

    let bob_sees = store
        .list_definitions(ResourceKind::Knowledge, "bob", true, Page::default())
        .await
        .unwrap();
    assert_eq!(bob_sees.len(), 1);
    assert_eq!(bob_sees[0].id, "shared");
}
