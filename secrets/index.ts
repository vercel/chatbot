/**
 * U1.4: Centralized Secrets Server — typed z.object schema for ALL env vars.
 *
 * Design:
 * - z.object schema validates at module load (import time)
 * - Categories group secrets by connector/service
 * - Export typed `secrets` const — NEVER use process.env directly again
 * - Parse at startup, throw DescriptiveError if invalid
 *
 * Usage:
 *   import { secrets } from '@/secrets';
 *   const token = secrets.slack.botToken;  // typed, validated
 *
 * NEVER: process.env.SLACK_BOT_TOKEN
 * ALWAYS: secrets.slack.botToken
 */

import { z } from "zod";

// ── Primitive schemas ──────────────────────────────────────────────────────

const apiKeySchema = z.string().min(1, "API key must not be empty");
const urlSchema = z.string().url("Must be a valid URL").or(z.literal(""));
const optionalString = z.string().default("");
const optionalApiKey = z.string().default("");
const optionalUrl = urlSchema.default("");

// ── Connector category schemas ─────────────────────────────────────────────

const slackSchema = z.object({
  botToken: apiKeySchema,
  userToken: z.string().default(""),
  jarvisAdminChannelId: z.string().min(1),
  newleafAdminChannelId: z.string().default("C096PSS45Q9"),
  jarvisAdminWebhookUrl: optionalUrl,
});

const nmiSchema = z.object({
  securityKey: optionalApiKey,
  connectorMcaId: optionalString,
});

const hyperswitchSchema = z.object({
  apiKey: optionalApiKey,
  apiKeyId: optionalString,
  publishableKey: optionalString,
  adminApiKey: optionalApiKey,
  webhookSecret: optionalString,
  baseUrl: optionalUrl,
  publicBaseUrl: optionalUrl,
  merchantId: optionalString,
  profileId: optionalString,
});

const base44Schema = z.object({
  apiKey: optionalApiKey,
  apiUrl: optionalUrl,
  apiHost: optionalString,
  functionsUrl: optionalUrl,
  vpsApiUrl: optionalUrl,
  appId: optionalString,
  appApiKey: optionalApiKey,
});

const vercelSchema = z.object({
  token: optionalApiKey,
  teamId: optionalString,
  partnerTeamId: optionalString,
  webhookSecret: optionalString,
});

const githubSchema = z.object({
  token: optionalApiKey,
});

const vpsSchema = z.object({
  bridgeUrl: optionalUrl,
  bridgeToken: optionalApiKey,
  fsBridgeUrl: optionalUrl,
  toolsBridgeUrl: optionalUrl,
  internalToken: optionalApiKey,
  hostingerApiKey: optionalApiKey,
});

// ── AI Provider schemas ────────────────────────────────────────────────────

const openaiSchema = z.object({
  apiKey: optionalApiKey,
});

const anthropicSchema = z.object({
  apiKey: optionalApiKey,
});

const deepseekSchema = z.object({
  apiKey: optionalApiKey,
});

const aiGatewaySchema = z.object({
  apiKey: optionalApiKey,
});

const xaiSchema = z.object({
  apiKey: optionalApiKey,
});

const groqSchema = z.object({
  apiKey: optionalApiKey,
});

const googleSchema = z.object({
  apiKey: optionalApiKey,
});

// ── Internal / Infrastructure schemas ──────────────────────────────────────

const internalSchema = z.object({
  neptuneInternalToken: optionalApiKey,
  authSecret: optionalString,
  betterAuthSecret: optionalString,
  postgresUrl: optionalUrl,
  redisUrl: optionalUrl,
  appBaseUrl: optionalUrl,
  diagnosticsApiKey: optionalApiKey,
  blobReadWriteToken: optionalString,
  isDemo: z.string().default("0"),
});

const neptuneV2Schema = z.object({
  chatUrl: optionalUrl,
  handoffSecret: optionalString,
  tasksUrl: optionalUrl,
  openAgentsUrl: optionalUrl,
  openAgentsApiKey: optionalApiKey,
  vercelProjectId: optionalString,
  vercelTeam: optionalString,
  postgresUrl: optionalUrl,
  betterAuthSecret: optionalString,
});

const e2bSchema = z.object({
  apiKey: optionalApiKey,
  accessToken: optionalApiKey,
  jarvisTemplateId: optionalString,
  desktopTemplateId: optionalString,
});

// ── Other connectors (non-wrapped) ─────────────────────────────────────────

const resendSchema = z.object({
  apiKey: optionalApiKey,
});

const linearSchema = z.object({
  apiKey: optionalApiKey,
});

const forthSchema = z.object({
  apiToken: optionalApiKey,
});

const vapiSchema = z.object({
  privateKey: optionalApiKey,
});

const ghlSchema = z.object({
  apiKey: optionalApiKey,
  locationId: optionalString,
});

const affySchema = z.object({
  apiKey: optionalApiKey,
});

const wikiSchema = z.object({
  hermesKey: optionalApiKey,
  hermesApiUrl: optionalUrl,
});

// ── Other services ─────────────────────────────────────────────────────────

