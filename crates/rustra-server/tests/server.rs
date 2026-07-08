//! End-to-end HTTP tests over the router (no TCP: `tower::ServiceExt`).

use std::sync::Arc;
use std::time::Duration;

use axum::body::{to_bytes, Body};
use axum::http::{header, Request, StatusCode};
use axum::Router;
use serde_json::{json, Value};
use tower::util::ServiceExt;

use rustra::{MockModel, Principal, Role, Rustra};
use rustra_server::{router, ServerConfig};

struct TestServer {
    app: Router,
    rustra: Arc<Rustra>,
    token: String,
    _workspaces: tempfile::TempDir,
}

async fn setup() -> TestServer {
    let workspaces = tempfile::tempdir().expect("tempdir");
    let rustra = Rustra::builder()
        .model(
            "mock/mock-1",
            Arc::new(MockModel::text("hello from the mock")),
        )
        .default_model("mock/mock-1")
        .workspace_dir(workspaces.path())
        .build()
        .await
        .expect("build rustra");
    let token = rustra
        .auth()
        .issue_token("ada", "Ada", vec![Role::builder()])
        .await
        .expect("issue token");
    let app = router(Arc::clone(&rustra), &ServerConfig::default());
    TestServer {
        app,
        rustra,
        token,
        _workspaces: workspaces,
    }
}

async fn send(
    server: &TestServer,
    method: &str,
    path: &str,
    token: Option<&str>,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut request = Request::builder().method(method).uri(path);
    if let Some(token) = token {
        request = request.header(header::AUTHORIZATION, format!("Bearer {token}"));
    }
    let request = match body {
        Some(body) => request
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(serde_json::to_vec(&body).unwrap()))
            .unwrap(),
        None => request.body(Body::empty()).unwrap(),
    };
    let response = server
        .app
        .clone()
        .oneshot(request)
        .await
        .expect("infallible");
    let status = response.status();
    let bytes = to_bytes(response.into_body(), 4 * 1024 * 1024)
        .await
        .unwrap();
    let value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes)
            .unwrap_or(Value::String(String::from_utf8_lossy(&bytes).into_owned()))
    };
    (status, value)
}

/// Shorthand for an authenticated request with the default (ada) token.
async fn call(
    server: &TestServer,
    method: &str,
    path: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let token = server.token.clone();
    send(server, method, path, Some(&token), body).await
}

// ---------------------------------------------------------------------------

