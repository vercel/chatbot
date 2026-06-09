"""
ingest_logs.py — normalize tool-call logs from different agent frameworks
into a single canonical schema for the refiner.

Canonical schema (see references/log-schema.md):
{
  "ts": "2026-06-09T03:14:22Z",       # ISO 8601 UTC
  "session_id": "sess_abc123",
  "agent": "hermes-v1",                # which agent ran
  "tool": "slack:send_message",        # connector:tool format
  "input": {...},                      # tool input params
  "output": {...} | null,              # tool output if success
  "error": {                           # null if success
    "class": "RateLimited",
    "message": "...",
    "retryable": true
  },
  "duration_ms": 234,
  "user_corrections": [                # turns where user pushed back
    {"turn": 4, "text": "no, don't post there"}
  ]
}
"""

from __future__ import annotations
import json
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Any


@dataclass
class ToolCall:
    ts: str
    session_id: str
    agent: str
    tool: str
    input: dict[str, Any]
    output: dict[str, Any] | None = None
    error: dict[str, Any] | None = None
    duration_ms: int = 0
    user_corrections: list[dict[str, Any]] = field(default_factory=list)

    def connector(self) -> str:
        return self.tool.split(":", 1)[0] if ":" in self.tool else "unknown"


def from_claude_sdk_trace(blob: dict) -> Iterator[ToolCall]:
    """Parse Claude Agent SDK trace dump format."""
    for entry in blob.get("trace", []):
        if entry.get("type") != "tool_use":
            continue
        result = entry.get("result", {})
        yield ToolCall(
            ts=entry.get("ts") or datetime.now(timezone.utc).isoformat(),
            session_id=blob.get("session_id", "unknown"),
            agent=blob.get("agent", "unknown"),
            tool=entry.get("name", "unknown"),
            input=entry.get("input", {}),
            output=result if not result.get("error") else None,
            error=result.get("error"),
            duration_ms=entry.get("duration_ms", 0),
        )


def from_openai_run(blob: dict) -> Iterator[ToolCall]:
    """Parse OpenAI Agents SDK run log format."""
    for step in blob.get("steps", []):
        if step.get("type") != "function_call":
            continue
        yield ToolCall(
            ts=step.get("created_at") or datetime.now(timezone.utc).isoformat(),
            session_id=blob.get("run_id", "unknown"),
            agent=blob.get("assistant_id", "unknown"),
            tool=step.get("function", {}).get("name", "unknown"),
            input=json.loads(step.get("function", {}).get("arguments", "{}")),
            output=step.get("output"),
            error=step.get("error"),
            duration_ms=step.get("duration_ms", 0),
        )


def from_canonical_jsonl(line: str) -> ToolCall | None:
    """Parse a line of our canonical JSONL format."""
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    obj = json.loads(line)
    return ToolCall(**obj)


def load(path: Path) -> Iterator[ToolCall]:
    """Auto-detect format and yield ToolCall objects."""
    if path.is_dir():
        for p in sorted(path.glob("**/*.jsonl")):
            yield from load(p)
        for p in sorted(path.glob("**/*.json")):
            yield from load(p)
        return

    if path.suffix == ".jsonl":
        with path.open() as f:
            for line in f:
                call = from_canonical_jsonl(line)
                if call:
                    yield call
        return

    if path.suffix == ".json":
        blob = json.loads(path.read_text())
        # detect by shape
        if "trace" in blob and "session_id" in blob:
            yield from from_claude_sdk_trace(blob)
        elif "steps" in blob and "run_id" in blob:
            yield from from_openai_run(blob)
        else:
            print(f"warn: unrecognized JSON shape in {path}", file=sys.stderr)


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("path", type=Path, help="Log file or directory")
    ap.add_argument("--output", type=Path, default=Path("normalized.jsonl"))
    args = ap.parse_args()

    count = 0
    with args.output.open("w") as out:
        for call in load(args.path):
            out.write(json.dumps(asdict(call)) + "\n")
            count += 1

    print(f"normalized {count} tool calls → {args.output}")


if __name__ == "__main__":
    main()
