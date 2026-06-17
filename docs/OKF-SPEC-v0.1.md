# Open Knowledge Format (OKF) v0.1 — Specification

**Status:** Published  
**Date:** 2026-06-12 (Google) / 2026-06-17 (Neptune Reference Implementation)  
**Repository:** github.com/google/open-knowledge-format  

> **Neptune Note:** We've been building OKF-style knowledge systems for 6+ months before this spec was published. This document serves as both the OKF v0.1 spec reference AND the Neptune compatibility layer definition. See [Neptune-Knowledge-Spec v1.0](./NEPTUNE-KNOWLEDGE-SPEC-v1.0.md) for our superset extensions.

---

## 1. Overview

OKF (Open Knowledge Format) is a file-system-based convention for organizing AI-consumable knowledge. It standardizes directory structure, file naming, YAML frontmatter, and cross-referencing so that any AI agent can read, navigate, and contribute to a shared knowledge base.

**Core principle:** Every directory is self-describing. Every file declares its type. Every change is logged.

---

## 2. Directory Structure

```
<knowledge-root>/
├── index.md                  # Top-level overview of the entire knowledge base
├── log.md                    # Chronological change log
├── manifest.yaml             # (optional) Bundle manifest for export
├── <domain-1>/
│   ├── index.md              # Overview of this domain
│   ├── log.md                # Domain-specific change log
│   ├── <concept-1>.md        # A knowledge concept
│   ├── <concept-2>.md        # Another knowledge concept
│   └── ...
├── <domain-2>/
│   ├── index.md
│   └── ...
└── ...
```

### 2.1 Required Files

| File | Scope | Required? | Description |
|------|-------|-----------|-------------|
| `index.md` | Every directory | **YES** | Overview of directory contents, listing all files/subdirectories with brief descriptions |
| `log.md` | Top-level only | **RECOMMENDED** | Chronological log of significant changes to the knowledge base |
| `manifest.yaml` | Bundle root | **For export** | Machine-readable manifest of all files in an exported bundle |

### 2.2 File Naming

- Files: kebab-case (e.g., `billing-lifecycle.md`, `nmi-charge-flow.md`)
- Directories: kebab-case or domain-name (e.g., `billing-flow/`, `credit-disputes/`)
- No spaces in filenames
- `.md` extension for all knowledge content
- `.yaml` or `.yml` for configuration/manifests

---

## 3. YAML Frontmatter — Required Fields

Every `.md` file in an OKF knowledge base MUST have YAML frontmatter delimited by `---`. The following fields are required:

### 3.1 `type` (REQUIRED)

Declares the kind of knowledge artifact. Canonical values:

| `type` value | Description |
|-------------|-------------|
| `concept` | A single knowledge concept or topic |
| `playbook` | An operational workflow guide |
| `skill` | An agent capability definition |
| `connector` | An external system integration |
| `index` | A directory index/overview |
| `mission` | A tracked mission with state |
| `research` | Research findings or analysis |
| `prd` | Product requirements document |
| `memory` | Persistent memory reference |
| `spec` | Technical specification |

### 3.2 `name` (REQUIRED)

Human-readable name for the artifact. Short, descriptive, unique within its domain.

```yaml
name: "Billing Lifecycle Management"
```

### 3.3 `description` (REQUIRED)

One to three sentences describing what this artifact contains and how it should be used.

```yaml
description: "Complete lifecycle of a NewLeaf billing transaction — charge initiation, decline handling, recovery retry, and vault management."
```

### 3.4 `version` (REQUIRED)

Semantic version string. Use `0.1.0` for new/experimental, `1.0.0` for stable.

```yaml
version: "1.0.0"
```

### 3.5 `updated` (REQUIRED)

ISO 8601 date of last significant content change.

```yaml
updated: "2026-06-17"
```

---

## 4. YAML Frontmatter — Optional Fields

### 4.1 `tags`

Array of keyword tags for categorization and search.

```yaml
tags: ["billing", "nmi", "payments", "recovery", "p0"]
```

### 4.2 `domain`

The primary domain this artifact belongs to.

```yaml
domain: "billing-flow"
```

### 4.3 `status`

Lifecycle status of the artifact.

| Value | Meaning |
|-------|---------|
| `draft` | Work in progress, may be incomplete |
| `review` | Under review |
| `stable` | Production-ready, actively maintained |
| `deprecated` | Still valid but superseded |
| `archived` | Historical only, no longer applicable |

```yaml
status: "stable"
```

### 4.4 `author`

Who created or primarily maintains this artifact.

```yaml
author: "abhiswami2121@gmail.com"
```

### 4.5 `links`

Array of related artifacts, expressed as relative file paths.

```yaml
links:
  - "../billing/billing-lifecycle.md"
  - "../../connectors/nmi/SKILL.md"
  - "./nmi-charge-flow.md"
```

### 4.6 `access`

Visibility/access level. See Section 7 (RBAC).

```yaml
access: "internal"
```

---

## 5. Cross-Linking Convention

All cross-references between OKF files MUST use **relative markdown links**:

```markdown
See [Billing Lifecycle](../billing/billing-lifecycle.md) for the complete flow.
The NMI connector is defined at [NMI SKILL.md](../../connectors/nmi/SKILL.md).
```

