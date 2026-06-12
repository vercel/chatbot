/**
 * GoHighLevel Connector — unified entry point.
 *
 * Default export: GHL connector manifest.
 * Named exports: Zod schemas for all GHL tool inputs/outputs.
 */
export { default } from "./manifest";
export {
  createContactSchema,
  sendSmsSchema,
  sendEmailSchema,
  queryConversationsSchema,
  getOpportunitySchema,
  ghlSchemas,
} from "./schema";
export type {
  CreateContactInput,
  SendSmsInput,
  SendEmailInput,
  QueryConversationsInput,
  GetOpportunityInput,
} from "./schema";
