//! End-to-end tour of Rustra with a scripted mock model (no API key
//! needed): the main agent discovers a skill, uses workspace tools,
//! remembers the user, then a deploy flow suspends for human approval and
//! resumes.
//!
//! ```sh
//! cargo run -p quickstart
//! ```

use std::sync::Arc;

use rustra::{FlowOutcome, Principal, RuntimeContext, Rustra};
use rustra_llm::{MockModel, ScriptedTurn};
use rustra_workflow::{approval_step, FunctionStep, StepOutcome, Workflow};
use serde_json::json;

#[tokio::main]
async fn main() -> rustra::Result<()> {
    tracing_subscriber::fmt().with_env_filter("info").init();
    let dir = tempfile::tempdir()?;

    // 1. Build the runtime: SQLite persistence, one (mock) model.
    let model = Arc::new(MockModel::new(vec![
        // Turn 1: the agent checks for a relevant skill.
        ScriptedTurn::ToolCall {
            name: "search_skills".into(),
            input: json!({"query": "project setup python"}),
        },
        // Turn 2: reads it.
        ScriptedTurn::ToolCall {
            name: "read_skill".into(),
            input: json!({"name": "python-project-setup"}),
        },
        // Turn 3: follows its instructions using the workspace.
        ScriptedTurn::ToolCall {
            name: "workspace_write_file".into(),
            input: json!({"path": "files/pyproject.toml", "content": "[project]\nname = \"demo\"\n"}),
        },
        // Turn 4: remembers the user's preference.
        ScriptedTurn::ToolCall {
            name: "update_working_memory".into(),
            input: json!({"content": "# User Profile\n- Prefers Python projects with pyproject.toml\n"}),
        },
        ScriptedTurn::Text(
            "Done — created pyproject.toml following the python-project-setup skill.".into(),
        ),
    ]));

    let rustra = Rustra::builder()
        .sqlite(dir.path().join("rustra.db"))?
        .model("mock/mock-1", model)
        .default_model("mock/mock-1")
        .workspace_dir(dir.path().join("workspaces"))
        .build()
        .await?;

    // 2. Author a skill into Ada's workspace (Agent Skills convention).
    let workspace = rustra.workspaces().workspace_for_user("ada").await?;
    std::fs::create_dir_all(workspace.skills_dir().join("python-project-setup"))?;
    std::fs::write(
        workspace.skills_dir().join("python-project-setup/SKILL.md"),
        "---\nname: python-project-setup\ndescription: Set up a new Python project with pyproject.toml. Use when the user asks to scaffold or set up a Python project.\nkeywords:\n  - python\n  - project\n  - setup\n---\n\nCreate a `pyproject.toml` with the project name, then confirm to the user.\n",
    )?;

    // 3. Run the main agent.
    let ada = Principal::user("ada");
    let agent = rustra.main_agent_for("ada").await?;
    let reply = agent
        .generate("set up a python project", RuntimeContext::new(ada.clone()))
        .await?;
    println!(
        "\n=== agent ===\n{}\n(steps: {}, run: {})",
        reply.text, reply.steps, reply.run_id
    );

    // The skill's effect is real: the file exists in the jailed workspace.
    let created = workspace.read_file("files/pyproject.toml").await?;
    println!("\n=== workspace/files/pyproject.toml ===\n{created}");

    // And the agent's memory persisted.
    let wm = rustra
        .memory()
        .get_working_memory("ada")
        .await?
        .unwrap_or_default();
    println!("=== working memory ===\n{wm}");

    // 4. A harness flow with human approval: build → gate → ship.
    let deploy = Workflow::builder("deploy")
        .then(FunctionStep::new("build", |ctx| async move {
            Ok(StepOutcome::Done(
                json!({ "artifact": format!("build-of-{}", ctx.input["ref"]) }),
            ))
        }))
        .then(approval_step("gate", "Ship to production?"))
        .then(FunctionStep::new("ship", |ctx| async move {
            Ok(StepOutcome::Done(
                json!({ "shipped": ctx.input["artifact"] }),
            ))
        }))
        .storage(rustra.storage().clone())
        .observability(rustra.observability().clone())
        .commit();

    let run = deploy
        .start(json!({"ref": "main"}), RuntimeContext::new(ada.clone()))
        .await?;
    let FlowOutcome::Suspended { step_id, .. } = &run.outcome else {
        panic!("expected the flow to wait for approval");
    };
    println!("\n=== flow ===\nsuspended at `{step_id}` awaiting approval");

    // The pending decision is inspectable (HITL) …
    let pending = rustra.interrupts().pending(&ada).await?;
    println!("pending decision: {}", pending[0].prompt);

    // … and resuming with approval completes the flow.
    let resumed = deploy
        .resume(
            &run.run_id,
            json!({"approved": true}),
            RuntimeContext::new(ada.clone()),
        )
        .await?;
    if let FlowOutcome::Success(output) = resumed.outcome {
        println!("shipped: {output}");
    }

    // 5. Observability: everything above is inspectable.
    let runs = rustra
        .storage()
        .list_runs("ada", None, None, rustra::Page::default())
        .await?;
    println!("\n=== runs recorded ===");
    for r in &runs {
        println!("- [{}] {} `{}`", r.status, r.kind, r.subject_id);
    }
    Ok(())
}
