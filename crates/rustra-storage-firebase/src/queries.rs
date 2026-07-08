//! `structuredQuery` bodies for every filtered/ordered store method.
//!
//! Kept as standalone functions so the exact JSON shapes sent to
//! `documents:runQuery` can be unit-tested without a network.

use chrono::{DateTime, Utc};
use rustra_core::ResourceKind;
use rustra_storage::Page;
use serde_json::Value;

use crate::coll;
use crate::firestore::{
    and, bool_value, field_eq, field_filter, field_in, or, str_value, timestamp_value,
    StructuredQuery,
};

// ---------------------------------------------------------------------------
// Memory domain
// ---------------------------------------------------------------------------

pub(crate) fn list_threads(resource_id: &str, page: Page) -> Value {
    StructuredQuery::collection(coll::THREADS)
        .filter(and(vec![field_eq("resource_id", str_value(resource_id))]))
        .order_by("updated_at", true)
        .page(page)
        .build()
}

/// The newest `limit` messages of a thread (callers reverse the result into
/// chronological order).
pub(crate) fn recent_messages(thread_id: &str, limit: usize) -> Value {
    StructuredQuery::collection(coll::MESSAGES)
        .filter(and(vec![field_eq("thread_id", str_value(thread_id))]))
        .order_by("created_at", true)
        .limit(limit)
        .build()
}

/// All messages of a thread (for the `delete_thread` cascade).
pub(crate) fn messages_in_thread(thread_id: &str) -> Value {
    StructuredQuery::collection(coll::MESSAGES)
        .filter(and(vec![field_eq("thread_id", str_value(thread_id))]))
        .build()
}

// ---------------------------------------------------------------------------
// Workflow domain
// ---------------------------------------------------------------------------

pub(crate) fn list_snapshots(
    resource_id: &str,
    workflow_id: Option<&str>,
    status: Option<&str>,
    page: Page,
) -> Value {
    let mut filters = vec![field_eq("resource_id", str_value(resource_id))];
    if let Some(workflow_id) = workflow_id {
        filters.push(field_eq("workflow_id", str_value(workflow_id)));
    }
    if let Some(status) = status {
        filters.push(field_eq("status", str_value(status)));
    }
    StructuredQuery::collection(coll::WORKFLOW_SNAPSHOTS)
        .filter(and(filters))
        .order_by("updated_at", true)
        .page(page)
        .build()
}

// ---------------------------------------------------------------------------
// Task domain
// ---------------------------------------------------------------------------

pub(crate) fn list_tasks(user_id: &str, status: Option<&str>, page: Page) -> Value {
    let mut filters = vec![field_eq("user_id", str_value(user_id))];
    if let Some(status) = status {
        filters.push(field_eq("status", str_value(status)));
    }
    StructuredQuery::collection(coll::TASKS)
        .filter(and(filters))
        .order_by("created_at", true)
        .page(page)
        .build()
}

pub(crate) fn list_schedules(user_id: Option<&str>, page: Page) -> Value {
    let filters = user_id
        .map(|u| vec![field_eq("user_id", str_value(u))])
        .unwrap_or_default();
    StructuredQuery::collection(coll::SCHEDULES)
        .filter(and(filters))
        .order_by("created_at", true)
        .page(page)
        .build()
}

/// Enabled schedules with `next_run_at <= now`. Firestore range filters only
/// match values of the compared type, so `next_run_at = null` rows are
/// excluded automatically; the inequality field must be the first `orderBy`.
pub(crate) fn due_schedules(now: DateTime<Utc>) -> Value {
    StructuredQuery::collection(coll::SCHEDULES)
        .filter(and(vec![
            field_eq("enabled", bool_value(true)),
            field_filter("next_run_at", "LESS_THAN_OR_EQUAL", timestamp_value(now)),
        ]))
        .order_by("next_run_at", false)
        .build()
}

pub(crate) fn list_subscriptions(user_id: Option<&str>, page: Page) -> Value {
    let filters = user_id
        .map(|u| vec![field_eq("user_id", str_value(u))])
        .unwrap_or_default();
    StructuredQuery::collection(coll::SUBSCRIPTIONS)
        .filter(and(filters))
        .order_by("created_at", true)
        .page(page)
        .build()
}