#[tokio::test]
async fn health_is_open_and_api_requires_auth() {
    let server = setup().await;

    let (status, body) = send(&server, "GET", "/health", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!({ "ok": true }));

    // No token → 401.
    let (status, body) = send(&server, "GET", "/api/runs", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"]["kind"], "unauthorized");

    // Garbage token → 401.
    let (status, _) = send(&server, "GET", "/api/tasks", Some("rsk_bogus"), None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn main_agent_generate_returns_text() {
    let server = setup().await;
    let (status, body) = call(
        &server,
        "POST",
        "/api/agents/main/generate",
        Some(json!({ "message": "hi there" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["text"], "hello from the mock");
    assert!(body["run_id"].as_str().unwrap().starts_with("run_"));
    assert!(body["trace_id"].is_string());
    assert!(body["thread_id"].is_string());
    assert!(body["steps"].as_u64().unwrap() >= 1);
}

#[tokio::test]
async fn runs_list_trace_and_logs_after_generate() {
    let server = setup().await;
    let (status, generated) = call(
        &server,
        "POST",
        "/api/agents/main/generate",
        Some(json!({ "message": "go" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{generated}");
    let run_id = generated["run_id"].as_str().unwrap().to_string();

    let (status, runs) = call(&server, "GET", "/api/runs", None).await;
    assert_eq!(status, StatusCode::OK);
    let runs = runs.as_array().unwrap();
    assert!(
        runs.iter().any(|r| r["id"] == run_id.as_str()),
        "run listed"
    );

    let (status, run) = call(&server, "GET", &format!("/api/runs/{run_id}"), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(run["user_id"], "ada");
    assert_eq!(run["kind"], "agent");

    let (status, spans) = call(&server, "GET", &format!("/api/runs/{run_id}/trace"), None).await;
    assert_eq!(status, StatusCode::OK);
    assert!(!spans.as_array().unwrap().is_empty(), "trace has spans");

    let (status, logs) = call(&server, "GET", &format!("/api/runs/{run_id}/logs"), None).await;
    assert_eq!(status, StatusCode::OK);
    assert!(logs.is_array());

    // Unknown run → 404.
    let (status, _) = call(&server, "GET", "/api/runs/run_missing", None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn schedules_crud_roundtrip() {
    let server = setup().await;

    // Invalid cron → 400.
    let (status, body) = call(
        &server,
        "POST",
        "/api/schedules",
        Some(json!({ "name": "bad", "cron": "not a cron", "spec": {} })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    assert_eq!(body["error"]["kind"], "validation");

    let (status, created) = call(
        &server,
        "POST",
        "/api/schedules",
        Some(json!({
            "name": "daily",
            "cron": "0 9 * * *",
            "timezone": "UTC",
            "spec": { "target": "agent", "id": "main", "input": { "message": "daily digest" } },
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{created}");
    let id = created["id"].as_str().unwrap().to_string();
    assert_eq!(created["enabled"], true);
    assert!(created["next_run_at"].is_string());

    let (status, listed) = call(&server, "GET", "/api/schedules", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(listed.as_array().unwrap().len(), 1);

    let (status, _) = call(&server, "POST", &format!("/api/schedules/{id}/pause"), None).await;
    assert_eq!(status, StatusCode::OK);
    let (_, listed) = call(&server, "GET", "/api/schedules", None).await;
    assert_eq!(listed[0]["enabled"], false);

    let (status, _) = call(
        &server,
        "POST",
        &format!("/api/schedules/{id}/resume"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let (status, _) = call(&server, "POST", &format!("/api/schedules/{id}/run"), None).await;
    assert_eq!(status, StatusCode::OK);

    let (status, _) = call(&server, "DELETE", &format!("/api/schedules/{id}"), None).await;
    assert_eq!(status, StatusCode::OK);
    let (_, listed) = call(&server, "GET", "/api/schedules", None).await;
    assert!(listed.as_array().unwrap().is_empty());
}

#[tokio::test]
async fn tasks_run_now_and_background_status() {
    let server = setup().await;

    // Foreground (run_now): the response is the final record.
    let (status, task) = call(
        &server,
        "POST",
        "/api/tasks",
        Some(
            json!({ "spec": { "target": "agent", "id": "main", "input": { "message": "do it" } } }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{task}");
    assert_eq!(task["status"], "completed");
    assert_eq!(task["trigger"], "direct");
    assert!(task["output"]["text"].is_string());

    // Background: submitted, then observable through GET until terminal.
    let (status, submitted) = call(
        &server,
        "POST",
        "/api/tasks",
        Some(json!({
            "spec": { "target": "agent", "id": "main", "input": { "message": "later" } },
            "background": true,
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{submitted}");
    let id = submitted["id"].as_str().unwrap().to_string();

    let mut final_status = String::new();
    for _ in 0..100 {
        let (status, fetched) = call(&server, "GET", &format!("/api/tasks/{id}"), None).await;
        assert_eq!(status, StatusCode::OK);
        final_status = fetched["status"].as_str().unwrap().to_string();
        if final_status != "pending" && final_status != "running" {
            break;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    assert_eq!(final_status, "completed");

    let (status, listed) = call(&server, "GET", "/api/tasks", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(listed.as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn signal_emit_launches_matching_subscription() {
    let server = setup().await;

    let (status, sub) = call(
        &server,
        "POST",
        "/api/subscriptions",
        Some(json!({
            "pattern": "deploy.done",
            "spec": { "target": "agent", "id": "main", "input": { "message": "ship it" } },
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{sub}");
    let sub_id = sub["id"].as_str().unwrap().to_string();

    let (status, launched) = call(
        &server,
        "POST",
        "/api/signals",
        Some(json!({ "name": "deploy.done", "payload": { "version": "1.2.3" } })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{launched}");
    let launched = launched.as_array().unwrap();
    assert_eq!(launched.len(), 1);
    assert_eq!(launched[0]["trigger"], "signal");
    assert_eq!(launched[0]["user_id"], "ada");

    let (status, listed) = call(&server, "GET", "/api/subscriptions", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(listed.as_array().unwrap().len(), 1);

    let (status, _) = call(
        &server,
        "DELETE",
        &format!("/api/subscriptions/{sub_id}"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (_, listed) = call(&server, "GET", "/api/subscriptions", None).await;
    assert!(listed.as_array().unwrap().is_empty());
}

#[tokio::test]
async fn webhook_launches_subscription_task() {
    let server = setup().await;

    call(
        &server,
        "POST",
        "/api/subscriptions",
        Some(json!({
            "pattern": "webhook.gh.*",
            "spec": { "target": "agent", "id": "main" },
        })),
    )
    .await;

    let (status, launched) = call(
        &server,
        "POST",
        "/api/webhooks/gh.push",
        Some(json!({ "ref": "main" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{launched}");
    let launched = launched.as_array().unwrap();
    assert_eq!(launched.len(), 1);
    assert_eq!(launched[0]["trigger"], "webhook");
    assert_eq!(launched[0]["spec"]["event"]["payload"]["ref"], "main");

    // The launched task reaches a terminal state.
    let id = launched[0]["id"].as_str().unwrap().to_string();
    let mut final_status = String::new();
    for _ in 0..100 {
        let (_, fetched) = call(&server, "GET", &format!("/api/tasks/{id}"), None).await;
        final_status = fetched["status"].as_str().unwrap().to_string();
        if final_status != "pending" && final_status != "running" {
            break;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    assert_eq!(final_status, "completed");
}

#[tokio::test]
async fn decision_pending_and_resolve_roundtrip() {
    let server = setup().await;
    let ada = Principal::user("ada");
    let decision = server
        .rustra
        .interrupts()
        .request(
            &ada,
            "run_1",
            "approval",
            "Deploy to production?",
            json!({}),
        )
        .await
        .unwrap();

    let (status, pending) = call(&server, "GET", "/api/decisions/pending", None).await;
    assert_eq!(status, StatusCode::OK);
    let pending = pending.as_array().unwrap();
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0]["id"], decision.id.as_str());
    assert_eq!(pending[0]["prompt"], "Deploy to production?");

    // Invalid status → 400 before touching the controller.
    let (status, body) = call(
        &server,
        "POST",
        &format!("/api/decisions/{}/resolve", decision.id),
        Some(json!({ "status": "maybe", "resolution": {} })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"]["kind"], "validation");

    let (status, resolved) = call(
        &server,
        "POST",
        &format!("/api/decisions/{}/resolve", decision.id),
        Some(json!({ "status": "approved", "resolution": { "ok": true } })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{resolved}");
    assert_eq!(resolved["status"], "approved");
    assert_eq!(resolved["resolution"]["ok"], true);

    let (_, pending) = call(&server, "GET", "/api/decisions/pending", None).await;
    assert!(pending.as_array().unwrap().is_empty());

    // Double-resolution → 400 (already resolved).
    let (status, _) = call(
        &server,
        "POST",
        &format!("/api/decisions/{}/resolve", decision.id),
        Some(json!({ "status": "rejected" })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn ui_render_sets_csp_headers() {
    let server = setup().await;
    let artifact = server
        .rustra
        .ui()
        .create(
            "ada",
            "Dashboard",
            "<p>chart goes here</p>",
            json!({ "points": [1, 2] }),
        )
        .await
        .unwrap();

    let (status, listed) = call(&server, "GET", "/api/ui", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(listed.as_array().unwrap().len(), 1);

    let (status, fetched) = call(&server, "GET", &format!("/api/ui/{}", artifact.id), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(fetched["title"], "Dashboard");

    // Render: raw response so the headers can be inspected.
    let request = Request::builder()
        .method("GET")
        .uri(format!("/api/ui/{}/render", artifact.id))
        .header(header::AUTHORIZATION, format!("Bearer {}", server.token))
        .body(Body::empty())
        .unwrap();
    let response = server.app.clone().oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let csp = response
        .headers()
        .get(header::CONTENT_SECURITY_POLICY)
        .unwrap();
    assert_eq!(
        csp.to_str().unwrap(),
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:"
    );
    assert_eq!(
        response.headers().get(header::X_FRAME_OPTIONS).unwrap(),
        "SAMEORIGIN"
    );
    let html = String::from_utf8(
        to_bytes(response.into_body(), 1024 * 1024)
            .await
            .unwrap()
            .to_vec(),
    )
    .unwrap();
    assert!(html.contains("<p>chart goes here</p>"));
    assert!(html.contains("window.__RUSTRA_DATA__"));
}

#[tokio::test]
async fn browser_bridge_and_workspace_files() {
    let server = setup().await;

    // Browser session: create, then poll an empty command queue.
    let (status, session) = call(&server, "POST", "/api/browser/sessions", None).await;
    assert_eq!(status, StatusCode::OK);
    let session_id = session["id"].as_str().unwrap().to_string();
    let (status, polled) = call(
        &server,
        "GET",
        &format!("/api/browser/sessions/{session_id}/commands"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(polled["command"], Value::Null);

    // Workspace file write/read roundtrip.
    let (status, written) = call(
        &server,
        "PUT",
        "/api/workspace/files",
        Some(json!({ "path": "files/notes.md", "content": "# notes" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{written}");
    let (status, read) = call(
        &server,
        "GET",
        "/api/workspace/files?path=files/notes.md",
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(read["content"], "# notes");
}

#[tokio::test]
async fn user_isolation_across_tokens() {
    let server = setup().await;

    // Ada creates a run and a task.
    let (_, generated) = call(
        &server,
        "POST",
        "/api/agents/main/generate",
        Some(json!({ "message": "hi" })),
    )
    .await;
    let run_id = generated["run_id"].as_str().unwrap().to_string();

    let bob_token = server
        .rustra
        .auth()
        .issue_token("bob", "Bob", vec![Role::builder()])
        .await
        .unwrap();

    // Bob cannot read ada's run (or its trace).
    let (status, body) = send(
        &server,
        "GET",
        &format!("/api/runs/{run_id}"),
        Some(&bob_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body}");
    assert_eq!(body["error"]["kind"], "permission_denied");
    let (status, _) = send(
        &server,
        "GET",
        &format!("/api/runs/{run_id}/trace"),
        Some(&bob_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    // Bob's own listings are empty.
    let (status, runs) = send(&server, "GET", "/api/runs", Some(&bob_token), None).await;
    assert_eq!(status, StatusCode::OK);
    assert!(runs.as_array().unwrap().is_empty());
}
