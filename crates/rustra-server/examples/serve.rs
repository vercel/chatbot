//! Local dev server for testing the browser extension end to end.
//!
//! ```sh
//! cargo run -p rustra-server --example serve
//! ```
//!
//! Prints a bearer token, starts the HTTP server (CORS open so the extension
//! can reach it), then waits for the extension to open a browser session and
//! drives a short demo sequence (read the page title + URL, take a
//! screenshot) so you can see the round trip working.

use std::sync::Arc;
use std::time::Duration;

use rustra::{Role, Rustra};
use rustra_browser::{BrowserAction, BrowserSession};
use rustra_llm::MockModel;
use rustra_server::{serve, ServerConfig};

const USER: &str = "dev";

#[tokio::main]
async fn main() -> rustra::Result<()> {
    let dir = tempfile::tempdir()?;
    let rustra = Rustra::builder()
        .sqlite(dir.path().join("rustra.db"))?
        .model("mock/mock-1", Arc::new(MockModel::text("ok")))
        .default_model("mock/mock-1")
        .workspace_dir(dir.path().join("workspaces"))
        .build()
        .await?;

    // Mint a bearer token for the extension to authenticate with.
    let token = rustra
        .auth()
        .issue_token(USER, "Dev User", vec![Role::builder()])
        .await?;

    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(4111);
    let base = format!("http://127.0.0.1:{port}");

    println!("\n────────────────────────────────────────────────────────");
    println!("  rustra-server (browser-extension demo)");
    println!("────────────────────────────────────────────────────────");
    println!("  server : {base}");
    println!("  token  : {token}");
    println!();
    println!("  Next:");
    println!("   1. Load the unpacked extension in Chrome:");
    println!("      chrome://extensions → Developer mode → Load unpacked");
    println!("      → select  extensions/rustra-browser/");
    println!("   2. Click the extension icon, paste the token above,");
    println!("      set server to {base}, and hit Connect.");
    println!("   3. Open any normal http(s) tab and watch this terminal.");
    println!("────────────────────────────────────────────────────────\n");

    // Drive a demo sequence once the extension opens a session.
    let browser = Arc::clone(rustra.browser());
    tokio::spawn(async move {
        let session_id = loop {
            if let Some(id) = browser.list(USER).into_iter().next() {
                break id;
            }
            tokio::time::sleep(Duration::from_millis(500)).await;
        };
        println!("✓ extension connected — session {session_id}");
        let session = match browser.get(USER, &session_id) {
            Ok(s) => s,
            Err(e) => {
                println!("could not attach to session: {e}");
                return;
            }
        };

        let demo = [
            ("page title", BrowserAction::Evaluate { expression: "document.title".into() }),
            ("page url", BrowserAction::Evaluate { expression: "location.href".into() }),
            ("screenshot", BrowserAction::Screenshot),
        ];
        for (label, action) in demo {
            match session.perform(action).await {
                Ok(r) if r.ok => {
                    let shown = match &r.data {
                        // Screenshots are big data URLs — just report the size.
                        serde_json::Value::String(s) if s.starts_with("data:") => {
                            format!("<{} bytes of image data>", s.len())
                        }
                        other => other.to_string(),
                    };
                    println!("  {label:12} → {shown}");
                }
                Ok(r) => println!("  {label:12} ✗ {}", r.error.unwrap_or_default()),
                Err(e) => println!("  {label:12} ✗ {e}"),
            }
        }
        println!("\n✓ demo complete — the extension is live. Ctrl-C to stop.\n");
    });

    let addr = ([127, 0, 0, 1], port).into();
    serve(rustra, ServerConfig::default().addr(addr).cors_permissive(true)).await
}