pub(crate) fn list_decisions(user_id: &str, pending_only: bool, page: Page) -> Value {
    let mut filters = vec![field_eq("user_id", str_value(user_id))];
    if pending_only {
        filters.push(field_eq("status", str_value("pending")));
    }
    StructuredQuery::collection(coll::DECISIONS)
        .filter(and(filters))
        .order_by("created_at", true)
        .page(page)
        .build()
}

// ---------------------------------------------------------------------------
// Definitions domain
// ---------------------------------------------------------------------------

fn definition_key_filters(kind: ResourceKind, id: &str) -> Vec<Value> {
    vec![field_eq("kind", str_value(kind.as_str())), field_eq("id", str_value(id))]
}

/// The current latest version of one definition (`limit 1`).
pub(crate) fn latest_definition(kind: ResourceKind, id: &str) -> Value {
    let mut filters = definition_key_filters(kind, id);
    filters.push(field_eq("latest", bool_value(true)));
    StructuredQuery::collection(coll::DEFINITIONS)
        .filter(and(filters))
        .limit(1)
        .build()
}

/// All versions currently flagged `latest` (demoted during `put_definition`).
pub(crate) fn latest_definition_flags(kind: ResourceKind, id: &str) -> Value {
    let mut filters = definition_key_filters(kind, id);
    filters.push(field_eq("latest", bool_value(true)));
    StructuredQuery::collection(coll::DEFINITIONS).filter(and(filters)).build()
}

/// The highest version of a definition (`orderBy version desc, limit 1`).
pub(crate) fn max_definition_version(kind: ResourceKind, id: &str) -> Value {
    StructuredQuery::collection(coll::DEFINITIONS)
        .filter(and(definition_key_filters(kind, id)))
        .order_by("version", true)
        .limit(1)
        .build()
}

/// Every version of a definition (for `delete_definition`).
pub(crate) fn definition_versions(kind: ResourceKind, id: &str) -> Value {
    StructuredQuery::collection(coll::DEFINITIONS)
        .filter(and(definition_key_filters(kind, id)))
        .build()
}

/// Latest definitions owned by `owner_id`, optionally including
/// shared/public ones from other owners (uses an `OR` composite filter —
/// requires a recent Firestore API).
pub(crate) fn list_definitions(
    kind: ResourceKind,
    owner_id: &str,
    include_shared: bool,
    page: Page,
) -> Value {
    let mut filters = vec![
        field_eq("kind", str_value(kind.as_str())),
        field_eq("latest", bool_value(true)),
    ];
    if include_shared {
        filters.push(
            or(vec![
                field_eq("owner_id", str_value(owner_id)),
                field_in("visibility", vec![str_value("shared"), str_value("public")]),
            ])
            .expect("two filters"),
        );
    } else {
        filters.push(field_eq("owner_id", str_value(owner_id)));
    }
    StructuredQuery::collection(coll::DEFINITIONS)
        .filter(and(filters))
        .order_by("created_at", true)
        .page(page)
        .build()
}

// ---------------------------------------------------------------------------
// ACL domain
// ---------------------------------------------------------------------------

pub(crate) fn find_user_by_token_hash(token_hash: &str) -> Value {
    StructuredQuery::collection(coll::USERS)
        .filter(and(vec![field_eq("token_hash", str_value(token_hash))]))
        .limit(1)
        .build()
}

pub(crate) fn list_users(page: Page) -> Value {
    StructuredQuery::collection(coll::USERS)
        .order_by("created_at", false)
        .page(page)
        .build()
}

pub(crate) fn grants_for_resource(kind: ResourceKind, resource_id: &str) -> Value {
    StructuredQuery::collection(coll::GRANTS)
        .filter(and(vec![
            field_eq("resource_kind", str_value(kind.as_str())),
            field_eq("resource_id", str_value(resource_id)),
        ]))
        .order_by("created_at", false)
        .build()
}

