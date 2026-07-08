//! Record ⇄ Firestore-document codecs for the implemented domains.
//!
//! Field names match the record struct fields; timestamps are stored as real
//! `timestampValue`s so server-side `orderBy`/range filters are
//! chronological, and open-ended JSON payloads go through the generic value
//! codec in [`crate::firestore`].

use rustra_core::{Error, ResourceKind, Result, Visibility};
use rustra_storage::types::{
    DecisionRecord, DefinitionRecord, GrantRecord, ResourceRecord, ScheduleRecord, StoredMessage,
    SubscriptionRecord, TaskRecord, Thread, UserRecord, WorkflowSnapshot,
};
use serde_json::Value;

use crate::firestore::{Fields, FieldsReader};

pub(crate) fn kind_to_str(kind: ResourceKind) -> &'static str {
    kind.as_str()
}

pub(crate) fn kind_from_str(s: &str) -> Result<ResourceKind> {
    serde_json::from_value(Value::String(s.to_owned()))
        .map_err(|e| Error::Storage(format!("invalid resource kind `{s}`: {e}")))
}

pub(crate) fn vis_to_str(v: Visibility) -> &'static str {
    match v {
        Visibility::Private => "private",
        Visibility::Shared => "shared",
        Visibility::Public => "public",
    }
}

pub(crate) fn vis_from_str(s: &str) -> Result<Visibility> {
    match s {
        "private" => Ok(Visibility::Private),
        "shared" => Ok(Visibility::Shared),
        "public" => Ok(Visibility::Public),
        other => Err(Error::Storage(format!("invalid visibility `{other}`"))),
    }
}

/// Document id for a definition version. Definitions are keyed by
/// `(kind, id, version)`, so the document id composes all three. Record ids
/// must not contain `/` (Firestore path separator).
pub(crate) fn definition_doc_id(kind: ResourceKind, id: &str, version: u32) -> String {
    format!("{}__{}__v{}", kind.as_str(), id, version)
}

// ---------------------------------------------------------------------------
// Memory domain
// ---------------------------------------------------------------------------

pub(crate) fn thread_to_doc(t: &Thread) -> Value {
    let mut f = Fields::new();
    f.set_str("id", &t.id);
    f.set_str("resource_id", &t.resource_id);
    f.set_opt_str("title", t.title.as_deref());
    f.set_json("metadata", &t.metadata);
    f.set_ts("created_at", t.created_at);
    f.set_ts("updated_at", t.updated_at);
    f.into_document()
}

pub(crate) fn thread_from_doc(doc: &Value) -> Result<Thread> {
    let r = FieldsReader::from_document(doc)?;
    Ok(Thread {
        id: r.get_str("id")?,
        resource_id: r.get_str("resource_id")?,
        title: r.get_opt_str("title")?,
        metadata: r.get_json("metadata")?,
        created_at: r.get_ts("created_at")?,
        updated_at: r.get_ts("updated_at")?,
    })
}

pub(crate) fn message_to_doc(m: &StoredMessage) -> Value {
    let mut f = Fields::new();
    f.set_str("id", &m.id);
    f.set_str("thread_id", &m.thread_id);
    f.set_str("resource_id", &m.resource_id);
    f.set_str("role", &m.role);
    f.set_json("content", &m.content);
    f.set_ts("created_at", m.created_at);
    f.into_document()
}

pub(crate) fn message_from_doc(doc: &Value) -> Result<StoredMessage> {
    let r = FieldsReader::from_document(doc)?;
    Ok(StoredMessage {
        id: r.get_str("id")?,
        thread_id: r.get_str("thread_id")?,
        resource_id: r.get_str("resource_id")?,
        role: r.get_str("role")?,
        content: r.get_json("content")?,
        created_at: r.get_ts("created_at")?,
    })
}

pub(crate) fn resource_to_doc(res: &ResourceRecord) -> Value {
    let mut f = Fields::new();
    f.set_str("id", &res.id);
    f.set_opt_str("working_memory", res.working_memory.as_deref());
    f.set_json("metadata", &res.metadata);
    f.set_ts("updated_at", res.updated_at);
    f.into_document()
}

