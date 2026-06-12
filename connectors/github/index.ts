/**
 * GitHub Connector — unified entry point.
 */
export { default } from "./manifest";
export {
  searchCodeSchema,
  getFileSchema,
  listPRsSchema,
  createPRSchema,
  spawnCodingAgentSchema,
  listReposSchema,
  githubSchemas,
} from "./schema";
export type {
  SearchCodeInput,
  GetFileInput,
  ListPRsInput,
  CreatePRInput,
  SpawnCodingAgentInput,
  ListReposInput,
} from "./schema";
