/**
 * Neptune-Knowledge-Spec v1.0 — TypeScript Type Definitions
 * Reference implementation for NKS v1.0.
 * OKF v0.1 compatible superset.
 */

// ---- Core Types ----

export type NksType =
  | "index"
  | "concept"
  | "prd"
  | "spec"
  | "playbook"
  | "skill"
  | "connector"
  | "mission"
  | "research"
  | "memory"
  | "workflow"
  | "template"
  | "audit"
  | "design";

export type NksAccess = "public" | "internal" | "restricted" | "customer";

export type NksStatus = "draft" | "review" | "stable" | "deprecated" | "archived";

export type NksPriority = "P0" | "P1" | "P2" | "P3" | "P4" | "P5";

export type NksMemoryType = "reference" | "rule" | "preference" | "fact" | "context";

export type NksPersistence = "session" | "permanent";

export type NksMissionState = "proposed" | "active" | "executing" | "paused" | "completed" | "failed" | "archived";

export type NksScope = "domain" | "connector" | "cross-cutting";

// ---- Component Types ----

export interface NksUiComponent {
  name: string;
  path: string;
  props?: string[];
}

export interface NksUiSchema {
  layout: "grid" | "list" | "table" | "card";
  searchable?: boolean;
  filters?: string[];
}

// ---- Mission Types ----

export interface NksMissionProgress {
  completed: number;
  total: number;
  percentage: number;
}

export interface NksMissionEvent {
  date: string; // ISO 8601
  event: string;
}

// ---- Workflow Types ----

export interface NksWorkflowStep {
  id: string;
  action: string;
  params?: Record<string, unknown>;
  depends_on?: string[];
  condition?: string;
}

// ---- Audit Types ----

export interface NksAuditFindings {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface NksComplianceStatus {
  [standard: string]: "compliant" | "partial" | "non-compliant" | "not-applicable";
}

// ---- Self-Coding Types ----

export interface NksSelfCodeLimits {
  max_files: number;
  max_lines: number;
  require_build: boolean;
  require_smoke_test: boolean;
}

// ---- Main Frontmatter Interface ----

export interface NksFrontmatter {
  // === REQUIRED (all files) ===
  type: NksType;
  name: string;
  description: string;
  version: string; // Semantic version
  updated: string; // ISO 8601 date
  access: NksAccess;

  // === OPTIONAL (all files) ===
  tags?: string[];
  domain?: string;
  author?: string;
  status?: NksStatus;
  links?: string[]; // Relative markdown links

  // === NKS EXTENSIONS (type-dependent) ===

  // Playbook extensions
  scope?: NksScope;
  scope_connectors?: string[];
  triggers?: string[];
  trigger_tools?: string[];
  headline?: string;
  auto_load?: boolean;
  intent_tags?: string[];
  model_routing?: Record<string, string>;

  // Skill extensions
  mcp?: boolean;
  custom_client?: boolean;
  total_actions?: number;
  associated_skills?: string[];
  associated_connectors?: string[];
  associated_domains?: string[];

  // Mission extensions
  state?: NksMissionState;
  artifacts?: string[];
  progress?: NksMissionProgress;
  events?: NksMissionEvent[];

  // Memory extensions
  memory_id?: string;
  memory_type?: NksMemoryType;
  persistence?: NksPersistence;
  ttl_days?: number | null;
  referenced_by?: string[];

  // Template extensions
  template_for?: string;
  generates?: string[];
  required_inputs?: string[];
  scripts?: Record<string, string>;

  // UI extensions
  ui_components?: NksUiComponent[];
  ui_schema?: NksUiSchema;

  // Workflow extensions
  schedule?: string; // Cron expression
  steps?: NksWorkflowStep[];
  depends_on?: string[];
  condition?: string;
  notify_on_completion?: string;

  // Self-coding extensions
  self_code?: boolean;
  self_code_limits?: NksSelfCodeLimits;
  self_code_pattern?: string;

  // Audit extensions
  audit_date?: string;
  audit_scope?: string[];
  findings?: NksAuditFindings;
  compliance?: NksComplianceStatus;

  // Priority
  priority?: NksPriority;

  // Workflow links
  workflows?: string[];
}

// ---- Knowledge Graph Types ----

export interface NksGraphNode {
  id: string;
  label: string;
  type: NksType;
  domain: string;
  path: string;
  size: number;
  access: NksAccess;
}

export interface NksGraphEdge {
  source: string;
  target: string;
  relation: NksEdgeRelation;
}

export type NksEdgeRelation =
  | "references"
  | "uses"
  | "depends-on"
  | "triggers"
  | "orchestrates"
  | "remembers"
  | "pairs-with"
  | "supersedes";

// ---- Bundle Types ----

export interface NksBundle {
  okf_version: string;
  bundle: {
    name: string;
    version: string;
    exported: string;
    total_files: number;
    total_directories: number;
    source_repo: string;
    source_commit: string;
  };
  domains: NksBundleDomain[];
  files: NksBundleFile[];
}

export interface NksBundleDomain {
  name: string;
  path: string;
  file_count: number;
  concepts: NksBundleFile[];
}

export interface NksBundleFile {
  path: string;
  type: string;
  name: string;
  description: string;
  version: string;
  updated: string;
  tags: string[];
  links: string[];
  size: number;
}
