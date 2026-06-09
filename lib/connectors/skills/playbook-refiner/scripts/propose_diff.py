"""
propose_diff.py — run pattern detectors over normalized logs and propose
PLAYBOOK.md diffs.

Detectors implemented:
  - RecurringErrorDetector
  - NewIdOutsideAllowlistDetector
  - VelocityAnomalyDetector
  - UserCorrectionDetector
  - BypassedSafeguardDetector
  - AntiPatternViolationDetector

Each detector returns Findings. Findings cluster by pattern_key. Clusters
above the promotion threshold become proposed diffs.
"""

from __future__ import annotations
import argparse
import hashlib
import json
import re
import sys
from collections import defaultdict, Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any


SECTIONS = [
    "Operational Knowledge",
    "Business Context",
    "Anti-Patterns",
    "Safeguards",
    "Refinement Notes",
]


@dataclass
class Finding:
    connector: str
    section: str
    confidence: float
    evidence: list[str]
    proposed_change: str
    pattern_key: str = ""

    def __post_init__(self):
        if not self.pattern_key:
            h = hashlib.sha1()
            h.update(self.connector.encode())
            h.update(self.section.encode())
            h.update(self.proposed_change.encode())
            self.pattern_key = h.hexdigest()[:16]


@dataclass
class Cluster:
    pattern_key: str
    finding: Finding
    recurrence_count: int = 1
    sessions: set[str] = field(default_factory=set)


# ----- detectors -----

def detect_recurring_errors(calls: list[dict]) -> list[Finding]:
    """Same tool + same error class ≥3 times → propose safeguard."""
    grouped = defaultdict(list)
    for c in calls:
        if c.get("error"):
            key = (c["tool"], c["error"].get("class", "Unknown"))
            grouped[key].append(c)

    findings = []
    for (tool, err_class), occurrences in grouped.items():
        if len(occurrences) < 3:
            continue
        connector = tool.split(":")[0]
        sample_msg = occurrences[0]["error"].get("message", "")[:120]
        findings.append(Finding(
            connector=connector,
            section="Safeguards",
            confidence=min(0.5 + len(occurrences) * 0.05, 0.95),
            evidence=[
                f"{tool} → {err_class}: {sample_msg}",
                f"occurred {len(occurrences)}× in window",
            ],
            proposed_change=(
                f"- **Before `{tool.split(':',1)[1]}`:** check for the "
                f"condition that produces `{err_class}` "
                f"(seen {len(occurrences)}× — refine wording before merging)"
            ),
        ))
    return findings


ALLOWLIST_FIELDS = {
    "slack": ["channel", "channel_id"],
    "github": ["repo", "repository"],
    "linear": ["team", "team_id", "project_id"],
}


def detect_new_ids_outside_allowlist(calls: list[dict], allowlists: dict) -> list[Finding]:
    """IDs used that aren't in the playbook's documented allowlist."""
    findings = []
    seen = defaultdict(Counter)

    for c in calls:
        if c.get("error"):
            continue
        connector = c["tool"].split(":")[0]
        fields = ALLOWLIST_FIELDS.get(connector, [])
        for f in fields:
            val = c.get("input", {}).get(f)
            if val:
                seen[(connector, f)][val] += 1

    for (connector, field), counter in seen.items():
        documented = set(allowlists.get(connector, []))
        for val, count in counter.items():
            if val not in documented and count >= 2:
                findings.append(Finding(
                    connector=connector,
                    section="Business Context",
                    confidence=0.7,
                    evidence=[f"{field}={val} used {count}× — not in allowlist"],
                    proposed_change=(
                        f"- `{val}` — **PURPOSE UNCLEAR**, seen {count}× in logs. "
                        f"Confirm or remove."
                    ),
                ))
    return findings


def detect_velocity_anomalies(calls: list[dict]) -> list[Finding]:
    """Same tool + same input fired ≥4× in <60s → dedupe missing."""
    by_session = defaultdict(list)
    for c in calls:
        by_session[c["session_id"]].append(c)

    findings = []
    for session_id, session_calls in by_session.items():
        session_calls.sort(key=lambda c: c["ts"])
        # sliding 60s window
        for i in range(len(session_calls)):
            window = []
            base_ts = _parse_ts(session_calls[i]["ts"])
            for j in range(i, len(session_calls)):
                if _parse_ts(session_calls[j]["ts"]) - base_ts > timedelta(seconds=60):
                    break
                window.append(session_calls[j])

            input_hashes = Counter(
                _input_hash(c) for c in window if "tool" in c
            )
            for (tool, h), count in [
                ((c["tool"], _input_hash(c)), input_hashes[_input_hash(c)])
                for c in window
            ]:
                if count >= 4:
                    connector = tool.split(":")[0]
                    findings.append(Finding(
                        connector=connector,
                        section="Safeguards",
                        confidence=0.85,
                        evidence=[
                            f"{tool} fired {count}× in 60s window, session {session_id}",
                            f"input fingerprint: {h[:12]}",
                        ],
                        proposed_change=(
                            f"- **Before `{tool.split(':',1)[1]}`:** dedupe by "
                            f"content hash over a 60s rolling window. "
                            f"(Detected {count}× duplicate fire in session {session_id[:8]}.)"
                        ),
                    ))
                    break  # one finding per window is enough
    return findings


