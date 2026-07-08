//! Serde configuration types for MCP servers.
//!
//! The shapes deliberately mirror Mastra's `@mastra/mcp` `MCPClient`
//! configuration: a server is either a local process (`{ "command": ...,
//! "args": [...], "env": {...} }`) or a remote HTTP endpoint (`{ "url": ...,
//! "headers": {...} }`). The transport enum is untagged so both JSON shapes
//! deserialize directly, exactly like Mastra's `servers` map values.

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::time::Duration;

use rustra_core::{Error, Result, Visibility};
use rustra_storage::types::McpServerRecord;

/// Default per-request timeout, matching Mastra's 60s default.
pub const DEFAULT_TIMEOUT_MS: u64 = 60_000;

/// How to reach an MCP server. Untagged: the presence of `command` vs `url`
/// selects the variant, so plain Mastra-style JSON parses without a tag.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum McpTransport {
    /// Spawn a local process and speak newline-delimited JSON-RPC over its
    /// stdin/stdout (the MCP stdio transport).
    Stdio {
        command: String,
        #[serde(default)]
        args: Vec<String>,
        /// Extra environment variables for the child process. Values may
        /// reference secrets as `"${SECRET_NAME}"`; see
        /// [`McpServerDefinition::resolve_env`].
        #[serde(default)]
        env: BTreeMap<String, String>,
    },
    /// POST JSON-RPC requests to a remote endpoint (simplified Streamable
    /// HTTP: plain request/response, no SSE stream).
    Http {
        url: String,
        /// Extra HTTP headers sent with every request (e.g. authorization).
        #[serde(default)]
        headers: BTreeMap<String, String>,
    },
}

/// Who can discover and use a registered server.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum McpScope {
    /// Private to the registering user (default).
    #[default]
    User,
    /// Deployment-wide: stored without an owner and visible to every user.
    /// Registration requires the `developer` or `admin` role.
    Shared,
}

/// Where the server process actually runs.
///
/// * [`McpSide::ServerSide`] — the Rustra server process itself spawns the
///   command (stdio) or opens the HTTP connection. `McpRegistry::connect`
///   only ever connects to these.
/// * [`McpSide::ClientSide`] (default) — a client of the Rustra server (for
///   example a Chrome extension or desktop app) executes the MCP server
///   locally, next to the user. Rustra only stores the configuration and
///   forwards it to that client; the framework never spawns or dials the
///   server itself, so secrets and local processes stay on the user's
///   machine.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum McpSide {
    #[default]
    ClientSide,
    ServerSide,
}

/// A complete MCP server configuration — the unit users register.
///
/// This is the *only* thing needed to add an MCP server: no code, no plugin.
/// The same type serves both **static** servers (declared in host
/// configuration files at startup) and **dynamic** servers (registered at
/// runtime through [`crate::McpRegistry`]); statics are simply registered on
/// boot by the host.
///
/// The transport is `#[serde(flatten)]`ed, so the JSON shape matches
/// Mastra's:
///
/// ```json
/// { "name": "github", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"],
///   "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" } }
/// ```
///
/// or
///
/// ```json
/// { "name": "weather", "url": "https://example.com/mcp", "headers": { "Authorization": "${WEATHER_KEY}" } }
/// ```
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct McpServerDefinition {
    /// Unique kebab-case name; also the namespace prefix for bridged tools
    /// (`{name}_{tool}`).
    pub name: String,
    #[serde(flatten)]
    pub transport: McpTransport,
    /// Per-request timeout in milliseconds; `None` means
    /// [`DEFAULT_TIMEOUT_MS`] (60s).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timeout_ms: Option<u64>,
    /// Disabled servers are kept in storage but never connected.
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// When true, the agent loop must obtain human approval before each tool
    /// call on this server (enforced by the caller, not this crate).
    #[serde(default)]
    pub require_tool_approval: bool,
    /// Allow-list of remote tool names to expose. `None` exposes all.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub allowed_tools: Option<Vec<String>>,
    /// Who can discover and use the server; see [`McpScope`].
    #[serde(default)]
    pub scope: McpScope,
    /// Where the server process runs; see [`McpSide`].
    #[serde(default)]
    pub side: McpSide,
}

