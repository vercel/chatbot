//! Firestore document/value JSON encoding and `structuredQuery` builders.
//!
//! The REST API represents every field value as a single-key object naming
//! its type: `{"stringValue": "x"}`, `{"integerValue": "42"}` (note: the
//! integer payload is a **string**), `{"doubleValue": 2.5}`,
//! `{"booleanValue": true}`, `{"timestampValue": "2026-01-01T00:00:00Z"}`,
//! `{"mapValue": {"fields": {...}}}`, `{"arrayValue": {"values": [...]}}`,
//! and `{"nullValue": null}`.
//!
//! [`to_firestore_value`] / [`from_firestore_value`] convert arbitrary
//! `serde_json::Value` payloads (JSON payload columns), while [`Fields`] /
//! [`FieldsReader`] handle typed record fields (including real
//! `timestampValue` timestamps so server-side ordering and range filters are
//! chronological). [`StructuredQuery`] and the `field_*` helpers build
//! `runQuery` bodies.

use std::sync::OnceLock;

use chrono::{DateTime, SecondsFormat, Utc};
use rustra_core::{Error, Result};
use rustra_storage::Page;
use serde_json::{json, Map, Value};

fn codec_err(msg: impl Into<String>) -> Error {
    Error::Storage(msg.into())
}

// ---------------------------------------------------------------------------
// Value codec (arbitrary JSON payloads)
// ---------------------------------------------------------------------------

/// Encode an arbitrary JSON value as a Firestore document value.
///
/// Lossy corner: JSON `u64` integers above `i64::MAX` become `doubleValue`
/// (Firestore integers are signed 64-bit).
pub fn to_firestore_value(v: &Value) -> Value {
    match v {
        Value::Null => json!({"nullValue": null}),
        Value::Bool(b) => json!({"booleanValue": b}),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                json!({"integerValue": i.to_string()})
            } else {
                json!({"doubleValue": n.as_f64()})
            }
        }
        Value::String(s) => json!({"stringValue": s}),
        Value::Array(items) => {
            let values: Vec<Value> = items.iter().map(to_firestore_value).collect();
            json!({"arrayValue": {"values": values}})
        }
        Value::Object(map) => {
            let fields: Map<String, Value> = map
                .iter()
                .map(|(k, v)| (k.clone(), to_firestore_value(v)))
                .collect();
            json!({"mapValue": {"fields": fields}})
        }
    }
}

/// Decode a Firestore document value back into plain JSON.
///
/// `timestampValue`, `referenceValue`, and `bytesValue` decode to their raw
/// string payloads (they have no plain-JSON equivalent).
pub fn from_firestore_value(v: &Value) -> Result<Value> {
    let obj = v
        .as_object()
        .ok_or_else(|| codec_err(format!("firestore value is not an object: {v}")))?;
    if obj.contains_key("nullValue") {
        return Ok(Value::Null);
    }
    if let Some(b) = obj.get("booleanValue") {
        return b
            .as_bool()
            .map(Value::Bool)
            .ok_or_else(|| codec_err(format!("invalid booleanValue: {b}")));
    }
    if let Some(i) = obj.get("integerValue") {
        let n = match i {
            Value::String(s) => s
                .parse::<i64>()
                .map_err(|e| codec_err(format!("invalid integerValue `{s}`: {e}")))?,
            Value::Number(n) => n
                .as_i64()
                .ok_or_else(|| codec_err(format!("invalid integerValue: {n}")))?,
            other => return Err(codec_err(format!("invalid integerValue: {other}"))),
        };
        return Ok(Value::Number(n.into()));
    }
    if let Some(d) = obj.get("doubleValue") {
        let f = d
            .as_f64()
            .ok_or_else(|| codec_err(format!("invalid doubleValue: {d}")))?;
        return serde_json::Number::from_f64(f)
            .map(Value::Number)
            .ok_or_else(|| codec_err(format!("non-finite doubleValue: {f}")));
    }
    for key in ["stringValue", "timestampValue", "referenceValue", "bytesValue"] {
        if let Some(s) = obj.get(key) {
            return s
                .as_str()
                .map(|s| Value::String(s.to_owned()))
                .ok_or_else(|| codec_err(format!("invalid {key}: {s}")));
        }
    }
    if let Some(m) = obj.get("mapValue") {
        let empty = Map::new();
        let fields = m.get("fields").and_then(Value::as_object).unwrap_or(&empty);
        let mut out = Map::new();
        for (k, val) in fields {
            out.insert(k.clone(), from_firestore_value(val)?);
        }
        return Ok(Value::Object(out));
    }
    if let Some(a) = obj.get("arrayValue") {
        let empty = Vec::new();
        let values = a.get("values").and_then(Value::as_array).unwrap_or(&empty);
        return values.iter().map(from_firestore_value).collect::<Result<Vec<_>>>().map(Value::Array);
    }
    Err(codec_err(format!("unsupported firestore value: {v}")))
}

