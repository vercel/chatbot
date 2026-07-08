//! Mapping [`rustra_core::Error`] onto HTTP responses.

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

use rustra_core::Error;

/// Handler result alias: any domain error becomes an [`ApiError`].
pub type ApiResult<T> = Result<T, ApiError>;

/// A domain error crossing the HTTP boundary. The JSON body is
/// `{"error": {"kind": ..., "message": ...}}` and the status code follows
/// the variant (404/403/400/504/503/409, 500 otherwise).
#[derive(Debug)]
pub struct ApiError(pub Error);

impl From<Error> for ApiError {
    fn from(error: Error) -> Self {
        Self(error)
    }
}

/// The single source of truth pairing each domain [`Error`] variant with its
/// HTTP status and stable wire `kind`. New variants get one arm here rather
/// than two matches that must be kept in lockstep.
fn status_and_kind(error: &Error) -> (StatusCode, &'static str) {
    match error {
        Error::NotFound { .. } => (StatusCode::NOT_FOUND, "not_found"),
        Error::PermissionDenied(_) => (StatusCode::FORBIDDEN, "permission_denied"),
        Error::Validation(_) => (StatusCode::BAD_REQUEST, "validation"),
        Error::Config(_) => (StatusCode::BAD_REQUEST, "config"),
        Error::Timeout(_) => (StatusCode::GATEWAY_TIMEOUT, "timeout"),
        Error::Unavailable(_) => (StatusCode::SERVICE_UNAVAILABLE, "unavailable"),
        Error::Cancelled(_) => (StatusCode::CONFLICT, "cancelled"),
        Error::Storage(_) => (StatusCode::INTERNAL_SERVER_ERROR, "storage"),
        Error::Model(_) => (StatusCode::INTERNAL_SERVER_ERROR, "model"),
        Error::Tool { .. } => (StatusCode::INTERNAL_SERVER_ERROR, "tool"),
        Error::Mcp(_) => (StatusCode::INTERNAL_SERVER_ERROR, "mcp"),
        Error::Workflow(_) => (StatusCode::INTERNAL_SERVER_ERROR, "workflow"),
        Error::Serde(_) => (StatusCode::INTERNAL_SERVER_ERROR, "serde"),
        Error::Io(_) => (StatusCode::INTERNAL_SERVER_ERROR, "io"),
        Error::Other(_) => (StatusCode::INTERNAL_SERVER_ERROR, "other"),
    }
}

/// Build the standard error envelope `{"error": {"kind": ..., "message": ...}}`
/// with the given status. The one constructor for the server's error wire body.
pub(crate) fn error_response(status: StatusCode, kind: &str, message: &str) -> Response {
    let body = Json(json!({ "error": { "kind": kind, "message": message } }));
    (status, body).into_response()
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, kind) = status_and_kind(&self.0);
        error_response(status, kind, &self.0.to_string())
    }
}
