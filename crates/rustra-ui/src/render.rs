//! Safe-rendering support: wrap artifact HTML into a self-contained,
//! CSP-restricted document.

use rustra_storage::types::UiArtifactRecord;

/// The strict CSP applied to every rendered artifact: no network egress, no
/// external resources; only the inline script/style the artifact ships with
/// and `data:` images.
pub const ARTIFACT_CSP: &str =
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:";

/// Wrap an artifact's HTML fragment in a full document:
///
/// * a `<meta http-equiv="Content-Security-Policy">` tag carrying
///   `ARTIFACT_CSP`,
/// * a `<script>` injecting the artifact's structured data as
///   `window.__RUSTRA_DATA__` *before* the body content, so artifact code
///   can read it synchronously.
///
/// This is defense in depth only — real isolation comes from how the
/// document is served (sandboxed iframe / separate origin / CSP **headers**,
/// all owned by `rustra-server`). See the crate docs.
pub fn render_document(artifact: &UiArtifactRecord) -> String {
    // `Value` serialization cannot realistically fail; fall back to `null`
    // rather than panicking if it ever does. Escape `</` so a string like
    // "</script>" inside the data cannot break out of the script element.
    // Also escape `<!--`: per the HTML spec's script-content restrictions,
    // `<!--` switches the parser into script-data-escaped state, where a
    // following `<script` in the same data prevents the real `</script>` from
    // closing this element. `!` is the valid JSON escape for `!`, so the
    // parsed value is unchanged.
    let data_json = serde_json::to_string(&artifact.data)
        .unwrap_or_else(|_| "null".to_string())
        .replace("</", "<\\/")
        .replace("<!--", "<\\u0021--");
    let title = escape_html(&artifact.title);
    format!(
        "<!DOCTYPE html>\n\
         <html>\n\
         <head>\n\
         <meta charset=\"utf-8\">\n\
         <meta http-equiv=\"Content-Security-Policy\" content=\"{ARTIFACT_CSP}\">\n\
         <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n\
         <title>{title}</title>\n\
         </head>\n\
         <body>\n\
         <script>window.__RUSTRA_DATA__ = {data_json};</script>\n\
         {body}\n\
         </body>\n\
         </html>\n",
        body = artifact.html,
    )
}

fn escape_html(text: &str) -> String {
    let mut escaped = String::with_capacity(text.len());
    for c in text.chars() {
        match c {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            '\'' => escaped.push_str("&#39;"),
            other => escaped.push(other),
        }
    }
    escaped
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use rustra_core::Visibility;
    use serde_json::json;

    fn artifact(title: &str, html: &str, data: serde_json::Value) -> UiArtifactRecord {
        let now = Utc::now();
        UiArtifactRecord {
            id: "ui_test".into(),
            owner_id: "u1".into(),
            title: title.into(),
            kind: "html".into(),
            html: html.into(),
            data,
            version: 1,
            visibility: Visibility::Private,
            created_at: now,
            updated_at: now,
        }
    }

    #[test]
    fn document_contains_csp_and_injected_data() {
        let doc = render_document(&artifact(
            "My Chart",
            "<div id=\"root\"></div>",
            json!({ "points": [1, 2, 3] }),
        ));
        assert!(doc.starts_with("<!DOCTYPE html>"));
        assert!(doc.contains(
            "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; \
             script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:\">"
        ));
        assert!(doc.contains("<title>My Chart</title>"));
        assert!(doc.contains("window.__RUSTRA_DATA__ = {\"points\":[1,2,3]};"));
        // Data script comes before the body content.
        let data_pos = doc.find("__RUSTRA_DATA__").unwrap();
        let body_pos = doc.find("<div id=\"root\">").unwrap();
        assert!(data_pos < body_pos);
    }

    #[test]
    fn title_is_escaped_and_data_cannot_close_the_script() {
        let doc = render_document(&artifact(
            "<script>alert(1)</script>",
            "<p>ok</p>",
            json!({ "evil": "</script><script>alert(1)</script>" }),
        ));
        assert!(doc.contains("<title>&lt;script&gt;alert(1)&lt;/script&gt;</title>"));
        // The injected data never contains a literal `</script>`.
        let injection_line = doc
            .lines()
            .find(|l| l.contains("__RUSTRA_DATA__"))
            .expect("injection line");
        assert!(!injection_line.contains("</script><script>"));
        assert!(injection_line.contains("<\\/script>"));
    }

    #[test]
    fn data_cannot_open_a_script_comment() {
        let doc = render_document(&artifact(
            "t",
            "<p>ok</p>",
            json!({ "evil": "<!--<script>alert(1)</script>" }),
        ));
        let injection_line = doc
            .lines()
            .find(|l| l.contains("__RUSTRA_DATA__"))
            .expect("injection line");
        assert!(!injection_line.contains("<!--"));
        assert!(injection_line.contains("<\\u0021--"));
    }

    #[test]
    fn null_data_renders_as_null() {
        let doc = render_document(&artifact("t", "<p>x</p>", serde_json::Value::Null));
        assert!(doc.contains("window.__RUSTRA_DATA__ = null;"));
    }
}