// ---------------------------------------------------------------------------
// Timestamps
// ---------------------------------------------------------------------------

/// RFC3339 with nanosecond precision and a `Z` suffix. (Firestore itself
/// stores microseconds; finer precision is truncated server-side.)
pub fn encode_timestamp(t: DateTime<Utc>) -> String {
    t.to_rfc3339_opts(SecondsFormat::Nanos, true)
}

/// A `{"timestampValue": ...}` document value.
pub fn timestamp_value(t: DateTime<Utc>) -> Value {
    json!({"timestampValue": encode_timestamp(t)})
}

pub fn parse_timestamp(s: &str) -> Result<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .map(|d| d.with_timezone(&Utc))
        .map_err(|e| codec_err(format!("invalid timestamp `{s}`: {e}")))
}

// ---------------------------------------------------------------------------
// Typed document field builder / reader
// ---------------------------------------------------------------------------

/// Builds the `fields` map of a Firestore document from typed record fields.
#[derive(Default)]
pub struct Fields(Map<String, Value>);

impl Fields {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_str(&mut self, key: &str, v: &str) {
        self.0.insert(key.to_owned(), json!({"stringValue": v}));
    }

    pub fn set_opt_str(&mut self, key: &str, v: Option<&str>) {
        match v {
            Some(s) => self.set_str(key, s),
            None => {
                self.0.insert(key.to_owned(), json!({"nullValue": null}));
            }
        }
    }

    pub fn set_bool(&mut self, key: &str, v: bool) {
        self.0.insert(key.to_owned(), json!({"booleanValue": v}));
    }

    pub fn set_u32(&mut self, key: &str, v: u32) {
        self.0.insert(key.to_owned(), json!({"integerValue": v.to_string()}));
    }

    pub fn set_ts(&mut self, key: &str, v: DateTime<Utc>) {
        self.0.insert(key.to_owned(), timestamp_value(v));
    }

    pub fn set_opt_ts(&mut self, key: &str, v: Option<DateTime<Utc>>) {
        match v {
            Some(t) => self.set_ts(key, t),
            None => {
                self.0.insert(key.to_owned(), json!({"nullValue": null}));
            }
        }
    }

    /// Store an arbitrary JSON payload (metadata/spec columns).
    pub fn set_json(&mut self, key: &str, v: &Value) {
        self.0.insert(key.to_owned(), to_firestore_value(v));
    }

    /// Store a string list (roles, grant actions) as an `arrayValue` of
    /// `stringValue`s.
    pub fn set_string_list(&mut self, key: &str, v: &[String]) {
        let values: Vec<Value> = v.iter().map(|s| json!({"stringValue": s})).collect();
        self.0.insert(key.to_owned(), json!({"arrayValue": {"values": values}}));
    }

    /// Wrap the fields into a document body: `{"fields": {...}}`.
    pub fn into_document(self) -> Value {
        json!({"fields": self.0})
    }
}

fn empty_fields() -> &'static Map<String, Value> {
    static EMPTY: OnceLock<Map<String, Value>> = OnceLock::new();
    EMPTY.get_or_init(Map::new)
}

/// Reads typed record fields out of a Firestore document
/// (`{"name": ..., "fields": {...}, ...}`).
pub struct FieldsReader<'a> {
    fields: &'a Map<String, Value>,
}

impl<'a> FieldsReader<'a> {
    pub fn from_document(doc: &'a Value) -> Result<Self> {
        match doc.get("fields") {
            Some(Value::Object(map)) => Ok(Self { fields: map }),
            // A document whose fields were all deleted has no `fields` key.
            None => Ok(Self { fields: empty_fields() }),
            Some(other) => Err(codec_err(format!("invalid document fields: {other}"))),
        }
    }