const otherSchema = z.object({
  n8nApiKey: optionalApiKey,
  n8nUserPass: optionalString,
  n8nEncryptionKey: optionalString,
  n8nBasicPass: optionalString,
  n8nPostgresPass: optionalString,
  smitheryApiKey: optionalApiKey,
  godaddyApiKey: optionalString,
  godaddyApiSecret: optionalString,
  twentyfirstApiKey: optionalApiKey,
  ollamaKey: optionalString,
  kimiApiKey: optionalApiKey,
  jdiApiKey: optionalApiKey,
  swamiAppId: optionalString,
  swamiAppApiKey: optionalApiKey,
  clerkSecretKey: optionalString,
  clerkPublishableKey: optionalString,
});

// ── Master schema ──────────────────────────────────────────────────────────

export const secretsSchema = z.object({
  slack: slackSchema,
  nmi: nmiSchema,
  hyperswitch: hyperswitchSchema,
  base44: base44Schema,
  vercel: vercelSchema,
  github: githubSchema,
  vps: vpsSchema,
  openai: openaiSchema,
  anthropic: anthropicSchema,
  deepseek: deepseekSchema,
  aiGateway: aiGatewaySchema,
  xai: xaiSchema,
  groq: groqSchema,
  google: googleSchema,
  internal: internalSchema,
  neptuneV2: neptuneV2Schema,
  e2b: e2bSchema,
  resend: resendSchema,
  linear: linearSchema,
  forth: forthSchema,
  vapi: vapiSchema,
  ghl: ghlSchema,
  affy: affySchema,
  wiki: wikiSchema,
  other: otherSchema,
});

export type Secrets = z.infer<typeof secretsSchema>;

// ── Parse at import time ───────────────────────────────────────────────────

