---
name: github-skills
version: 1.0.0
connector: github
scope: neptune-custom
total_actions: 35
priority: P1
intent_tags:
  - github
  - git
  - repo
  - code
  - pr
  - branch
associated_connectors:
  - vercel
  - base44
  - slack
headline: |
  35 GitHub actions: repos, branches, commits, PRs, issues, code search,
  reviews, workflows, releases, and collaboration. Full repository management.
type: "skill"
access: internal
---

# GitHub Skills — 35 Actions

## Core Intent
Complete GitHub repository management: search code, manage branches, create PRs, review code, manage issues, run workflows, and handle releases. All actions go through the GitHub REST API via the GitHub connector.

## Action Catalog

### Repository Management (5 actions)
| # | Action | Description |
|---|--------|-------------|
| 1 | `repo.info` | Get repository metadata, stars, forks, default branch |
| 2 | `repo.list` | List all repositories for the authenticated user |
| 3 | `repo.create` | Create a new repository with specified settings |
| 4 | `repo.fork` | Fork an existing repository |
| 5 | `repo.search` | Search repositories by name, language, topics |

### Branch Operations (4 actions)
| 6 | `branch.list` | List all branches in a repository |
| 7 | `branch.create` | Create a new branch from a base ref |
| 8 | `branch.delete` | Delete a branch (with safety confirmation) |
| 9 | `branch.compare` | Compare two branches, get diff stats |

### Commit Operations (4 actions)
| 10 | `commit.list` | List commits on a branch with pagination |
| 11 | `commit.get` | Get a specific commit by SHA |
| 12 | `commit.create` | Create a new commit with file changes |
| 13 | `commit.diff` | Get the diff for a specific commit |

### Pull Request Management (6 actions)
| 14 | `pr.list` | List pull requests with filters (state, author, label) |
| 15 | `pr.create` | Create a pull request with title, body, reviewers |
| 16 | `pr.get` | Get PR details including diff, comments, checks |
| 17 | `pr.merge` | Merge a PR with merge method selection |
| 18 | `pr.review` | Submit a PR review (approve, comment, request changes) |
| 19 | `pr.update` | Update PR title, body, base branch, or state |

### Code Search & File Operations (5 actions)
| 20 | `code.search` | Search code across repository by query |
| 21 | `code.read` | Read file content at a specific ref |
| 22 | `code.list_dir` | List directory contents at a path |
| 23 | `code.blame` | Get line-by-line authorship for a file |
| 24 | `code.languages` | Get language breakdown for a repository |

### Issue Management (5 actions)
| 25 | `issue.list` | List issues with filters (state, labels, assignee) |
| 26 | `issue.create` | Create a new issue with title, body, labels |
| 27 | `issue.get` | Get issue details with comments |
| 28 | `issue.comment` | Add a comment to an issue |
| 29 | `issue.close` | Close an issue with optional closing comment |

### Workflows & CI/CD (3 actions)
| 30 | `workflow.list` | List workflow runs with status filters |
| 31 | `workflow.rerun` | Re-run a failed workflow |
| 32 | `workflow.logs` | Get logs for a specific workflow run |

### Releases & Tags (3 actions)
| 33 | `release.create` | Create a new release with release notes |
| 34 | `release.list` | List releases for a repository |
| 35 | `tag.create` | Create a lightweight or annotated tag |

## Operational Context
- All calls go through `ghApi(path, method, body)` helper
- Token scopes needed: `repo`, `read:org`, `workflow`
- Rate limit: 5,000 requests/hour (authenticated), 30/min for search
- NEVER push directly to main on protected repos
- All AI commits go through PR with `ai-agent` label

## Anti-Patterns
- NEVER force-push to shared branches
- NEVER create PRs with generic titles
- NEVER search code without repo scoping
- NEVER expose GITHUB_TOKEN in output
- NEVER modify protected branches directly

## Workflow Examples

### Create a Feature PR
```
1. branch.create({ repo, name: "feat/description", base: "main" })
2. commit.create({ repo, branch, files, message })
3. pr.create({ repo, title, head: branch, base: "main", body })
```

### Code Review
```
1. pr.get({ repo, prNumber }) → read diff and files
2. code.search({ repo, query: "pattern" }) → find related code
3. pr.review({ repo, prNumber, event: "APPROVE", body })
```

### Diagnose CI Failure
```
1. workflow.list({ repo, status: "failure", limit: 1 })
2. workflow.logs({ repo, runId })
3. code.read({ repo, path: failingFile, ref: branch })
```
