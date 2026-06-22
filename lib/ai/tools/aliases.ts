/**
 * Phase 2 M-NEPTUNE-PERFECT: Tool Aliases
 *
 * Snake_case → camelCase bridge for gatekeeper API tools.
 * The /api/tools/route.ts exposes snake_case names (view_file, query_knowledge, load_skill)
 * while implementations use camelCase. This file bridges both naming conventions.
 *
 * Usage: import { view_file, query_knowledge, listPlaybookSkill } from '@/lib/ai/tools/aliases';
 */

// view_file → viewGithubFile: Read any GitHub file via Contents API
export { viewGithubFile as view_file } from "./view-github-file";

// query_knowledge → graphQueryTool: Search the Knowledge Graph
export { graphQueryTool as query_knowledge } from "./graph-query";

// load_skill → loadSkill: On-demand skill/playbook loading (U2 Progressive Disclosure)
export { loadSkill as listPlaybookSkill } from "./load-skill";
