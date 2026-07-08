//! The browser action vocabulary and result envelope.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// One browser primitive, modeled on WebDriver-BiDi / Playwright commands.
///
/// Serialized with an internal `type` tag in snake_case, e.g.
/// `{"type": "navigate", "url": "https://example.com"}` or
/// `{"type": "screenshot"}` — the wire format the extension executes.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BrowserAction {
    /// Load a URL in the driven tab.
    Navigate { url: String },
    /// Click the first element matching a CSS selector.
    Click { selector: String },
    /// Type text into the element matching a CSS selector.
    Type { selector: String, text: String },
    /// Press a keyboard key (Playwright key names, e.g. `Enter`, `Tab`).
    Press { key: String },
    /// Scroll the viewport by a pixel delta.
    Scroll { dx: i64, dy: i64 },
    /// Wait until a selector matches, up to `timeout_ms`.
    WaitFor { selector: String, timeout_ms: u64 },
    /// Read the DOM: the subtree matching `selector`, or the whole document.
    ReadDom {
        #[serde(default)]
        selector: Option<String>,
    },
    /// Capture a screenshot of the visible viewport (result data carries the
    /// image, e.g. a data URL).
    Screenshot,
    /// Evaluate a JavaScript expression in the page and return its value.
    Evaluate { expression: String },
}

fn default_json() -> Value {
    Value::Null
}

/// The executor's answer to one [`BrowserAction`].
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BrowserActionResult {
    /// Whether the action succeeded in the browser.
    pub ok: bool,
    /// Action-specific payload (DOM text, evaluated value, screenshot data
    /// URL, ...). `null` when there is nothing to return.
    #[serde(default = "default_json")]
    pub data: Value,
    /// Failure detail when `ok` is false.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl BrowserActionResult {
    pub fn success(data: Value) -> Self {
        Self { ok: true, data, error: None }
    }

    pub fn failure(error: impl Into<String>) -> Self {
        Self { ok: false, data: Value::Null, error: Some(error.into()) }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn actions_roundtrip_through_serde() {
        let actions = vec![
            BrowserAction::Navigate { url: "https://example.com".into() },
            BrowserAction::Click { selector: "#submit".into() },
            BrowserAction::Type { selector: "input[name=q]".into(), text: "rustra".into() },
            BrowserAction::Press { key: "Enter".into() },
            BrowserAction::Scroll { dx: 0, dy: 400 },
            BrowserAction::WaitFor { selector: ".results".into(), timeout_ms: 5000 },
            BrowserAction::ReadDom { selector: Some("main".into()) },
            BrowserAction::ReadDom { selector: None },
            BrowserAction::Screenshot,
            BrowserAction::Evaluate { expression: "document.title".into() },
        ];
        for action in actions {
            let encoded = serde_json::to_value(&action).unwrap();
            let decoded: BrowserAction = serde_json::from_value(encoded).unwrap();
            assert_eq!(decoded, action);
        }
    }

    #[test]
    fn wire_format_is_snake_case_tagged() {
        let encoded =
            serde_json::to_value(BrowserAction::Navigate { url: "https://a.b".into() }).unwrap();
        assert_eq!(encoded, json!({ "type": "navigate", "url": "https://a.b" }));

        let encoded = serde_json::to_value(BrowserAction::WaitFor {
            selector: "#x".into(),
            timeout_ms: 100,
        })
        .unwrap();
        assert_eq!(encoded["type"], "wait_for");

        assert_eq!(
            serde_json::to_value(BrowserAction::Screenshot).unwrap(),
            json!({ "type": "screenshot" })
        );

        // `selector` may be omitted entirely for read_dom.
        let decoded: BrowserAction = serde_json::from_value(json!({ "type": "read_dom" })).unwrap();
        assert_eq!(decoded, BrowserAction::ReadDom { selector: None });
    }

    #[test]
    fn results_roundtrip_and_default_missing_fields() {
        let result = BrowserActionResult::success(json!({ "title": "Example" }));
        let decoded: BrowserActionResult =
            serde_json::from_value(serde_json::to_value(&result).unwrap()).unwrap();
        assert_eq!(decoded, result);

        let decoded: BrowserActionResult = serde_json::from_value(json!({ "ok": false })).unwrap();
        assert!(!decoded.ok);
        assert_eq!(decoded.data, Value::Null);
        assert_eq!(decoded.error, None);
    }
}