pub(crate) fn resource_from_doc(doc: &Value) -> Result<ResourceRecord> {
    let r = FieldsReader::from_document(doc)?;
    Ok(ResourceRecord {
        id: r.get_str("id")?,
        working_memory: r.get_opt_str("working_memory")?,
        metadata: r.get_json("metadata")?,
        updated_at: r.get_ts("updated_at")?,
    })
}

// ---------------------------------------------------------------------------
// Workflow domain
// ---------------------------------------------------------------------------

pub(crate) fn snapshot_to_doc(s: &WorkflowSnapshot) -> Value {
    let mut f = Fields::new();
    f.set_str("run_id", &s.run_id);
    f.set_str("workflow_id", &s.workflow_id);
    f.set_str("resource_id", &s.resource_id);
    f.set_str("status", &s.status);
    f.set_json("snapshot", &s.snapshot);
    f.set_ts("created_at", s.created_at);
    f.set_ts("updated_at", s.updated_at);
    f.into_document()
}

pub(crate) fn snapshot_from_doc(doc: &Value) -> Result<WorkflowSnapshot> {
    let r = FieldsReader::from_document(doc)?;
    Ok(WorkflowSnapshot {
        run_id: r.get_str("run_id")?,
        workflow_id: r.get_str("workflow_id")?,
        resource_id: r.get_str("resource_id")?,
        status: r.get_str("status")?,
        snapshot: r.get_json("snapshot")?,
        created_at: r.get_ts("created_at")?,
        updated_at: r.get_ts("updated_at")?,
    })
}

// ---------------------------------------------------------------------------
// Task domain
// ---------------------------------------------------------------------------

pub(crate) fn task_to_doc(t: &TaskRecord) -> Value {
    let mut f = Fields::new();
    f.set_str("id", &t.id);
    f.set_str("user_id", &t.user_id);
    f.set_str("trigger", &t.trigger);
    f.set_json("spec", &t.spec);
    f.set_str("status", &t.status);
    f.set_u32("attempts", t.attempts);
    f.set_u32("max_retries", t.max_retries);
    f.set_opt_str("last_error", t.last_error.as_deref());
    f.set_json("output", &t.output);
    f.set_opt_str("run_id", t.run_id.as_deref());
    f.set_opt_str("schedule_id", t.schedule_id.as_deref());
    f.set_ts("created_at", t.created_at);
    f.set_opt_ts("started_at", t.started_at);
    f.set_opt_ts("ended_at", t.ended_at);
    f.into_document()
}

pub(crate) fn task_from_doc(doc: &Value) -> Result<TaskRecord> {
    let r = FieldsReader::from_document(doc)?;
    Ok(TaskRecord {
        id: r.get_str("id")?,
        user_id: r.get_str("user_id")?,
        trigger: r.get_str("trigger")?,
        spec: r.get_json("spec")?,
        status: r.get_str("status")?,
        attempts: r.get_u32("attempts")?,
        max_retries: r.get_u32("max_retries")?,
        last_error: r.get_opt_str("last_error")?,
        output: r.get_json("output")?,
        run_id: r.get_opt_str("run_id")?,
        schedule_id: r.get_opt_str("schedule_id")?,
        created_at: r.get_ts("created_at")?,
        started_at: r.get_opt_ts("started_at")?,
        ended_at: r.get_opt_ts("ended_at")?,
    })
}

pub(crate) fn schedule_to_doc(s: &ScheduleRecord) -> Value {
    let mut f = Fields::new();
    f.set_str("id", &s.id);
    f.set_str("user_id", &s.user_id);
    f.set_str("name", &s.name);
    f.set_str("cron", &s.cron);
    f.set_opt_str("timezone", s.timezone.as_deref());
    f.set_json("spec", &s.spec);
    f.set_bool("enabled", s.enabled);
    f.set_opt_ts("next_run_at", s.next_run_at);
    f.set_opt_ts("last_run_at", s.last_run_at);
    f.set_ts("created_at", s.created_at);
    f.into_document()
}

