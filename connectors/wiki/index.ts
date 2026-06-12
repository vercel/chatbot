/**
 * Wiki (Karpathy Wiki) Connector — unified entry point.
 */
export { default } from "./manifest";
export {
  ingestSourceSchema,
  queryWikiSchema,
  lintWikiSchema,
  writeWikiPageSchema,
  updateIndexSchema,
  wikiSchemas,
} from "./schema";
export type {
  IngestSourceInput,
  QueryWikiInput,
  LintWikiInput,
  WriteWikiPageInput,
  UpdateIndexInput,
} from "./schema";
