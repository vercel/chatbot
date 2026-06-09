# Log Schema

The canonical JSONL schema expected by `ingest_logs.py` and `propose_diff.py`.

## One record per tool call

```json
{
  "ts": "2026-06-09T03:14:22Z",
  "session_id": "sess_abc123",
  "agent": "hermes-v1",
  "tool": "slack:send_message",
  "input": {
    "channel": "C0AQDDC3HAB",
    "text": "Mission complete."
  },
  "output": {
    "ok": true,
    "ts": "1717900462.001"
  },
  "error": null,
  "duration_ms": 234,
  "user_corrections": []
}
```

## Field reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `ts` | string | yes | ISO 8601 UTC. Always end with `Z`. |
| `session_id` | string | yes | Stable per agent run. Used for cross-session detection. |
| `agent` | string | yes | Which agent ran this. |
| `tool` | string | yes | `connector:tool_name` format. The connector prefix is critical — it's how the refiner routes findings to playbooks. |
| `input` | object | yes | Raw tool input. PII should be redacted here before logging. |
| `output` | object \| null | yes | Tool output on success. Null on failure. |
| `error` | object \| null | yes | Null on success. `{class, message, retryable}` on failure. |
| `duration_ms` | int | no | Tool call wall-clock duration. |
| `user_corrections` | array | no | User messages within 2 turns after the call that look like corrections. See UserCorrectionDetector for patterns. |

## Error sub-schema

```json
{
  "class": "RateLimited",
  "message": "Slack returned 429, retry-after 30s",
  "retryable": true
}
```

Common classes the detectors recognize:
- `RateLimited`
- `AuthFailed`
- `NotFound`
- `ValidationError`
- `Conflict`
- `Timeout`
- `Unknown` (fallback)

## User corrections sub-schema

```json
[
  {
    "turn": 4,
    "ts": "2026-06-09T03:15:11Z",
    "text": "no, don't post that to #social"
  }
]
```

The `turn` field is the relative turn count from the tool call (positive = after the call).

## Redaction expectations

The logger that produces these records is responsible for redacting:
- Card numbers (PAN), CVV, full track data
- SSN, DOB, full bank account numbers
- API tokens, OAuth bearer tokens
- Customer email/phone (unless explicitly required for the session)

The refiner trusts the logs. If unredacted PII is in the logs, the refiner will not detect it — fix the logger.
