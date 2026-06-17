/**
 * Neptune-Knowledge-Spec v1.0 — Validator
 * Validates NKS frontmatter against the v1.0 schema.
 * OKF v0.1 compatible — all OKF files pass NKS validation.
 */
import { NksFrontmatter, NksType, NksAccess, NksStatus, NksPriority } from "./types";

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationWarning {
  field: string;
  message: string;
}

const VALID_TYPES: NksType[] = [
  "index", "concept", "prd", "spec", "playbook", "skill",
  "connector", "mission", "research", "memory", "workflow",
  "template", "audit", "design",
];

const VALID_ACCESS: NksAccess[] = ["public", "internal", "restricted", "customer"];
const VALID_STATUS: NksStatus[] = ["draft", "review", "stable", "deprecated", "archived"];
const VALID_PRIORITIES: NksPriority[] = ["P0", "P1", "P2", "P3", "P4", "P5"];
const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateNksFrontmatter(fm: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Required fields
  if (!fm.type || !VALID_TYPES.includes(fm.type as NksType)) {
    errors.push({ field: "type", message: `Must be one of: ${VALID_TYPES.join(", ")}`, value: fm.type });
  }

  if (!fm.name || typeof fm.name !== "string" || fm.name.length < 1 || fm.name.length > 200) {
    errors.push({ field: "name", message: "Required string, 1-200 characters", value: fm.name });
  }

  if (!fm.description || typeof fm.description !== "string" || fm.description.length < 1) {
    errors.push({ field: "description", message: "Required string, at least 1 character", value: fm.description });
  }

  if (!fm.version || typeof fm.version !== "string" || !SEMVER_REGEX.test(fm.version)) {
    errors.push({ field: "version", message: "Must be valid semver (e.g., 1.0.0)", value: fm.version });
  }

  if (!fm.updated || typeof fm.updated !== "string" || !ISO_DATE_REGEX.test(fm.updated)) {
    errors.push({ field: "updated", message: "Must be ISO 8601 date (YYYY-MM-DD)", value: fm.updated });
  }

  if (!fm.access || !VALID_ACCESS.includes(fm.access as NksAccess)) {
    errors.push({ field: "access", message: `Must be one of: ${VALID_ACCESS.join(", ")}`, value: fm.access });
  }

  // Optional field validations
  if (fm.status && !VALID_STATUS.includes(fm.status as NksStatus)) {
    warnings.push({ field: "status", message: `Should be one of: ${VALID_STATUS.join(", ")}` });
  }

  if (fm.priority && !VALID_PRIORITIES.includes(fm.priority as NksPriority)) {
    warnings.push({ field: "priority", message: `Should be one of: ${VALID_PRIORITIES.join(", ")}` });
  }

  if (fm.author && typeof fm.author === "string" && !EMAIL_REGEX.test(fm.author)) {
    warnings.push({ field: "author", message: "Should be a valid email address" });
  }

  if (fm.tags && !Array.isArray(fm.tags)) {
    errors.push({ field: "tags", message: "Must be an array of strings", value: fm.tags });
  } else if (fm.tags && fm.tags.length === 0) {
    warnings.push({ field: "tags", message: "Consider adding at least one tag" });
  }

  if (fm.links && !Array.isArray(fm.links)) {
    errors.push({ field: "links", message: "Must be an array of relative paths", value: fm.links });
  }

  // NKS extension validations
  if (fm.self_code === true && !fm.self_code_limits) {
    warnings.push({ field: "self_code_limits", message: "self_code is true but no limits defined" });
  }

  if (fm.state && typeof fm.state === "string") {
    const validStates = ["proposed", "active", "executing", "paused", "completed", "failed", "archived"];
    if (!validStates.includes(fm.state)) {
      warnings.push({ field: "state", message: `Should be one of: ${validStates.join(", ")}` });
    }
  }

  if (fm.progress && typeof fm.progress === "object") {
    const p = fm.progress as Record<string, unknown>;
    if (typeof p.percentage === "number" && (p.percentage < 0 || p.percentage > 100)) {
      warnings.push({ field: "progress.percentage", message: "Should be between 0 and 100" });
    }
  }

  // Type-specific validations
  if (fm.type === "playbook" && !fm.scope) {
    warnings.push({ field: "scope", message: "Playbook should define scope (domain | connector | cross-cutting)" });
  }

  if (fm.type === "mission" && !fm.state) {
    warnings.push({ field: "state", message: "Mission should define its current state" });
  }

  if (fm.type === "memory" && !fm.memory_id) {
    warnings.push({ field: "memory_id", message: "Memory should have a unique memory_id" });
  }

  if (fm.type === "template" && !fm.template_for) {
    warnings.push({ field: "template_for", message: "Template should specify what it generates" });
  }

  if (fm.type === "workflow" && !fm.steps) {
    warnings.push({ field: "steps", message: "Workflow should define steps" });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates an OKF v0.1 frontmatter against minimal OKF requirements.
 * All OKF files should pass this before NKS validation.
 */
export function validateOkfFrontmatter(fm: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!fm.type || typeof fm.type !== "string") {
    errors.push({ field: "type", message: "type is required (OKF v0.1)", value: fm.type });
  }

  if (!fm.name || typeof fm.name !== "string") {
    errors.push({ field: "name", message: "name is required (OKF v0.1)", value: fm.name });
  }

  if (!fm.description || typeof fm.description !== "string") {
    errors.push({ field: "description", message: "description is required (OKF v0.1)", value: fm.description });
  }

  if (!fm.version || typeof fm.version !== "string") {
    errors.push({ field: "version", message: "version is required (OKF v0.1)", value: fm.version });
  }

  if (!fm.updated || typeof fm.updated !== "string") {
    errors.push({ field: "updated", message: "updated is required (OKF v0.1)", value: fm.updated });
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Convenience: validate both OKF and NKS compliance.
 */
export function validateFull(fm: Record<string, unknown>): {
  okf: ValidationResult;
  nks: ValidationResult;
  passesOkf: boolean;
  passesNks: boolean;
} {
  const okf = validateOkfFrontmatter(fm);
  const nks = validateNksFrontmatter(fm);

  return {
    okf,
    nks,
    passesOkf: okf.valid,
    passesNks: nks.valid,
  };
}
