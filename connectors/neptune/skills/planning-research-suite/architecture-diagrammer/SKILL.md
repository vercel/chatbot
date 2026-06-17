---
name: architecture-diagrammer
version: 1.0.0
domain: planning-research
connector: neptune
scope: planning-research-suite
priority: P1
intent_tags:
  - diagram
  - architecture diagram
  - flowchart
  - sequence diagram
  - mermaid
  - visualize
  - draw
  - illustrate
associated_skills:
  - draft-prd
  - draft-trd
headline: |
  Generate Mermaid diagrams from structural analysis. Supports 8 diagram types:
  flowchart, sequence, class, ER, C4 context, C4 container, state, and Gantt.
type: "skill"
access: internal
---

# Architecture Diagrammer — Mermaid Generation

## Core Intent

Analyze a system's structure (from codebase, description, or PRD) and generate
appropriate Mermaid diagrams. Supports multiple diagram types for different
perspectives: architecture (C4), behavior (sequence/state), data (ER/class),
and planning (Gantt).

## Supported Diagram Types

| Type | Use Case | Mermaid Directive |
|------|----------|-------------------|
| C4 Context | System boundaries and external dependencies | `C4Context` |
| C4 Container | Internal services, databases, queues | `C4Container` |
| Sequence | Message flow between components | `sequenceDiagram` |
| Flowchart | Process flow, decision trees | `flowchart TD/LR` |
| Class | Object-oriented class relationships | `classDiagram` |
| ER | Entity-relationship data models | `erDiagram` |
| State | State machine transitions | `stateDiagram-v2` |
| Gantt | Project timeline, phase scheduling | `gantt` |

## Action Catalog

### Analysis (3 actions)

| # | Action | Description |
|---|--------|-------------|
| 1 | `diagram.analyze_system` | Analyze a system description for diagram opportunities |
| 2 | `diagram.recommend_types` | Recommend which diagram types to generate |
| 3 | `diagram.analyze_codebase` | Analyze codebase structure for class/ER diagrams |

### Generation (5 actions)

| 4 | `diagram.generate_c4` | Generate C4 context and container diagrams |
| 5 | `diagram.generate_sequence` | Generate sequence diagram for a specific flow |
| 6 | `diagram.generate_flowchart` | Generate flowchart for a process |
| 7 | `diagram.generate_er` | Generate ER diagram from entity definitions |
| 8 | `diagram.generate_gantt` | Generate Gantt chart from phased plan |

### Validation (2 actions)

| 9 | `diagram.validate` | Validate Mermaid syntax correctness |
| 10 | `diagram.check_completeness` | Check all nodes connected, all actors represented |

## Procedure

1. Identify the system or flow to diagram
2. Analyze structure: identify actors, components, relationships, flows
3. Recommend appropriate diagram types based on analysis
4. Generate C4 context diagram (system boundaries + external actors)
5. Generate C4 container diagram (internal services + infrastructure)
6. Generate sequence diagrams for 3-5 key flows
7. Generate ER diagram if data model is defined
8. Generate Gantt chart if phases/timeline is available
9. Validate all generated diagrams for syntax correctness
10. Check completeness: all nodes connected, all actors represented
11. Return Mermaid syntax strings ready for embedding
12. Annotate completion

## Diagram Selection Guide

```
System architecture overview?   → C4 Context + Container
API / service interactions?     → Sequence
Business process?               → Flowchart
Data model / schema?            → ER Diagram
Object-oriented design?         → Class Diagram
State machine / lifecycle?      → State Diagram
Project timeline?               → Gantt
```

## Output Structure

```typescript
interface DiagrammerOutput {
  system_name: string;
  diagrams: Array<{
    type: string;
    title: string;
    mermaid_syntax: string;
    description: string;
    validation: {
      syntax_valid: boolean;
      completeness_score: number;  // 0.0-1.0
      nodes: number;
      edges: number;
    };
  }>;
  total_diagrams: number;
  recommendations: string[];
}
```

## Anti-Patterns

- DON'T generate diagrams without analyzing the system first
- DON'T generate all 8 types — pick the 2-4 most relevant
- DON'T skip validation — broken Mermaid syntax renders nothing
- DON'T create diagrams with orphaned nodes — every node must be connected
- DON'T embed massive diagrams (>30 nodes) — break into sub-diagrams

## C4 Diagram Conventions

- **Blue boxes**: Internal systems
- **Grey boxes**: External systems
- **Person icon**: Human actors
- **Arrows**: Data flow direction with description
- **Containers**: Named with technology (e.g., "Next.js API [Container: Node.js]")
- **Nesting**: Containers nested within the system boundary

## Related Skills

- `draft-prd` — embeds C4 context diagram in PRD
- `draft-trd` — embeds full C4 suite + sequence diagrams in TRD
