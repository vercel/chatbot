//! Generative UI artifacts, including CSP-hardened rendering.

use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::http::header;
use axum::response::{Html, IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

use rustra::Rustra;
use rustra_storage::types::UiArtifactRecord;
use rustra_ui::render_document;

use crate::auth::AuthedUser;
use crate::error::ApiResult;
use crate::routes::PageQuery;

/// The CSP served with rendered artifacts — the same policy
/// `rustra_ui::render` embeds as a `<meta>` tag, enforced here as a real
/// response header (defense in depth).
const ARTIFACT_CSP: &str =
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:";

/// `GET /api/ui` — the caller's artifacts, newest first.
pub(crate) async fn list(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Query(page): Query<PageQuery>,
) -> ApiResult<Json<Vec<UiArtifactRecord>>> {
    Ok(Json(rustra.ui().list(&principal.user_id, page.page()).await?))
}

#[derive(Debug, Deserialize)]
pub(crate) struct CreateUiRequest {
    title: String,
    html: String,
    #[serde(default)]
    data: Value,
}

/// `POST /api/ui`.
pub(crate) async fn create(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Json(body): Json<CreateUiRequest>,
) -> ApiResult<Json<UiArtifactRecord>> {
    let record =
        rustra.ui().create(&principal.user_id, &body.title, &body.html, body.data).await?;
    Ok(Json(record))
}

/// `GET /api/ui/{id}`.
pub(crate) async fn get_one(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(id): Path<String>,
) -> ApiResult<Json<UiArtifactRecord>> {
    Ok(Json(rustra.ui().get(&principal.user_id, &id).await?))
}

/// `GET /api/ui/{id}/render` — the artifact as a full HTML document with
/// CSP and framing headers.
pub(crate) async fn render(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(id): Path<String>,
) -> ApiResult<Response> {
    let artifact = rustra.ui().get(&principal.user_id, &id).await?;
    let document = render_document(&artifact);
    Ok((
        [
            (header::CONTENT_SECURITY_POLICY, ARTIFACT_CSP),
            (header::X_FRAME_OPTIONS, "SAMEORIGIN"),
        ],
        Html(document),
    )
        .into_response())
}
