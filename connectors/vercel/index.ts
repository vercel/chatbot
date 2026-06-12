/**
 * Vercel Connector — unified entry point.
 */
export { default } from "./manifest";
export {
  listDeploysSchema,
  getDeployLogSchema,
  listProjectsSchema,
  createProjectSchema,
  redeploySchema,
  vercelSchemas,
} from "./schema";
export type {
  ListDeploysInput,
  GetDeployLogInput,
  ListProjectsInput,
  CreateProjectInput,
  RedeployInput,
} from "./schema";