pub(crate) fn schedule_from_doc(doc: &Value) -> Result<ScheduleRecord> {
    let r = FieldsReader::from_document(doc)?;
    Ok(ScheduleRecord {
        id: r.get_str("id")?,
        user_id: r.get_str("user_id")?,
        name: r.get_str("name")?,
        cron: r.get_str("cron")?,
        timezone: r.get_opt_str("timezone")?,
        spec: r.get_json("spec")?,
        enabled: r.get_bool("enabled")?,
        next_run_at: r.get_opt_ts("next_run_at")?,
        last_run_at: r.get_opt_ts("last_run_at")?,
        created_at: r.get_ts("created_at")?,
    })
}

pub(crate) fn subscription_to_doc(s: &SubscriptionRecord) -> Value {
    let mut f = Fields::new();
    f.set_str("id", &s.id);
    f.set_str("user_id", &s.user_id);
    f.set_str("event_name", &s.event_name);
    f.set_json("spec", &s.spec);
    f.set_bool("enabled", s.enabled);
    f.set_ts("created_at", s.created_at);
    f.into_document()
}

pub(crate) fn subscription_from_doc(doc: &Value) -> Result<SubscriptionRecord> {
    let r = FieldsReader::from_document(doc)?;
    Ok(SubscriptionRecord {
        id: r.get_str("id")?,
        user_id: r.get_str("user_id")?,
        event_name: r.get_str("event_name")?,
        spec: r.get_json("spec")?,
        enabled: r.get_bool("enabled")?,
        created_at: r.get_ts("created_at")?,
    })
}

pub(crate) fn decision_to_doc(d: &DecisionRecord) -> Value {
    let mut f = Fields::new();
    f.set_str("id", &d.id);
    f.set_str("user_id", &d.user_id);
    f.set_str("run_id", &d.run_id);
    f.set_str("kind", &d.kind);
    f.set_str("prompt", &d.prompt);
    f.set_json("payload", &d.payload);
    f.set_str("status", &d.status);
    f.set_json("resolution", &d.resolution);
    f.set_ts("created_at", d.created_at);
    f.set_opt_ts("resolved_at", d.resolved_at);
    f.into_document()
}

pub(crate) fn decision_from_doc(doc: &Value) -> Result<DecisionRecord> {
    let r = FieldsReader::from_document(doc)?;
    Ok(DecisionRecord {
        id: r.get_str("id")?,
        user_id: r.get_str("user_id")?,
        run_id: r.get_str("run_id")?,
        kind: r.get_str("kind")?,
        prompt: r.get_str("prompt")?,
        payload: r.get_json("payload")?,
        status: r.get_str("status")?,
        resolution: r.get_json("resolution")?,
        created_at: r.get_ts("created_at")?,
        resolved_at: r.get_opt_ts("resolved_at")?,
    })
}

// ---------------------------------------------------------------------------
// Definitions domain
// ---------------------------------------------------------------------------

pub(crate) fn definition_to_doc(d: &DefinitionRecord) -> Value {
    let mut f = Fields::new();
    f.set_str("id", &d.id);
    f.set_str("kind", kind_to_str(d.kind));
    f.set_str("owner_id", &d.owner_id);
    f.set_str("name", &d.name);
    f.set_u32("version", d.version);
    f.set_json("spec", &d.spec);
    f.set_str("visibility", vis_to_str(d.visibility));
    f.set_bool("latest", d.latest);
    f.set_ts("created_at", d.created_at);
    f.into_document()
}

pub(crate) fn definition_from_doc(doc: &Value) -> Result<DefinitionRecord> {
    let r = FieldsReader::from_document(doc)?;
    Ok(DefinitionRecord {
        id: r.get_str("id")?,
        kind: kind_from_str(&r.get_str("kind")?)?,
        owner_id: r.get_str("owner_id")?,
        name: r.get_str("name")?,
        version: r.get_u32("version")?,
        spec: r.get_json("spec")?,
        visibility: vis_from_str(&r.get_str("visibility")?)?,
        latest: r.get_bool("latest")?,
        created_at: r.get_ts("created_at")?,
    })
}

