//! In-app messages: inbox listing and live SSE delivery.

use std::convert::Infallible;
use std::sync::Arc;
use std::time::Duration;

use axum::extract::{Query, State};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::Json;
use futures::stream::Stream;
use futures::StreamExt;
use serde::Deserialize;
use tokio_stream::wrappers::BroadcastStream;

use rustra::Rustra;
use rustra_storage::types::ChannelMessageRecord;

use crate::auth::AuthedUser;
use crate::error::ApiResult;
use crate::routes::PageQuery;

#[derive(Debug, Deserialize)]
pub(crate) struct MessagesQuery {
    channel: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
}

/// `GET /api/messages` — the caller's persisted channel messages.
pub(crate) async fn list(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
    Query(query): Query<MessagesQuery>,
) -> ApiResult<Json<Vec<ChannelMessageRecord>>> {
    let page = PageQuery { limit: query.limit, offset: query.offset }.page();
    let messages = rustra
        .storage()
        .list_channel_messages(&principal.user_id, query.channel.as_deref(), page)
        .await?;
    Ok(Json(messages))
}

/// `GET /api/messages/stream` — SSE bridge over the in-app broadcast,
/// filtered to the caller's messages, with a 15s keep-alive.
pub(crate) async fn stream(
    State(rustra): State<Arc<Rustra>>,
    AuthedUser(principal): AuthedUser,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let receiver = rustra.in_app().subscribe();
    let user_id = principal.user_id;
    let stream = BroadcastStream::new(receiver).filter_map(move |item| {
        let user_id = user_id.clone();
        async move {
            match item {
                Ok(record) if record.user_id == user_id => Some(Ok(Event::default()
                    .event("message")
                    .json_data(&record)
                    .unwrap_or_else(|_| Event::default().event("message")))),
                // Other users' messages and lag notices are skipped; lagged
                // clients re-sync from `GET /api/messages`.
                _ => None,
            }
        }
    });
    Sse::new(stream).keep_alive(KeepAlive::new().interval(Duration::from_secs(15)))
}
