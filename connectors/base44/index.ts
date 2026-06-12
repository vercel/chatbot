/**
 * Base44 Connector — unified entry point.
 */
export { default } from "./manifest";
export {
  createEntitySchema,
  customer360Schema,
  invokeFunctionSchema,
  queryEntitySchema,
  reportingHubSchema,
  updateEntitySchema,
  base44Schemas,
} from "./schema";
export type {
  CreateEntityInput,
  Customer360Input,
  InvokeFunctionInput,
  QueryEntityInput,
  ReportingHubInput,
  UpdateEntityInput,
} from "./schema";
