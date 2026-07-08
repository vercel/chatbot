//! # rustra-server
//!
//! The HTTP shell over an [`Arc<Rustra>`] runtime — the analogue of
//! `@mastra/server`. Handlers contain **no business logic**: each one
//! resolves the caller's [`rustra_core::Principal`], calls the corresponding
//! facade method, and maps the domain [`rustra_core::Error`] to an HTTP
//! status ([`ApiError`]).
//!
//! * `GET /health` — liveness, no auth.
//! * Everything under `/api` requires `Authorization: Bearer <token>`,
//!   authenticated through `rustra.auth()` (see the private `auth` module).
//!
//! ```no_run
//! # async fn demo(rustra: std::sync::Arc<rustra::Rustra>) -> rustra_core::Result<()> {
//! rustra_server::serve(rustra, rustra_server::ServerConfig::default()).await
//! # }
//! ```

mod auth;
mod error;
mod routes;

pub use auth::AuthedUser;
pub use error::{ApiError, ApiResult};

use std::net::SocketAddr;
use std::sync::Arc;

use axum::routing::get;
use axum::{Json, Router};
use serde_json::{json, Value};
use tower_http::cors::CorsLayer;

use rustra::Rustra;

/// Server configuration.
///
/// Constructed via [`ServerConfig::default`] or [`ServerConfig::new`] and
/// refined with the chainable setters. Marked `#[non_exhaustive]` so future
/// knobs (rate limiting, request-size limits) can be added without breaking
/// callers.
#[derive(Debug, Clone)]
#[non_exhaustive]
pub struct ServerConfig {
    /// Bind address. Defaults to `127.0.0.1:4111` (Mastra's default port).
    pub addr: SocketAddr,
    /// Apply a permissive CORS layer (development / browser extensions).
    pub cors_permissive: bool,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            addr: SocketAddr::from(([127, 0, 0, 1], 4111)),
            cors_permissive: false,
        }
    }
}

impl ServerConfig {
    /// A configuration with default values.
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the bind address.
    pub fn addr(mut self, addr: SocketAddr) -> Self {
        self.addr = addr;
        self
    }

    /// Toggle the permissive CORS layer.
    pub fn cors_permissive(mut self, on: bool) -> Self {
        self.cors_permissive = on;
        self
    }
}

/// Build the application router: `/health` (open) plus everything under
/// `/api` behind bearer-token auth. The state is the shared runtime.
pub fn router(rustra: Arc<Rustra>, config: &ServerConfig) -> Router {
    let api = routes::api_router().layer(axum::middleware::from_fn_with_state(
        Arc::clone(&rustra),
        auth::require_auth,
    ));
    let mut app = Router::new()
        .route("/health", get(health))
        .nest("/api", api)
        .with_state(rustra);
    if config.cors_permissive {
        app = app.layer(CorsLayer::permissive());
    }
    app
}

/// Bind and serve until the process is stopped.
pub async fn serve(rustra: Arc<Rustra>, config: ServerConfig) -> rustra_core::Result<()> {
    let app = router(rustra, &config);
    let listener = tokio::net::TcpListener::bind(config.addr).await?;
    tracing::info!(addr = %config.addr, "rustra-server listening");
    axum::serve(listener, app).await?;
    Ok(())
}

/// `GET /health` — liveness probe, no auth.
async fn health() -> Json<Value> {
    Json(json!({ "ok": true }))
}
