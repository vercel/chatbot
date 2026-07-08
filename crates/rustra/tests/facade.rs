//! End-to-end facade tests: the wired runtime over one storage backend.

use std::sync::Arc;

use rustra::{AgentDefinition, Principal, Rustra, RuntimeContext, TaskOptions};
use rustra_llm::{MockModel, ScriptedTurn};
use serde_json::json;

async fn runtime_with_model(model: Arc<MockModel>) -> Arc<Rustra> {
    Rustra::builder()
        .model("mock/mock-1", model)
        .default_model("mock/mock-1")
        .workspace_dir(tempfile::tempdir().unwrap().keep())
        .build()
        .await
        .unwrap()
}

#[tokio::test]
async fn main_agent_discovers_user_skill_and_writes_workspace_file() {
    let model = Arc::new(MockModel::new(vec![
        ScriptedTurn::ToolCall {
            name: "search_skills".into(),
            input: json!({"query": "greeting"}),
        },
        ScriptedTurn::ToolCall {
            name: "workspace_write_file".into(),
            input: json!({"path": "files/hello.txt", "content": "hi"}),
        },
        ScriptedTurn::Text("done".into()),
    ]));
    let rustra = runtime_with_model(model).await;

    // Author a skill in ada's workspace.
    let workspace = rustra.workspaces().workspace_for_user("ada").await.unwrap();
    std::fs::create_dir_all(workspace.skills_dir().join("greeter")).unwrap();
    std::fs::write(
        workspace.skills_dir().join("greeter/SKILL.md"),
        "---\nname: greeter\ndescription: Greet people warmly. Use for greeting requests.\nkeywords: [greeting]\n---\nSay hi.\n",
    )
    .unwrap();

    let agent = rustra.main_agent_for("ada").await.unwrap();
    let reply = agent
        .generate("greeting please", RuntimeContext::new(Principal::user("ada")))
        .await
        .unwrap();
    assert_eq!(reply.text, "done");

    // The workspace write really happened, jailed to ada's files dir.
    let content = workspace.read_file("files/hello.txt").await.unwrap();
    assert_eq!(content, "hi");

    // Runs and spans were recorded.
    let runs = rustra
        .storage()
        .list_runs("ada", Some("agent"), None, rustra::Page::default())
        .await
        .unwrap();
    assert!(!runs.is_empty());
}

#[tokio::test]
async fn user_defined_agents_hydrate_and_are_access_controlled() {
    let rustra = runtime_with_model(Arc::new(MockModel::text("from the custom agent"))).await;
    let ada = Principal::user("ada");

    let definition: AgentDefinition = serde_json::from_value(json!({
        "id": "my-helper",
        "name": "My Helper",
        "instructions": "Be helpful.",
        "model": "mock/mock-1",
    }))
    .unwrap();
    rustra.save_agent_definition(&ada, definition).await.unwrap();

    // The owner can instantiate and run it.
    let agent = rustra.instantiate_agent(&ada, "my-helper").await.unwrap();
    let reply =
        agent.generate("hello", RuntimeContext::new(ada.clone())).await.unwrap();
    assert_eq!(reply.text, "from the custom agent");

    // Another user cannot (private by default).
    match rustra.instantiate_agent(&Principal::user("mallory"), "my-helper").await {
        Err(rustra::Error::PermissionDenied(_)) => {}
        Err(other) => panic!("expected PermissionDenied, got: {other}"),
        Ok(_) => panic!("expected PermissionDenied, got an agent"),
    }
}

#[tokio::test]
async fn flow_definitions_run_with_approval_gates() {
    let rustra = runtime_with_model(Arc::new(MockModel::text("drafted"))).await;
    let ada = Principal::user("ada");

    let flow: rustra::FlowDefinition = serde_json::from_value(json!({
        "id": "draft-and-ship",
        "name": "Draft and ship",
        "steps": [
            {"kind": "agent", "id": "draft", "agent": "main", "prompt": "Draft: {{input}}"},
            {"kind": "approval", "id": "gate", "prompt": "Ship it?"}
        ]
    }))
    .unwrap();
    rustra.save_flow_definition(&ada, flow).await.unwrap();

    let workflow = rustra.instantiate_flow(&ada, "draft-and-ship").await.unwrap();
    let run = workflow
        .start(json!({"topic": "release notes"}), RuntimeContext::new(ada.clone()))
        .await
        .unwrap();
    let rustra::FlowOutcome::Suspended { step_id, .. } = run.outcome else {
        panic!("expected approval suspension");
    };
    assert_eq!(step_id, "gate");

    // Pending decision is visible, resume completes.
    assert_eq!(rustra.interrupts().pending(&ada).await.unwrap().len(), 1);
    let resumed = workflow
        .resume(&run.run_id, json!({"approved": true}), RuntimeContext::new(ada.clone()))
        .await
        .unwrap();
    let rustra::FlowOutcome::Success(output) = resumed.outcome else {
        panic!("expected success after approval");
    };
    assert_eq!(output["text"], "drafted");
}

#[tokio::test]
async fn tasks_schedules_and_signals_drive_the_agent() {
    let model = Arc::new(MockModel::new(vec![
        ScriptedTurn::EchoLast,
        ScriptedTurn::EchoLast,
        ScriptedTurn::EchoLast,
    ]));
    let rustra = runtime_with_model(model).await;
    let ada = Principal::user("ada");

    // Direct task.
    let record = rustra
        .tasks()
        .run_now(
            &ada,
            json!({"target": "agent", "id": "main", "input": {"message": "background hello"}}),
            TaskOptions::default(),
        )
        .await
        .unwrap();
    assert_eq!(record.status, "completed");
    assert!(record.output["text"].as_str().unwrap().contains("background hello"));

    // Signal subscription → emitted event launches a task for ada.
    rustra
        .signals()
        .subscribe(&ada, "webhook.github.*", json!({"target": "agent", "id": "main"}))
        .await
        .unwrap();
    let launched = rustra
        .signals()
        .emit_webhook(&ada, "github.push", json!({"ref": "main"}))
        .await
        .unwrap();
    assert_eq!(launched.len(), 1);
    let finished = rustra.tasks().wait(&launched[0].id).await.unwrap();
    assert_eq!(finished.status, "completed");

    // Schedule: created, listed, fires through the same executor.
    let schedule = rustra
        .scheduler()
        .create(&ada, "hourly", "0 * * * *", None, json!({"target": "agent", "id": "main"}))
        .await
        .unwrap();
    assert!(schedule.next_run_at.is_some());
    assert_eq!(rustra.scheduler().list(&ada, rustra::Page::default()).await.unwrap().len(), 1);
}
