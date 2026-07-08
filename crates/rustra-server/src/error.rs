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

fn kind_name(error: &Error) -> &'static str {
    match error {
        Error::NotFound { .. } => "not_found",
        Error::PermissionDenied(_) => "permission_denied",
        Error::Validation(_) => "validation",
        Error::Storage(_) => "storage",
        Error::Model(_) => "model",
        Error::Tool { .. } => "tool",
        Error::Mcp(_) => "mcp",
        Error::Workflow(_) => "workflow",
        Error::Cancelled(_) => "cancelled",
        Error::Timeout(_) => "timeout",
        Error::Unavailable(_) => "unavailable",
        Error::Config(_) => "config",
        Error::Serde(_) => "serde",
        Error::Io(_) => "io",
        Error::Other(_) => "other",
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = match &self.0 {
            Error::NotFound { .. } => StatusCode::NOT_FOUND,
            Error::PermissionDenied(_) => StatusCode::FORBIDDEN,
            Error::Validation(_) | Error::Config(_) => StatusCode::BAD_REQUEST,
            Error::Timeout(_) => StatusCode::GATEWAY_TIMEOUT,
            Error::Unavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
            Error::Cancelled(_) => StatusCode::CONFLICT,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };
        let body = Json(json!({
            "error": { "kind": kind_name(&self.0), "message": self.0.to_string() }
        }));
        (status, body).into_response()
    }
}
