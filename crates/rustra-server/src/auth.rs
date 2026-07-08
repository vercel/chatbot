//! Bearer-token authentication for everything under `/api`.
//!
//! The middleware resolves `Authorization: Bearer <token>` through
//! `rustra.auth()` ([`rustra_rbac::TokenAuthProvider`]) and stores the
//! resulting [`Principal`] in the request extensions, where the
//! [`AuthedUser`] extractor picks it up.

use std::sync::Arc;

use axum::extract::{FromRequestParts, Request, State};
use axum::http::request::Parts;
use axum::http::{header, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

use rustra::Rustra;
use rustra_core::Principal;
use rustra_rbac::AuthProvider;

use crate::error::ApiError;

fn unauthorized(message: &str) -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({ "error": { "kind": "unauthorized", "message": message } })),
    )
        .into_response()
}

/// Middleware: authenticate the bearer token and inject the [`Principal`].
pub async fn require_auth(
    State(rustra): State<Arc<Rustra>>,
    mut request: Request,
    next: Next,
) -> Response {
    let token = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "));
    let Some(token) = token else {
        return unauthorized("missing `Authorization: Bearer <token>` header");
    };
    match rustra.auth().authenticate_token(token).await {
        Ok(Some(principal)) => {
            request.extensions_mut().insert(principal);
            next.run(request).await
        }
        Ok(None) => unauthorized("invalid or expired token"),
        Err(error) => ApiError(error).into_response(),
    }
}

/// Extractor for the authenticated [`Principal`] placed in the request
/// extensions by [`require_auth`].
#[derive(Debug, Clone)]
pub struct AuthedUser(pub Principal);

impl<S: Send + Sync> FromRequestParts<S> for AuthedUser {
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<Principal>()
            .cloned()
            .map(AuthedUser)
            .ok_or_else(|| unauthorized("no authenticated principal on this request"))
    }
}