fn default_true() -> bool {
    true
}

impl McpServerDefinition {
    /// A server-side definition for `transport` with defaults for everything
    /// else — the single home of the constructor defaults.
    fn server_side(name: String, transport: McpTransport) -> Self {
        Self {
            name,
            transport,
            timeout_ms: None,
            enabled: true,
            require_tool_approval: false,
            allowed_tools: None,
            scope: McpScope::User,
            side: McpSide::ServerSide,
        }
    }

    /// A server-side stdio definition with defaults for everything else.
    pub fn stdio(name: impl Into<String>, command: impl Into<String>, args: Vec<String>) -> Self {
        Self::server_side(
            name.into(),
            McpTransport::Stdio {
                command: command.into(),
                args,
                env: BTreeMap::new(),
            },
        )
    }

    /// A server-side HTTP definition with defaults for everything else.
    pub fn http(name: impl Into<String>, url: impl Into<String>) -> Self {
        Self::server_side(
            name.into(),
            McpTransport::Http {
                url: url.into(),
                headers: BTreeMap::new(),
            },
        )
    }

    /// Set the per-request timeout in milliseconds.
    pub fn with_timeout_ms(mut self, ms: u64) -> Self {
        self.timeout_ms = Some(ms);
        self
    }

    /// Set who can discover and use the server.
    pub fn with_scope(mut self, scope: McpScope) -> Self {
        self.scope = scope;
        self
    }

    /// Set where the server process runs.
    pub fn with_side(mut self, side: McpSide) -> Self {
        self.side = side;
        self
    }

    /// Restrict the exposed tools to `tools`.
    pub fn with_allowed_tools(mut self, tools: Vec<String>) -> Self {
        self.allowed_tools = Some(tools);
        self
    }

    /// Set whether each tool call needs human approval first.
    pub fn with_tool_approval(mut self, required: bool) -> Self {
        self.require_tool_approval = required;
        self
    }

    /// The effective per-request timeout.
    pub fn timeout(&self) -> Duration {
        Duration::from_millis(self.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS))
    }

    /// Validate the definition. Called on registration and on connect.
    pub fn validate(&self) -> Result<()> {
        if self.name.is_empty() {
            return Err(Error::Validation(
                "mcp server name must not be empty".into(),
            ));
        }
        let name_ok = self
            .name
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_alphanumeric())
            && self
                .name
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_');
        if !name_ok {
            return Err(Error::Validation(format!(
                "mcp server name `{}` must be kebab-case (lowercase letters, digits, `-`, `_`, starting alphanumeric)",
                self.name
            )));
        }
        match &self.transport {
            McpTransport::Stdio { command, .. } => {
                if command.trim().is_empty() {
                    return Err(Error::Validation(format!(
                        "mcp server `{}`: stdio command must not be empty",
                        self.name
                    )));
                }
            }
            McpTransport::Http { url, .. } => {
                if !(url.starts_with("http://") || url.starts_with("https://")) {
                    return Err(Error::Validation(format!(
                        "mcp server `{}`: url must start with http:// or https:// (got `{url}`)",
                        self.name
                    )));
                }
            }
        }
        Ok(())
    }

    /// Resolve `${SECRET_NAME}` placeholders in the stdio `env` map using the
    /// host-supplied secret lookup. Secrets themselves are stored and managed
    /// outside this crate; configs only carry references.
    ///
    /// Returns an empty map for HTTP transports (they have no process env).
    /// Errors with [`Error::Config`] when a referenced secret is missing.
    pub fn resolve_env(
        &self,
        lookup: &dyn Fn(&str) -> Option<String>,
    ) -> Result<BTreeMap<String, String>> {
        let McpTransport::Stdio { env, .. } = &self.transport else {
            return Ok(BTreeMap::new());
        };
        env.iter()
            .map(|(key, value)| {
                Ok((
                    key.clone(),
                    resolve_placeholders(&self.name, value, lookup)?,
                ))
            })
            .collect()
    }

    /// The record owner for a definition registered by `user_id`:
    /// [`McpScope::Shared`] servers are deployment-owned (`None`).
    pub fn owner_for(&self, user_id: &str) -> Option<String> {
        match self.scope {
            McpScope::User => Some(user_id.to_string()),
            McpScope::Shared => None,
        }
    }

    /// The storage visibility implied by the scope.
    pub fn visibility(&self) -> Visibility {
        match self.scope {
            McpScope::User => Visibility::Private,
            McpScope::Shared => Visibility::Shared,
        }
    }

    /// Convert to a storage record. `Shared` scope ⇒ `owner_id: None` +
    /// [`Visibility::Shared`]; `User` scope ⇒ owned + private.
    pub fn to_record(&self, id: impl Into<String>, user_id: &str) -> Result<McpServerRecord> {
        let now = Utc::now();
        Ok(McpServerRecord {
            id: id.into(),
            owner_id: self.owner_for(user_id),
            name: self.name.clone(),
            config: serde_json::to_value(self)?,
            enabled: self.enabled,
            visibility: self.visibility(),
            created_at: now,
            updated_at: now,
        })
    }

    /// Parse the definition back out of a storage record.
    pub fn from_record(record: &McpServerRecord) -> Result<Self> {
        serde_json::from_value(record.config.clone()).map_err(|e| {
            Error::Config(format!(
                "invalid mcp server config for `{}`: {e}",
                record.id
            ))
        })
    }
}

