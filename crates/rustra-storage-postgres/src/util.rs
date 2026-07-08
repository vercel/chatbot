//! Small shared helpers: error mapping and column codecs for the Postgres
//! backend.

use rustra_core::{Error, ResourceKind, Result, Visibility};
use rustra_storage::Page;
use serde_json::Value;
use tokio_postgres::types::FromSql;
use tokio_postgres::Row;

/// Map any displayable backend failure into [`Error::Storage`].
pub(crate) fn storage_err<E: std::fmt::Display>(e: E) -> Error {
    Error::Storage(e.to_string())
}

// ---------------------------------------------------------------------------
// Parameter codecs
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

/// `u32` record fields (versions, attempt counters) are stored as `BIGINT`.
pub(crate) fn u32_to_db(n: u32) -> i64 {
    i64::from(n)
}

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

/// Serialize a string list (roles, grant actions) as a JSONB array column.
pub(crate) fn string_vec_to_json(v: &[String]) -> Value {
    Value::Array(v.iter().cloned().map(Value::String).collect())
}

pub(crate) fn string_vec_from_json(v: Value) -> Result<Vec<String>> {
    serde_json::from_value(v)
        .map_err(|e| Error::Storage(format!("invalid string list column: {e}")))
}

// ---------------------------------------------------------------------------
// Row codecs
// ---------------------------------------------------------------------------

/// Read column `idx`, mapping failures to [`Error::Storage`].
pub(crate) fn col<'r, T>(row: &'r Row, idx: usize) -> Result<T>
where
    T: FromSql<'r>,
{
    row.try_get(idx).map_err(storage_err)
}

/// Read a `BIGINT` column back into a `u32` record field.
pub(crate) fn col_u32(row: &Row, idx: usize) -> Result<u32> {
    let v: i64 = col(row, idx)?;
    u32::try_from(v)
        .map_err(|_| Error::Storage(format!("column {idx} value {v} out of range for u32")))
}

/// Map every row through `map`.
pub(crate) fn rows_map<T>(rows: Vec<Row>, map: impl Fn(&Row) -> Result<T>) -> Result<Vec<T>> {
    rows.iter().map(map).collect()
}

/// Map an optional row through `map`.
pub(crate) fn row_opt<T>(row: Option<Row>, map: impl Fn(&Row) -> Result<T>) -> Result<Option<T>> {
    row.as_ref().map(map).transpose()
}