    fn required(&self, key: &str) -> Result<&'a Value> {
        self.fields
            .get(key)
            .ok_or_else(|| codec_err(format!("document is missing field `{key}`")))
    }

    fn is_null(v: &Value) -> bool {
        v.as_object().is_some_and(|o| o.contains_key("nullValue"))
    }

    pub fn get_str(&self, key: &str) -> Result<String> {
        let v = self.required(key)?;
        v.get("stringValue")
            .and_then(Value::as_str)
            .map(str::to_owned)
            .ok_or_else(|| codec_err(format!("field `{key}` is not a stringValue: {v}")))
    }

    pub fn get_opt_str(&self, key: &str) -> Result<Option<String>> {
        match self.fields.get(key) {
            None => Ok(None),
            Some(v) if Self::is_null(v) => Ok(None),
            Some(_) => self.get_str(key).map(Some),
        }
    }

    pub fn get_bool(&self, key: &str) -> Result<bool> {
        let v = self.required(key)?;
        v.get("booleanValue")
            .and_then(Value::as_bool)
            .ok_or_else(|| codec_err(format!("field `{key}` is not a booleanValue: {v}")))
    }

    pub fn get_u32(&self, key: &str) -> Result<u32> {
        let v = self.required(key)?;
        match from_firestore_value(v)? {
            Value::Number(n) => n
                .as_u64()
                .and_then(|n| u32::try_from(n).ok())
                .ok_or_else(|| codec_err(format!("field `{key}` out of range for u32: {n}"))),
            other => Err(codec_err(format!("field `{key}` is not an integerValue: {other}"))),
        }
    }

    pub fn get_ts(&self, key: &str) -> Result<DateTime<Utc>> {
        let v = self.required(key)?;
        let s = v
            .get("timestampValue")
            .and_then(Value::as_str)
            .ok_or_else(|| codec_err(format!("field `{key}` is not a timestampValue: {v}")))?;
        parse_timestamp(s)
    }

    pub fn get_opt_ts(&self, key: &str) -> Result<Option<DateTime<Utc>>> {
        match self.fields.get(key) {
            None => Ok(None),
            Some(v) if Self::is_null(v) => Ok(None),
            Some(_) => self.get_ts(key).map(Some),
        }
    }

    /// Read an arbitrary JSON payload; a missing field decodes as JSON null.
    pub fn get_json(&self, key: &str) -> Result<Value> {
        match self.fields.get(key) {
            None => Ok(Value::Null),
            Some(v) => from_firestore_value(v),
        }
    }

    pub fn get_string_list(&self, key: &str) -> Result<Vec<String>> {
        let decoded = self.get_json(key)?;
        serde_json::from_value(decoded)
            .map_err(|e| codec_err(format!("field `{key}` is not a string list: {e}")))
    }
}

// ---------------------------------------------------------------------------
// structuredQuery builders
// ---------------------------------------------------------------------------

/// `{"fieldFilter": {...}}` with an arbitrary comparison operator
/// (`EQUAL`, `LESS_THAN_OR_EQUAL`, `IN`, ...). `value` must already be a
/// Firestore document value.
pub fn field_filter(field: &str, op: &str, value: Value) -> Value {
    json!({
        "fieldFilter": {
            "field": {"fieldPath": field},
            "op": op,
            "value": value,
        }
    })
}

/// Equality filter.
pub fn field_eq(field: &str, value: Value) -> Value {
    field_filter(field, "EQUAL", value)
}

/// `IN` filter (value set membership; Firestore caps the set at 30).
pub fn field_in(field: &str, values: Vec<Value>) -> Value {
    field_filter(field, "IN", json!({"arrayValue": {"values": values}}))
}

pub fn str_value(s: &str) -> Value {
    json!({"stringValue": s})
}

pub fn bool_value(b: bool) -> Value {
    json!({"booleanValue": b})
}

/// Combine filters with `AND`. Zero filters → `None`; one filter passes
/// through unwrapped.
pub fn and(filters: Vec<Value>) -> Option<Value> {
    composite("AND", filters)
}

/// Combine filters with `OR` (requires a recent Firestore API version).
pub fn or(filters: Vec<Value>) -> Option<Value> {
    composite("OR", filters)
}