// ---------------------------------------------------------------------------
// ACL domain
// ---------------------------------------------------------------------------

pub(crate) fn user_to_doc(u: &UserRecord) -> Value {
    let mut f = Fields::new();
    f.set_str("id", &u.id);
    f.set_str("display_name", &u.display_name);
    f.set_string_list("roles", &u.roles);
    f.set_opt_str("token_hash", u.token_hash.as_deref());
    f.set_json("profile", &u.profile);
    f.set_ts("created_at", u.created_at);
    f.into_document()
}

pub(crate) fn user_from_doc(doc: &Value) -> Result<UserRecord> {
    let r = FieldsReader::from_document(doc)?;
    Ok(UserRecord {
        id: r.get_str("id")?,
        display_name: r.get_str("display_name")?,
        roles: r.get_string_list("roles")?,
        token_hash: r.get_opt_str("token_hash")?,
        profile: r.get_json("profile")?,
        created_at: r.get_ts("created_at")?,
    })
}

pub(crate) fn grant_to_doc(g: &GrantRecord) -> Value {
    let mut f = Fields::new();
    f.set_str("id", &g.id);
    f.set_str("resource_kind", kind_to_str(g.resource_kind));
    f.set_str("resource_id", &g.resource_id);
    f.set_str("grantee", &g.grantee);
    f.set_string_list("actions", &g.actions);
    f.set_str("granted_by", &g.granted_by);
    f.set_ts("created_at", g.created_at);
    f.into_document()
}