**Rules:**
- Always relative (never absolute paths)
- Always `.md` extension
- Link text should be the target artifact's `name`
- Broken links are a spec violation

---

## 6. `index.md` Format

Every directory MUST have an `index.md` with:

```markdown
---
type: index
name: "<Directory Name>"
description: "<Brief overview of what this directory contains>"
version: "1.0.0"
updated: "<ISO date>"
---

# <Directory Name>

<Brief paragraph describing the purpose of this directory.>

## Contents

| File | Type | Description |
|------|------|-------------|
| [billing-lifecycle.md](./billing-lifecycle.md) | playbook | Complete billing flow |
| [nmi-charge-flow.md](./nmi-charge-flow.md) | concept | NMI charge transaction flow |
```

---

## 7. `log.md` Format

Top-level `log.md` records significant changes chronologically:

```markdown
---
type: index
name: "Change Log"
description: "Chronological record of significant changes to this knowledge base"
version: "1.0.0"
updated: "2026-06-17"
---

# Change Log

## 2026-06-17
- **Added:** OKF v0.1 compatibility layer across all cortex directories
- **Added:** `type` field to all YAML frontmatter
- **Added:** `index.md` files to all major directories

## 2026-06-16
- **Added:** Twenty CRM migration master synthesis
- **Added:** Base44 full audit documentation
```

---

## 8. `manifest.yaml` Format (Bundle Export)

When exporting an OKF bundle, a `manifest.yaml` is generated at the root:

```yaml
okf_version: "0.1"
bundle:
  name: "neptune-cortex"
  version: "1.0.0"
  exported: "2026-06-17T10:00:00Z"
  total_files: 537
  total_directories: 42

domains:
  - name: "billing-flow"
    path: "billing/"
    file_count: 15
    concepts:
      - file: "billing/billing-lifecycle.md"
        type: "playbook"
        name: "Billing Lifecycle"
      - file: "billing/nmi-charge-flow.md"
        type: "concept"
        name: "NMI Charge Flow"

files:
  - path: "billing/billing-lifecycle.md"
    type: "playbook"
    name: "Billing Lifecycle"
    version: "1.0.0"
    updated: "2026-06-17"
    tags: ["billing", "p0"]
    links:
      - "../connectors/nmi/SKILL.md"
```

---

## 9. OKF Bundle Structure (for export/distribution)

```
<okf-bundle-name>/
├── manifest.yaml              # Bundle metadata and file index
├── index.md                   # Bundle overview (generated)
├── log.md                     # Bundle change log (generated)
├── <domain-1>/
│   ├── index.md
│   ├── <concept>.md
│   └── ...
├── <domain-2>/
│   └── ...
└── _okf/
    └── spec-version.txt       # "0.1"
```

---

## 10. OKF-Compatible Visualizer

The OKF visualizer is a static HTML application that:
1. Loads an OKF bundle (from ZIP or directory)
2. Parses `manifest.yaml` for the file index
3. Renders an interactive file browser with directory tree
4. Shows file content with YAML frontmatter rendered as metadata cards
5. Supports search across all file names and descriptions
6. Renders a D3.js force-directed graph from cross-links
7. Works entirely client-side (no server required)

**Reference implementation:** The Google OKF visualizer is a single HTML file with embedded JavaScript. Neptune forks this and extends it with:
- Playbook view mode
- Active mission overlay
- Memory references inline
- Knowledge graph (Graphify) integration

---

## 11. Neptune Compatibility Statement

Neptune fully implements OKF v0.1 with the following:

| OKF Requirement | Neptune Status |
|----------------|----------------|
| `index.md` in every directory | ✅ Generated automatically |
| `type` field in all YAML frontmatter | ✅ Added to all 500+ files |
| `log.md` at top level | ✅ Maintained at cortex roots |
| Relative markdown cross-links | ✅ Standardized across all files |
| `manifest.yaml` for export | ✅ Generated by export script |
| Visualizer | ✅ Forked + extended at `/knowledge` |

**Extensions (Neptune-Knowledge-Spec v1.0 superset):**
See [NEPTUNE-KNOWLEDGE-SPEC-v1.0.md](./NEPTUNE-KNOWLEDGE-SPEC-v1.0.md) for the 10 innovations Neptune adds beyond OKF v0.1.

---

## 12. Reference

- **OKF GitHub:** github.com/google/open-knowledge-format  
- **OKF Blog:** cloud.google.com/blog/products/ai-machine-learning/open-knowledge-format  
- **Neptune Reference Implementation:** github.com/abhiswami2121/neptune-chat  
- **Neptune-Knowledge-Spec v1.0:** [NEPTUNE-KNOWLEDGE-SPEC-v1.0.md](./NEPTUNE-KNOWLEDGE-SPEC-v1.0.md)  
- **Sample OKF Bundles:** (GA4, Stack Overflow, Bitcoin — see OKF repo)  

---

*OKF v0.1 — Open Knowledge Format. A file-system convention for AI-consumable knowledge.*  
*Neptune Compatibility Layer — 100% OKF v0.1 compatible with 10 production-grade extensions.*
