//! SSE event streaming endpoint

use axum::{
    BoxError, Router,
    extract::State,
    response::{
        Sse,
        sse::{Event, KeepAlive},
    },
    routing::get,
};
use futures_util::TryStreamExt;

use crate::gateway::AppState;

/// SSE event stream handler
pub async fn events(
    State(state): State<AppState>,
) -> Result<Sse<impl futures_util::Stream<Item = Result<Event, BoxError>>>, axum::http::StatusCode>
{
    let stream = state.events.stream_events().await;
    Ok(Sse::new(stream.map_err(|e| -> BoxError { e.into() })).keep_alive(KeepAlive::default()))
}

/// Create the events router
pub fn router() -> Router<AppState> {
    Router::new().route("/api/events", get(events))
}