pub(crate) fn grant_from_doc(doc: &Value) -> Result<GrantRecord> {
    let r = FieldsReader::from_document(doc)?;
    Ok(GrantRecord {
        id: r.get_str("id")?,
        resource_kind: kind_from_str(&r.get_str("resource_kind")?)?,
        resource_id: r.get_str("resource_id")?,
        grantee: r.get_str("grantee")?,
        actions: r.get_string_list("actions")?,
        granted_by: r.get_str("granted_by")?,
        created_at: r.get_ts("created_at")?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Utc};
    use serde_json::json;

    fn ts(secs: u32) -> chrono::DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 5, 6, 7, 8, secs).unwrap()
    }

    #[test]
    fn thread_roundtrips_with_and_without_title() {
        for title in [None, Some("hello".to_string())] {
            let thread = Thread {
                id: "thr_1".into(),
                resource_id: "user-1".into(),
                title,
                metadata: json!({"pinned": true, "tags": ["a", "b"]}),
                created_at: ts(1),
                updated_at: ts(2),
            };
            let doc = thread_to_doc(&thread);
            assert_eq!(thread_from_doc(&doc).unwrap(), thread);
        }
    }

    #[test]
    fn message_roundtrips() {
        let message = StoredMessage {
            id: "m1".into(),
            thread_id: "thr_1".into(),
            resource_id: "user-1".into(),
            role: "assistant".into(),
            content: json!([{"type": "text", "text": "hi"}]),
            created_at: ts(3),
        };
        let doc = message_to_doc(&message);
        assert_eq!(message_from_doc(&doc).unwrap(), message);
        // Timestamps must be real timestampValues, not strings, so that
        // Firestore orderBy/range filters are chronological.
        assert!(doc["fields"]["created_at"]["timestampValue"].is_string());
    }

    #[test]
    fn schedule_roundtrips_optionals() {
        for next_run_at in [None, Some(ts(9))] {
            let schedule = ScheduleRecord {
                id: "sch_1".into(),
                user_id: "user-1".into(),
                name: "daily".into(),
                cron: "0 9 * * *".into(),
                timezone: Some("Europe/Berlin".into()),
                spec: json!({"target": "agent", "id": "a1"}),
                enabled: true,
                next_run_at,
                last_run_at: None,
                created_at: ts(4),
            };
            let doc = schedule_to_doc(&schedule);
            assert_eq!(schedule_from_doc(&doc).unwrap(), schedule);
        }
    }

    #[test]
    fn task_roundtrips() {
        let task = TaskRecord {
            id: "tsk_1".into(),
            user_id: "user-1".into(),
            trigger: "schedule".into(),
            spec: json!({"target": "workflow", "id": "w1", "input": {"n": 3}}),
            status: "running".into(),
            attempts: 2,
            max_retries: 5,
            last_error: Some("boom".into()),
            output: json!(null),
            run_id: None,
            schedule_id: Some("sch_1".into()),
            created_at: ts(1),
            started_at: Some(ts(2)),
            ended_at: None,
        };
        let doc = task_to_doc(&task);
        assert_eq!(task_from_doc(&doc).unwrap(), task);
    }

    #[test]
    fn definition_roundtrips_enums() {
        let def = DefinitionRecord {
            id: "my-skill".into(),
            kind: ResourceKind::Skill,
            owner_id: "user-1".into(),
            name: "My Skill".into(),
            version: 3,
            spec: json!({"a": 1}),
            visibility: Visibility::Shared,
            latest: true,
            created_at: ts(5),
        };
        let doc = definition_to_doc(&def);
        assert_eq!(definition_from_doc(&doc).unwrap(), def);
        assert_eq!(doc["fields"]["kind"], json!({"stringValue": "skill"}));
        assert_eq!(doc["fields"]["visibility"], json!({"stringValue": "shared"}));
        assert_eq!(doc["fields"]["version"], json!({"integerValue": "3"}));
    }

    #[test]
    fn definition_doc_ids_compose_kind_id_version() {
        assert_eq!(
            definition_doc_id(ResourceKind::Skill, "my-skill", 3),
            "skill__my-skill__v3"
        );
    }

    #[test]
    fn user_and_grant_roundtrip_string_lists() {
        let user = UserRecord {
            id: "user-1".into(),
            display_name: "Ada".into(),
            roles: vec!["admin".into(), "member".into()],
            token_hash: Some("abc123".into()),
            profile: json!({"theme": "dark"}),
            created_at: ts(6),
        };
        assert_eq!(user_from_doc(&user_to_doc(&user)).unwrap(), user);

        let grant = GrantRecord {
            id: "grt_1".into(),
            resource_kind: ResourceKind::Agent,
            resource_id: "agent-1".into(),
            grantee: "role:member".into(),
            actions: vec!["read".into(), "execute".into()],
            granted_by: "user-1".into(),
            created_at: ts(7),
        };
        assert_eq!(grant_from_doc(&grant_to_doc(&grant)).unwrap(), grant);
    }

    #[test]
    fn snapshot_decision_subscription_resource_roundtrip() {
        let snapshot = WorkflowSnapshot {
            run_id: "run_1".into(),
            workflow_id: "wf_1".into(),
            resource_id: "user-1".into(),
            status: "suspended".into(),
            snapshot: json!({"cursor": 2, "steps": {"a": {"ok": true}}}),
            created_at: ts(1),
            updated_at: ts(2),
        };
        assert_eq!(snapshot_from_doc(&snapshot_to_doc(&snapshot)).unwrap(), snapshot);

        let decision = DecisionRecord {
            id: "dec_1".into(),
            user_id: "user-1".into(),
            run_id: "run_1".into(),
            kind: "approval".into(),
            prompt: "Deploy?".into(),
            payload: json!(["yes", "no"]),
            status: "pending".into(),
            resolution: json!(null),
            created_at: ts(3),
            resolved_at: None,
        };
        assert_eq!(decision_from_doc(&decision_to_doc(&decision)).unwrap(), decision);

        let sub = SubscriptionRecord {
            id: "sub_1".into(),
            user_id: "user-1".into(),
            event_name: "webhook.github.*".into(),
            spec: json!({"target": "agent", "id": "a1"}),
            enabled: false,
            created_at: ts(4),
        };
        assert_eq!(subscription_from_doc(&subscription_to_doc(&sub)).unwrap(), sub);

        let resource = ResourceRecord {
            id: "user-1".into(),
            working_memory: Some("# Notes".into()),
            metadata: json!(null),
            updated_at: ts(5),
        };
        assert_eq!(resource_from_doc(&resource_to_doc(&resource)).unwrap(), resource);
    }
}
