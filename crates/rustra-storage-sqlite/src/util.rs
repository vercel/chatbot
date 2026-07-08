//! Small shared helpers: error mapping, timestamp/enum/JSON column
//! conversions, and thin query wrappers over `rusqlite`.

use chrono::{DateTime, SecondsFormat, Utc};
use rusqlite::{Connection, Params, Row};
use rustra_core::{Error, ResourceKind, Result, Visibility};
use serde_json::Value;

use rustra_storage::Page;

/// Map any displayable backend failure into [`Error::Storage`].
pub(crate) fn storage_err<E: std::fmt::Display>(e: E) -> Error {
    Error::Storage(e.to_string())
}

// ---------------------------------------------------------------------------
// Timestamps
// ---------------------------------------------------------------------------

/// RFC3339 with fixed nanosecond precision and a `Z` suffix. The fixed width
/// makes lexicographic TEXT comparison equal chronological comparison, which
/// `due_schedules` relies on.
pub(crate) fn to_ts(t: DateTime<Utc>) -> String {
    t.to_rfc3339_opts(SecondsFormat::Nanos, true)
}

pub(crate) fn to_ts_opt(t: Option<DateTime<Utc>>) -> Option<String> {
    t.map(to_ts)
}

pub(crate) fn parse_ts(s: &str) -> Result<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .map(|d| d.with_timezone(&Utc))
        .map_err(|e| Error::Storage(format!("invalid timestamp `{s}`: {e}")))
}

pub(crate) fn parse_ts_opt(s: Option<String>) -> Result<Option<DateTime<Utc>>> {
    s.map(|s| parse_ts(&s)).transpose()
}

// ---------------------------------------------------------------------------
// Enum / JSON columns
// ---------------------------------------------------------------------------

pub(crate) fn kind_to_sql(kind: ResourceKind) -> &'static str {
    kind.as_str()
}

pub(crate) fn kind_from_sql(s: &str) -> Result<ResourceKind> {
    serde_json::from_value(Value::String(s.to_owned()))
        .map_err(|e| Error::Storage(format!("invalid resource kind `{s}`: {e}")))
}

pub(crate) fn vis_to_sql(v: Visibility) -> &'static str {
    match v {
        Visibility::Private => "private",
        Visibility::Shared => "shared",
        Visibility::Public => "public",
    }
}

pub(crate) fn vis_from_sql(s: &str) -> Result<Visibility> {
    match s {
        "private" => Ok(Visibility::Private),
        "shared" => Ok(Visibility::Shared),
        "public" => Ok(Visibility::Public),
        other => Err(Error::Storage(format!("invalid visibility `{other}`"))),
    }
}

/// Serialize a JSON payload column as TEXT. Done explicitly (rather than via
/// rusqlite's `serde_json` `ToSql`) so `Value::Null` round-trips as the JSON
/// text `null` instead of SQL NULL.
pub(crate) fn json_to_sql(v: &Value) -> Result<String> {
    serde_json::to_string(v).map_err(|e| Error::Storage(format!("encode json column: {e}")))
}

/// Serialize a string list (roles, grant actions) as a JSON array column.
pub(crate) fn string_vec_to_sql(v: &[String]) -> Result<String> {
    serde_json::to_string(v).map_err(|e| Error::Storage(format!("encode string list: {e}")))
}

pub(crate) fn string_vec_from_sql(s: &str) -> Result<Vec<String>> {
    serde_json::from_str(s).map_err(|e| Error::Storage(format!("invalid string list `{s}`: {e}")))
}

// ---------------------------------------------------------------------------
// Query wrappers
// ---------------------------------------------------------------------------

/// Clamp a `usize` (page limit/offset, message limits) into an `i64` SQL
/// parameter.
pub(crate) fn as_i64(n: usize) -> i64 {
    i64::try_from(n).unwrap_or(i64::MAX)
}

/// `(LIMIT, OFFSET)` parameters for a [`Page`].
pub(crate) fn page_params(page: Page) -> (i64, i64) {
    (as_i64(page.limit), as_i64(page.offset))
}

/// Run a SELECT and map every row through `map`.
pub(crate) fn query_all<T>(
    conn: &Connection,
    sql: &str,
    params: impl Params,
    map: impl Fn(&Row<'_>) -> Result<T>,
) -> Result<Vec<T>> {
    let mut stmt = conn.prepare(sql).map_err(storage_err)?;
    let mut rows = stmt.query(params).map_err(storage_err)?;
    let mut out = Vec::new();
    while let Some(row) = rows.next().map_err(storage_err)? {
        out.push(map(row)?);
    }
    Ok(out)
}

/// Run a SELECT expected to return at most one row.
pub(crate) fn query_opt<T>(
    conn: &Connection,
    sql: &str,
    params: impl Params,
    map: impl Fn(&Row<'_>) -> Result<T>,
) -> Result<Option<T>> {
    Ok(query_all(conn, sql, params, map)?.into_iter().next())
}

/// Execute a statement, returning the affected row count.
pub(crate) fn exec(conn: &Connection, sql: &str, params: impl Params) -> Result<usize> {
    conn.execute(sql, params).map_err(storage_err)
}

/// Read column `idx` with rusqlite's `FromSql`, mapping failures to
/// [`Error::Storage`].
pub(crate) fn col<T: rusqlite::types::FromSql>(row: &Row<'_>, idx: usize) -> Result<T> {
    row.get(idx).map_err(storage_err)
}

/// Read column `idx` as TEXT and parse it as a JSON payload.
pub(crate) fn col_json(row: &Row<'_>, idx: usize) -> Result<Value> {
    let s: String = col(row, idx)?;
    serde_json::from_str(&s).map_err(|e| Error::Storage(format!("invalid json column: {e}")))
}

/// Read column `idx` as TEXT and parse it as a required timestamp.
pub(crate) fn col_ts(row: &Row<'_>, idx: usize) -> Result<DateTime<Utc>> {
    parse_ts(&row.get::<_, String>(idx).map_err(storage_err)?)
}

/// Read column `idx` as nullable TEXT and parse it as an optional timestamp.
pub(crate) fn col_ts_opt(row: &Row<'_>, idx: usize) -> Result<Option<DateTime<Utc>>> {
    parse_ts_opt(row.get::<_, Option<String>>(idx).map_err(storage_err)?)
}