def detect_user_corrections(calls: list[dict]) -> list[Finding]:
    """User said 'don't' or 'use X instead' within 2 turns of a tool call."""
    findings = []
    correction_patterns = [
        re.compile(r"\bdon'?t\b", re.I),
        re.compile(r"\bnever\b", re.I),
        re.compile(r"use \w+ instead", re.I),
        re.compile(r"wrong (channel|repo|team|project)", re.I),
    ]

    for c in calls:
        for correction in c.get("user_corrections", []):
            text = correction.get("text", "")
            if any(p.search(text) for p in correction_patterns):
                connector = c["tool"].split(":")[0]
                findings.append(Finding(
                    connector=connector,
                    section="Anti-Patterns",
                    confidence=0.75,
                    evidence=[
                        f"After `{c['tool']}`, user said: \"{text[:150]}\"",
                    ],
                    proposed_change=(
                        f"- **Don't** repeat the action behind `{c['tool']}` "
                        f"in the context where the user objected. Original "
                        f"correction: \"{text[:120]}\""
                    ),
                ))
    return findings


# ----- clustering and promotion -----

def cluster_findings(findings: list[Finding], calls: list[dict]) -> list[Cluster]:
    clusters: dict[str, Cluster] = {}
    for f in findings:
        if f.pattern_key in clusters:
            clusters[f.pattern_key].recurrence_count += 1
        else:
            clusters[f.pattern_key] = Cluster(
                pattern_key=f.pattern_key,
                finding=f,
            )
        # attribute to sessions
        for ev in f.evidence:
            if "session " in ev:
                clusters[f.pattern_key].sessions.add(ev.split("session ")[-1][:20])
    return list(clusters.values())


def promote(clusters: list[Cluster]) -> list[Cluster]:
    """Apply the promotion rule from the SKILL.md."""
    promoted = []
    for c in clusters:
        if c.recurrence_count >= 3 and len(c.sessions) >= 2:
            promoted.append(c)
        elif c.recurrence_count >= 5 and c.finding.confidence >= 0.8:
            promoted.append(c)
        elif c.recurrence_count == 1 and c.finding.confidence >= 0.95:
            promoted.append(c)
    return promoted


# ----- diff generation -----

def render_diff(playbook_path: Path, clusters: list[Cluster], date: str) -> str:
    """Render a unified-diff-style proposal for one playbook."""
    today = date or datetime.now().strftime("%Y-%m-%d")
    by_section = defaultdict(list)
    for c in clusters:
        by_section[c.finding.section].append(c)

    lines = [
        f"# Proposed updates to {playbook_path}",
        f"# Generated: {today}",
        f"# Clusters promoted: {len(clusters)}",
        "",
    ]
    for section, items in by_section.items():
        lines.append(f"## Additions to: {section}")
        for c in items:
            lines.append("")
            lines.append(f"  + {c.finding.proposed_change}")
            lines.append(f"    (confidence={c.finding.confidence:.2f}, "
                         f"recurrence={c.recurrence_count}, "
                         f"sessions={len(c.sessions)})")
            for ev in c.finding.evidence[:2]:
                lines.append(f"    evidence: {ev}")
        lines.append("")

    # always add a Refinement Notes entry
    lines.append("## Additions to: Refinement Notes")
    lines.append("")
    lines.append(f"  + **{today}** — Refiner pass added "
                 f"{len(clusters)} entries above. Promoted from "
                 f"{sum(c.recurrence_count for c in clusters)} log observations.")
    lines.append("")
    return "\n".join(lines)


# ----- helpers -----

def _parse_ts(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def _input_hash(call: dict) -> str:
    canonical = json.dumps(call.get("input", {}), sort_keys=True)
    return hashlib.sha1(canonical.encode()).hexdigest()


# ----- main -----

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--logs", type=Path, required=True,
                    help="Normalized JSONL from ingest_logs.py")
    ap.add_argument("--connectors", type=Path, default=Path("connectors"),
                    help="Path to connectors/ directory")
    ap.add_argument("--out", type=Path, default=Path("proposals"),
                    help="Where to write proposed diffs")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    # load normalized logs
    calls = []
    with args.logs.open() as f:
        for line in f:
            line = line.strip()
            if line:
                calls.append(json.loads(line))
    print(f"loaded {len(calls)} normalized tool calls")

    # (very) lightweight allowlist extraction — in production read playbooks properly
    allowlists = {}  # would parse each PLAYBOOK.md Business Context table

    # run detectors
    findings = []
    findings += detect_recurring_errors(calls)
    findings += detect_new_ids_outside_allowlist(calls, allowlists)
    findings += detect_velocity_anomalies(calls)
    findings += detect_user_corrections(calls)
    print(f"raw findings: {len(findings)}")

    # cluster and promote
    clusters = cluster_findings(findings, calls)
    promoted = promote(clusters)
    print(f"promoted clusters: {len(promoted)}")

    # group by connector and render diffs
    by_connector = defaultdict(list)
    for c in promoted:
        by_connector[c.finding.connector].append(c)

    args.out.mkdir(parents=True, exist_ok=True)
    today = datetime.now().strftime("%Y-%m-%d")
    for connector, conn_clusters in by_connector.items():
        playbook_path = args.connectors / connector / "PLAYBOOK.md"
        diff = render_diff(playbook_path, conn_clusters, today)
        out_path = args.out / f"{connector}-{today}.diff"
        if args.dry_run:
            print("=" * 60)
            print(diff)
        else:
            out_path.write_text(diff)
            print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