/// Substitute every `${NAME}` occurrence in `value` via `lookup`.
fn resolve_placeholders(
    server: &str,
    value: &str,
    lookup: &dyn Fn(&str) -> Option<String>,
) -> Result<String> {
    let mut out = String::with_capacity(value.len());
    let mut rest = value;
    while let Some(start) = rest.find("${") {
        out.push_str(&rest[..start]);
        let after = &rest[start + 2..];
        let Some(end) = after.find('}') else {
            return Err(Error::Config(format!(
                "mcp server `{server}`: unterminated secret placeholder in `{value}`"
            )));
        };
        let name = &after[..end];
        let secret = lookup(name).ok_or_else(|| {
            Error::Config(format!(
                "mcp server `{server}`: secret `{name}` referenced in env is not available"
            ))
        })?;
        out.push_str(&secret);
        rest = &after[end + 1..];
    }
    out.push_str(rest);
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn stdio_json_shape_parses() {
        let def: McpServerDefinition = serde_json::from_value(json!({
            "name": "github",
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-github"],
            "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
        }))
        .unwrap();
        assert!(
            matches!(&def.transport, McpTransport::Stdio { command, args, .. }
            if command == "npx" && args.len() == 2)
        );
        // Defaults.
        assert!(def.enabled);
        assert!(!def.require_tool_approval);
        assert_eq!(def.timeout_ms, None);
        assert_eq!(def.timeout(), Duration::from_millis(60_000));
        assert_eq!(def.scope, McpScope::User);
        assert_eq!(def.side, McpSide::ClientSide);
        assert_eq!(def.allowed_tools, None);
        def.validate().unwrap();
    }

    #[test]
    fn http_json_shape_parses() {
        let def: McpServerDefinition = serde_json::from_value(json!({
            "name": "weather",
            "url": "https://example.com/mcp",
            "headers": { "Authorization": "Bearer abc" },
            "timeout_ms": 5000,
            "scope": "shared",
            "side": "server_side"
        }))
        .unwrap();
        assert!(matches!(&def.transport, McpTransport::Http { url, headers }
            if url == "https://example.com/mcp" && headers["Authorization"] == "Bearer abc"));
        assert_eq!(def.timeout(), Duration::from_millis(5000));
        assert_eq!(def.scope, McpScope::Shared);
        assert_eq!(def.side, McpSide::ServerSide);
        def.validate().unwrap();
    }

    #[test]
    fn serde_roundtrip_flattens_transport() {
        let def = McpServerDefinition::stdio("fs", "mcp-server-fs", vec!["/data".into()]);
        let value = serde_json::to_value(&def).unwrap();
        assert_eq!(value["command"], "mcp-server-fs"); // flattened, no tag
        assert!(value.get("transport").is_none());
        let back: McpServerDefinition = serde_json::from_value(value).unwrap();
        assert_eq!(back, def);
    }

    #[test]
    fn validation_failures() {
        let mut def = McpServerDefinition::stdio("", "cmd", vec![]);
        assert!(matches!(def.validate(), Err(Error::Validation(_))));

        def.name = "Bad Name".into();
        assert!(matches!(def.validate(), Err(Error::Validation(_))));

        def.name = "-leading".into();
        assert!(matches!(def.validate(), Err(Error::Validation(_))));

        let def = McpServerDefinition::stdio("ok-name", "  ", vec![]);
        assert!(matches!(def.validate(), Err(Error::Validation(_))));

        let def = McpServerDefinition::http("ok-name", "ftp://example.com");
        assert!(matches!(def.validate(), Err(Error::Validation(_))));

        McpServerDefinition::http("ok-name", "http://example.com")
            .validate()
            .unwrap();
    }

    #[test]
    fn resolve_env_substitutes_secrets() {
        let mut def = McpServerDefinition::stdio("gh", "npx", vec![]);
        if let McpTransport::Stdio { env, .. } = &mut def.transport {
            env.insert("GITHUB_TOKEN".into(), "${GITHUB_TOKEN}".into());
            env.insert("HEADER".into(), "Bearer ${GITHUB_TOKEN} extra".into());
            env.insert("PLAIN".into(), "no-secret".into());
        }
        let lookup = |name: &str| (name == "GITHUB_TOKEN").then(|| "s3cr3t".to_string());
        let resolved = def.resolve_env(&lookup).unwrap();
        assert_eq!(resolved["GITHUB_TOKEN"], "s3cr3t");
        assert_eq!(resolved["HEADER"], "Bearer s3cr3t extra");
        assert_eq!(resolved["PLAIN"], "no-secret");
    }

    #[test]
    fn resolve_env_missing_secret_errors() {
        let mut def = McpServerDefinition::stdio("gh", "npx", vec![]);
        if let McpTransport::Stdio { env, .. } = &mut def.transport {
            env.insert("TOKEN".into(), "${MISSING}".into());
        }
        let err = def.resolve_env(&|_| None).unwrap_err();
        assert!(matches!(err, Error::Config(_)), "got {err:?}");
    }

    #[test]
    fn resolve_env_unterminated_placeholder_errors() {
        let mut def = McpServerDefinition::stdio("gh", "npx", vec![]);
        if let McpTransport::Stdio { env, .. } = &mut def.transport {
            env.insert("TOKEN".into(), "${OOPS".into());
        }
        let err = def.resolve_env(&|_| Some("x".into())).unwrap_err();
        assert!(matches!(err, Error::Config(_)), "got {err:?}");
    }

    #[test]
    fn record_roundtrip_private() {
        let def = McpServerDefinition::stdio("fs", "mcp-server-fs", vec![]);
        let record = def.to_record("mcp_1", "alice").unwrap();
        assert_eq!(record.owner_id.as_deref(), Some("alice"));
        assert_eq!(record.visibility, Visibility::Private);
        assert_eq!(record.name, "fs");
        assert!(record.enabled);
        assert_eq!(McpServerDefinition::from_record(&record).unwrap(), def);
    }

    #[test]
    fn record_roundtrip_shared() {
        let mut def = McpServerDefinition::http("api", "https://example.com/mcp");
        def.scope = McpScope::Shared;
        let record = def.to_record("mcp_2", "dev").unwrap();
        assert_eq!(record.owner_id, None);
        assert_eq!(record.visibility, Visibility::Shared);
        assert_eq!(McpServerDefinition::from_record(&record).unwrap(), def);
    }
}
