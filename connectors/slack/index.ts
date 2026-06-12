/**
 * Slack Connector — unified entry point.
 *
 * Default export: Slack connector manifest.
 * Named exports: Zod schemas for all Slack tool inputs/outputs.
 */
export { default } from "./manifest";
export {
  listChannelsSchema,
  postMessageSchema,
  pullMessagesSchema,
  reactionAddSchema,
  searchChannelsSchema,
  slackSchemas,
} from "./schema";
export type {
  ListChannelsInput,
  PostMessageInput,
  PullMessagesInput,
  ReactionAddInput,
  SearchChannelsInput,
} from "./schema";
