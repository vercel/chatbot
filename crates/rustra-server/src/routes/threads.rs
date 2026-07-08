//! Conversation threads and their messages.

use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;

use rustra::Rustra;
use rustra_storage::types::{StoredMessage, Thread};
use rustra_storage::Page;

use crate::auth::AuthedUser;
use crate::error::ApiResult;
use crate::routes::PageQuery;

/// `GET /api/threads` — the caller's threads, most recently updated first.
pub(crate) async fn list(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Query(page): Query<PageQuery>,
) -> ApiResult<Json<Vec<Thread>>> {
    let threads = rustra
        .memory()
        .list_threads(&principal.user_id, page.page())
        .await?;
    Ok(Json(threads))
}

#[derive(Debug, Deserialize)]
pub(crate) struct ThreadMessagesQuery {
    limit: Option<usize>,
}

/// `GET /api/threads/{id}/messages` — recent messages of one of the
/// caller's threads (ownership enforced by `memory().get_thread`).
pub(crate) async fn messages(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Path(thread_id): Path<String>,
    Query(query): Query<ThreadMessagesQuery>,
) -> ApiResult<Json<Vec<StoredMessage>>> {
    rustra
        .memory()
        .get_thread(&thread_id, &principal.user_id)
        .await?;
    let messages = rustra
        .storage()
        .recent_messages(&thread_id, query.limit.unwrap_or(Page::default().limit))
        .await?;
    Ok(Json(messages))
}