pub(crate) fn grants_for_grantee(grantee: &str) -> Value {
    StructuredQuery::collection(coll::GRANTS)
        .filter(and(vec![field_eq("grantee", str_value(grantee))]))
        .order_by("created_at", false)
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use serde_json::json;

    #[test]
    fn due_schedules_query_shape() {
        let now = Utc.with_ymd_and_hms(2026, 1, 2, 3, 4, 5).unwrap();
        assert_eq!(
            due_schedules(now),
            json!({
                "structuredQuery": {
                    "from": [{"collectionId": "rustra_schedules"}],
                    "where": {"compositeFilter": {"op": "AND", "filters": [
                        {"fieldFilter": {
                            "field": {"fieldPath": "enabled"},
                            "op": "EQUAL",
                            "value": {"booleanValue": true},
                        }},
                        {"fieldFilter": {
                            "field": {"fieldPath": "next_run_at"},
                            "op": "LESS_THAN_OR_EQUAL",
                            "value": {"timestampValue": "2026-01-02T03:04:05.000000000Z"},
                        }},
                    ]}},
                    "orderBy": [
                        {"field": {"fieldPath": "next_run_at"}, "direction": "ASCENDING"},
                    ],
                }
            })
        );
    }

    #[test]
    fn list_threads_query_shape() {
        assert_eq!(
            list_threads("user-1", Page::new(20, 40)),
            json!({
                "structuredQuery": {
                    "from": [{"collectionId": "rustra_threads"}],
                    "where": {"fieldFilter": {
                        "field": {"fieldPath": "resource_id"},
                        "op": "EQUAL",
                        "value": {"stringValue": "user-1"},
                    }},
                    "orderBy": [
                        {"field": {"fieldPath": "updated_at"}, "direction": "DESCENDING"},
                    ],
                    "limit": 20,
                    "offset": 40,
                }
            })
        );
    }

    #[test]
    fn list_tasks_adds_optional_status_filter() {
        let without = list_tasks("user-1", None, Page::default());
        assert!(without["structuredQuery"]["where"]["fieldFilter"].is_object());

        let with = list_tasks("user-1", Some("running"), Page::default());
        let filters = with["structuredQuery"]["where"]["compositeFilter"]["filters"]
            .as_array()
            .unwrap();
        assert_eq!(filters.len(), 2);
        assert_eq!(filters[1]["fieldFilter"]["field"]["fieldPath"], "status");
        assert_eq!(filters[1]["fieldFilter"]["value"], json!({"stringValue": "running"}));
    }

    #[test]
    fn list_schedules_without_user_has_no_where() {
        let q = list_schedules(None, Page::default());
        assert!(q["structuredQuery"].get("where").is_none());
        assert_eq!(q["structuredQuery"]["limit"], 100);
    }

    #[test]
    fn list_definitions_uses_or_for_shared_visibility() {
        let q = list_definitions(ResourceKind::Skill, "alice", true, Page::default());
        let filters = q["structuredQuery"]["where"]["compositeFilter"]["filters"]
            .as_array()
            .unwrap();
        assert_eq!(filters.len(), 3);
        assert_eq!(filters[0]["fieldFilter"]["value"], json!({"stringValue": "skill"}));
        assert_eq!(filters[1]["fieldFilter"]["field"]["fieldPath"], "latest");
        let or_filter = &filters[2]["compositeFilter"];
        assert_eq!(or_filter["op"], "OR");
        let branches = or_filter["filters"].as_array().unwrap();
        assert_eq!(branches[0]["fieldFilter"]["field"]["fieldPath"], "owner_id");
        assert_eq!(branches[1]["fieldFilter"]["op"], "IN");
        assert_eq!(
            branches[1]["fieldFilter"]["value"],
            json!({"arrayValue": {"values": [
                {"stringValue": "shared"},
                {"stringValue": "public"},
            ]}})
        );

        // Without include_shared the owner filter is a plain equality.
        let q = list_definitions(ResourceKind::Skill, "alice", false, Page::default());
        let filters = q["structuredQuery"]["where"]["compositeFilter"]["filters"]
            .as_array()
            .unwrap();
        assert_eq!(filters[2]["fieldFilter"]["field"]["fieldPath"], "owner_id");
    }

    #[test]
    fn find_user_by_token_hash_limits_to_one() {
        let q = find_user_by_token_hash("abc");
        assert_eq!(q["structuredQuery"]["limit"], 1);
        assert_eq!(
            q["structuredQuery"]["where"]["fieldFilter"]["field"]["fieldPath"],
            "token_hash"
        );
    }

    #[test]
    fn max_definition_version_orders_desc_limit_one() {
        let q = max_definition_version(ResourceKind::Agent, "a1");
        assert_eq!(q["structuredQuery"]["limit"], 1);
        assert_eq!(
            q["structuredQuery"]["orderBy"],
            json!([{"field": {"fieldPath": "version"}, "direction": "DESCENDING"}])
        );
    }
}