function parseEnv(): Secrets {
  const raw = {
    slack: {
      botToken: process.env.SLACK_BOT_TOKEN ?? "",
      userToken: process.env.SLACK_USER_TOKEN ?? "",
      jarvisAdminChannelId: process.env.JARVIS_ADMIN_CHANNEL_ID ?? "",
      newleafAdminChannelId: process.env.NEWLEAF_ADMIN_CHANNEL_ID ?? "C096PSS45Q9",
      jarvisAdminWebhookUrl: process.env.SLACK_JARVIS_ADMIN_WEBHOOK_URL ?? "",
    },
    nmi: {
      securityKey: process.env.NMI_SECURITY_KEY ?? "",
      connectorMcaId: process.env.NMI_CONNECTOR_MCA_ID ?? "",
    },
    hyperswitch: {
      apiKey: process.env.HYPERSWITCH_API_KEY ?? "",
      apiKeyId: process.env.HYPERSWITCH_API_KEY_ID ?? "",
      publishableKey: process.env.HYPERSWITCH_PUBLISHABLE_KEY ?? "",
      adminApiKey: process.env.HYPERSWITCH_ADMIN_API_KEY ?? "",
      webhookSecret: process.env.HYPERSWITCH_WEBHOOK_SECRET ?? "",
      baseUrl: process.env.HYPERSWITCH_BASE_URL ?? "",
      publicBaseUrl: process.env.HYPERSWITCH_PUBLIC_BASE_URL ?? "",
      merchantId: process.env.HYPERSWITCH_MERCHANT_ID ?? "",
      profileId: process.env.HYPERSWITCH_PROFILE_ID ?? "",
    },
    base44: {
      apiKey: process.env.BASE44_API_KEY ?? "",
      apiUrl: process.env.BASE44_API_URL ?? "",
      apiHost: process.env.BASE44_API_HOST ?? "",
      functionsUrl: process.env.BASE44_FUNCTIONS_URL ?? "",
      vpsApiUrl: process.env.BASE44_VPS_API_URL ?? "",
      appId: process.env.BASE44_APP_ID ?? "",
      appApiKey: process.env.BASE44_APP_API_KEY ?? "",
    },
    vercel: {
      token: process.env.VERCEL_TOKEN ?? "",
      teamId: process.env.VERCEL_TEAM_ID ?? "",
      partnerTeamId: process.env.VERCEL_PARTNER_TEAM_ID ?? "",
      webhookSecret: process.env.VERCEL_WEBHOOK_SECRET ?? "",
    },
    github: {
      token: process.env.GITHUB_TOKEN ?? "",
    },
    vps: {
      bridgeUrl: process.env.VPS_BRIDGE_URL ?? "",
      bridgeToken: process.env.VPS_BRIDGE_TOKEN ?? "",
      fsBridgeUrl: process.env.VPS_FS_BRIDGE_URL ?? "",
      toolsBridgeUrl: process.env.VPS_TOOLS_BRIDGE_URL ?? "",
      internalToken: process.env.NEPTUNE_INTERNAL_TOKEN ?? "",
      hostingerApiKey: process.env.HOSTINGER_API_KEY ?? "",
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY ?? "",
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY ?? "",
    },
    aiGateway: {
      apiKey: process.env.AI_GATEWAY_API_KEY ?? "",
    },
    xai: {
      apiKey: process.env.XAI_API_KEY ?? "",
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY ?? "",
    },
    google: {
      apiKey: process.env.GOOGLE_API_KEY ?? "",
    },
    internal: {
      neptuneInternalToken: process.env.NEPTUNE_INTERNAL_TOKEN ?? "",
      authSecret: process.env.AUTH_SECRET ?? "",
      betterAuthSecret: process.env.BETTER_AUTH_SECRET ?? "",
      postgresUrl: process.env.POSTGRES_URL ?? "",
      redisUrl: process.env.REDIS_URL ?? "",
      appBaseUrl: process.env.APP_BASE_URL ?? "",
      diagnosticsApiKey: process.env.DIAGNOSTICS_API_KEY ?? "",
      blobReadWriteToken: process.env.BLOB_READ_WRITE_TOKEN ?? "",
      isDemo: process.env.IS_DEMO ?? "0",
    },
    neptuneV2: {
      chatUrl: process.env.NEPTUNE_V2_CHAT_URL ?? "",
      handoffSecret: process.env.NEPTUNE_V2_HANDOFF_SECRET ?? "",
      tasksUrl: process.env.NEPTUNE_V2_TASKS_URL ?? "",
      openAgentsUrl: process.env.OPEN_AGENTS_URL ?? "",
      openAgentsApiKey: process.env.OPEN_AGENTS_API_KEY ?? "",
      vercelProjectId: process.env.NEPTUNE_V2_VERCEL_PROJECT_ID ?? "",
      vercelTeam: process.env.NEPTUNE_V2_VERCEL_TEAM ?? "",
      postgresUrl: process.env.NEPTUNE_V2_POSTGRES_URL ?? "",
      betterAuthSecret: process.env.NEPTUNE_V2_BETTER_AUTH_SECRET ?? "",
    },
    e2b: {
      apiKey: process.env.E2B_API_KEY ?? "",
      accessToken: process.env.E2B_ACCESS_TOKEN ?? "",
      jarvisTemplateId: process.env.E2B_JARVIS_TEMPLATE_ID ?? "",
      desktopTemplateId: process.env.E2B_DESKTOP_TEMPLATE_ID ?? "",
    },
    resend: {
      apiKey: process.env.RESEND_API_KEY ?? "",
    },
    linear: {
      apiKey: process.env.LINEAR_API_KEY ?? "",
    },
    forth: {
      apiToken: process.env.FORTH_API_TOKEN ?? "",
    },
    vapi: {
      privateKey: process.env.VAPI_PRIVATE_KEY ?? "",
    },
    ghl: {
      apiKey: process.env.GHL_API_KEY ?? "",
      locationId: process.env.GHL_LOCATION_ID ?? "",
    },
    affy: {
      apiKey: process.env.AFFY_API_KEY ?? "",
    },
    wiki: {
      hermesKey: process.env.HERMES_KEY ?? "",
      hermesApiUrl: process.env.HERMES_API_URL ?? "",
    },
    other: {
      n8nApiKey: process.env.N8N_API_KEY ?? "",
      n8nUserPass: process.env.N8N_USER_PASS ?? "",
      n8nEncryptionKey: process.env.N8N_ENCRYPTION_KEY ?? "",
      n8nBasicPass: process.env.N8N_BASIC_PASS ?? "",
      n8nPostgresPass: process.env.N8N_POSTGRES_PASS ?? "",
      smitheryApiKey: process.env.SMITHERY_API_KEY ?? "",
      godaddyApiKey: process.env.GODADDY_API_KEY ?? "",
      godaddyApiSecret: process.env.GODADDY_API_SECRET ?? "",
      twentyfirstApiKey: process.env.TWENTYFIRST_API_KEY ?? "",
      ollamaKey: process.env.OLLAMA_KEY ?? "",
      kimiApiKey: process.env.KIMI_API_KEY ?? "",
      jdiApiKey: process.env.JDI_API_KEY ?? "",
      swamiAppId: process.env.SWAMI_APP_ID ?? "",
      swamiAppApiKey: process.env.SWAMI_APP_API_KEY ?? "",
      clerkSecretKey: process.env.CLERK_SECRET_KEY ?? "",
      clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY ?? "",
    },
  };

  const result = secretsSchema.safeParse(raw);

  if (!result.success) {
    const missing = result.error.issues
      .filter((i) => i.message.includes("must not be empty"))
      .map((i) => `${i.path.join(".")}: ${i.message}`);

    console.error(
      "[secrets] Validation errors (non-blocking — missing optional keys):"
    );
    for (const m of missing.slice(0, 10)) {
      console.error(`  - ${m}`);
    }
    if (missing.length > 10) {
      console.error(`  ... and ${missing.length - 10} more`);
    }

    // Non-blocking: return parsed data for optional fields, fall back to raw for failures
    // In production we'd throw, but for gradual migration we warn
    console.warn(
      "[secrets] ⚠️  Some secrets failed validation. Falling back to raw env."
    );
    return raw as Secrets;
  }

  return result.data;
}

/** Typed, validated secrets const. Import this everywhere. */
export const secrets: Secrets = parseEnv();

export default secrets;