fn composite(op: &str, mut filters: Vec<Value>) -> Option<Value> {
    match filters.len() {
        0 => None,
        1 => Some(filters.remove(0)),
        _ => Some(json!({"compositeFilter": {"op": op, "filters": filters}})),
    }
}

fn clamp_i32(n: usize) -> i32 {
    i32::try_from(n).unwrap_or(i32::MAX)
}

/// Builder for `runQuery` request bodies.
pub struct StructuredQuery {
    collection: String,
    filter: Option<Value>,
    order_by: Vec<Value>,
    limit: Option<i32>,
    offset: Option<i32>,
}

impl StructuredQuery {
    pub fn collection(name: &str) -> Self {
        Self {
            collection: name.to_owned(),
            filter: None,
            order_by: Vec::new(),
            limit: None,
            offset: None,
        }
    }

    /// Set the `where` clause (typically from [`and`] / [`or`]).
    pub fn filter(mut self, filter: Option<Value>) -> Self {
        self.filter = filter;
        self
    }

    pub fn order_by(mut self, field: &str, descending: bool) -> Self {
        self.order_by.push(json!({
            "field": {"fieldPath": field},
            "direction": if descending { "DESCENDING" } else { "ASCENDING" },
        }));
        self
    }

    pub fn limit(mut self, limit: usize) -> Self {
        self.limit = Some(clamp_i32(limit));
        self
    }

    /// Apply limit/offset pagination from a [`Page`].
    pub fn page(mut self, page: Page) -> Self {
        self.limit = Some(clamp_i32(page.limit));
        if page.offset > 0 {
            self.offset = Some(clamp_i32(page.offset));
        }
        self
    }

    /// Build the full request body: `{"structuredQuery": {...}}`.
    pub fn build(self) -> Value {
        let mut q = Map::new();
        q.insert("from".into(), json!([{"collectionId": self.collection}]));
        if let Some(filter) = self.filter {
            q.insert("where".into(), filter);
        }
        if !self.order_by.is_empty() {
            q.insert("orderBy".into(), Value::Array(self.order_by));
        }
        if let Some(limit) = self.limit {
            q.insert("limit".into(), json!(limit));
        }
        if let Some(offset) = self.offset {
            q.insert("offset".into(), json!(offset));
        }
        json!({"structuredQuery": q})
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn scalar_values_encode_to_documented_shapes() {
        assert_eq!(to_firestore_value(&json!(null)), json!({"nullValue": null}));
        assert_eq!(to_firestore_value(&json!(true)), json!({"booleanValue": true}));
        assert_eq!(to_firestore_value(&json!(42)), json!({"integerValue": "42"}));
        assert_eq!(to_firestore_value(&json!(-7)), json!({"integerValue": "-7"}));
        assert_eq!(to_firestore_value(&json!(2.5)), json!({"doubleValue": 2.5}));
        assert_eq!(to_firestore_value(&json!("hi")), json!({"stringValue": "hi"}));
    }

    #[test]
    fn containers_encode_recursively() {
        let v = json!({"a": [1, "two", null], "b": {"c": false}});
        assert_eq!(
            to_firestore_value(&v),
            json!({
                "mapValue": {"fields": {
                    "a": {"arrayValue": {"values": [
                        {"integerValue": "1"},
                        {"stringValue": "two"},
                        {"nullValue": null},
                    ]}},
                    "b": {"mapValue": {"fields": {"c": {"booleanValue": false}}}},
                }}
            })
        );
    }

    #[test]
    fn value_codec_roundtrips() {
        let cases = vec![
            json!(null),
            json!(true),
            json!(false),
            json!(0),
            json!(-123456789),
            json!(i64::MAX),
            json!(2.5),
            json!(""),
            json!("hello world"),
            json!([]),
            json!([1, 2, 3]),
            json!({}),
            json!({"nested": {"deep": [{"x": 1.25}, null, "s", true]}, "n": -1}),
        ];
        for case in cases {
            let encoded = to_firestore_value(&case);
            let decoded = from_firestore_value(&encoded).unwrap();
            assert_eq!(decoded, case, "roundtrip failed for {case}");
        }
    }

    #[test]
    fn integer_value_decodes_from_string_and_number() {
        assert_eq!(
            from_firestore_value(&json!({"integerValue": "42"})).unwrap(),
            json!(42)
        );
        assert_eq!(
            from_firestore_value(&json!({"integerValue": 42})).unwrap(),
            json!(42)
        );
    }

    #[test]
    fn empty_map_and_array_values_decode() {
        // The REST API may omit `fields` / `values` for empty containers.
        assert_eq!(from_firestore_value(&json!({"mapValue": {}})).unwrap(), json!({}));
        assert_eq!(from_firestore_value(&json!({"arrayValue": {}})).unwrap(), json!([]));
    }

    #[test]
    fn u64_above_i64_max_degrades_to_double() {
        let encoded = to_firestore_value(&json!(u64::MAX));
        assert!(encoded.get("doubleValue").is_some(), "got {encoded}");
    }

    #[test]
    fn timestamps_roundtrip_and_use_timestamp_value() {
        let t = Utc.with_ymd_and_hms(2026, 1, 2, 3, 4, 5).unwrap()
            + chrono::Duration::nanoseconds(123_456_789);
        let v = timestamp_value(t);
        assert_eq!(v, json!({"timestampValue": "2026-01-02T03:04:05.123456789Z"}));
        let parsed = parse_timestamp(v["timestampValue"].as_str().unwrap()).unwrap();
        assert_eq!(parsed, t);
    }

    #[test]
    fn fields_builder_and_reader_roundtrip() {
        let t = Utc.with_ymd_and_hms(2026, 3, 4, 5, 6, 7).unwrap();
        let mut f = Fields::new();
        f.set_str("s", "text");
        f.set_opt_str("s_none", None);
        f.set_opt_str("s_some", Some("x"));
        f.set_bool("b", true);
        f.set_u32("n", 7);
        f.set_ts("t", t);
        f.set_opt_ts("t_none", None);
        f.set_opt_ts("t_some", Some(t));
        f.set_json("j", &json!({"k": [1, 2]}));
        f.set_string_list("l", &["a".into(), "b".into()]);
        let doc = f.into_document();

        let r = FieldsReader::from_document(&doc).unwrap();
        assert_eq!(r.get_str("s").unwrap(), "text");
        assert_eq!(r.get_opt_str("s_none").unwrap(), None);
        assert_eq!(r.get_opt_str("s_some").unwrap(), Some("x".into()));
        assert_eq!(r.get_opt_str("absent").unwrap(), None);
        assert!(r.get_bool("b").unwrap());
        assert_eq!(r.get_u32("n").unwrap(), 7);
        assert_eq!(r.get_ts("t").unwrap(), t);
        assert_eq!(r.get_opt_ts("t_none").unwrap(), None);
        assert_eq!(r.get_opt_ts("t_some").unwrap(), Some(t));
        assert_eq!(r.get_json("j").unwrap(), json!({"k": [1, 2]}));
        assert_eq!(r.get_json("absent").unwrap(), Value::Null);
        assert_eq!(r.get_string_list("l").unwrap(), vec!["a".to_string(), "b".to_string()]);
        assert!(r.get_str("absent").is_err());
    }

    #[test]
    fn structured_query_builds_documented_shape() {
        let q = StructuredQuery::collection("rustra_threads")
            .filter(and(vec![field_eq("resource_id", str_value("user-1"))]))
            .order_by("updated_at", true)
            .page(Page::new(50, 10))
            .build();
        assert_eq!(
            q,
            json!({
                "structuredQuery": {
                    "from": [{"collectionId": "rustra_threads"}],
                    "where": {"fieldFilter": {
                        "field": {"fieldPath": "resource_id"},
                        "op": "EQUAL",
                        "value": {"stringValue": "user-1"},
                    }},
                    "orderBy": [{"field": {"fieldPath": "updated_at"}, "direction": "DESCENDING"}],
                    "limit": 50,
                    "offset": 10,
                }
            })
        );
    }

    #[test]
    fn composite_filters_collapse_singletons() {
        assert_eq!(and(vec![]), None);
        let single = field_eq("a", str_value("x"));
        assert_eq!(and(vec![single.clone()]), Some(single.clone()));
        let both = and(vec![single.clone(), field_eq("b", bool_value(true))]).unwrap();
        assert_eq!(both["compositeFilter"]["op"], "AND");
        assert_eq!(both["compositeFilter"]["filters"].as_array().unwrap().len(), 2);
        let either = or(vec![single.clone(), single]).unwrap();
        assert_eq!(either["compositeFilter"]["op"], "OR");
    }
}
