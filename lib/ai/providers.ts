import { gateway } from "@ai-sdk/gateway";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";
import { ChatSDKError } from "../errors";

const THINKING_SUFFIX_REGEX = /-thinking$/;

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : null;

type ProviderMode = "gateway" | "direct";

function getProviderMode(): ProviderMode {
  const raw = (process.env.AI_PROVIDER_MODE ?? "gateway").toLowerCase();

  if (raw === "gateway" || raw === "direct") {
    return raw;
  }

  throw new ChatSDKError(
    "bad_request:provider_config",
    `Invalid AI_PROVIDER_MODE "${raw}". Use "gateway" or "direct".`
  );
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new ChatSDKError(
      "bad_request:provider_config",
      `Missing ${name}. Add it to .env.local (or your deployment environment).`
    );
  }
  return value;
}

function getDirectLanguageModel(modelId: string) {
  const [provider, ...rest] = modelId.split("/");
  const providerModelId = rest.join("/");

  if (!provider || !providerModelId) {
    throw new ChatSDKError(
      "bad_request:provider_config",
      `Invalid model id "${modelId}". Expected format "provider/model".`
    );
  }

  switch (provider) {
    case "openai": {
      requireEnv("OPENAI_API_KEY");
      return openai(providerModelId);
    }
    case "anthropic": {
      requireEnv("ANTHROPIC_API_KEY");
      return anthropic(providerModelId);
    }
    case "google": {
      requireEnv("GOOGLE_GENERATIVE_AI_API_KEY");
      return google(providerModelId);
    }
    default: {
      throw new ChatSDKError(
        "bad_request:provider_config",
        `Provider "${provider}" is not supported in direct mode. Choose an OpenAI/Anthropic/Google model, or set AI_PROVIDER_MODE="gateway".`
      );
    }
  }
}

function pickDefaultDirectUtilityModelId(): string {
  if (process.env.OPENAI_API_KEY) {
    return "openai/gpt-4.1-mini";
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return "anthropic/claude-haiku-4.5";
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return "google/gemini-2.5-flash-lite";
  }

  throw new ChatSDKError(
    "bad_request:provider_config",
    "No LLM API key found. Set OPENAI_API_KEY (or ANTHROPIC_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY) when AI_PROVIDER_MODE is \"direct\"."
  );
}

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  const isReasoningModel =
    modelId.includes("reasoning") || modelId.endsWith("-thinking");

  const providerMode = getProviderMode();

  if (isReasoningModel) {
    const baseModelId = modelId.replace(THINKING_SUFFIX_REGEX, "");
    const baseModel =
      providerMode === "gateway"
        ? gateway.languageModel(baseModelId)
        : getDirectLanguageModel(baseModelId);
    return wrapLanguageModel({
      model: baseModel,
      middleware: extractReasoningMiddleware({ tagName: "thinking" }),
    });
  }

  return providerMode === "gateway"
    ? gateway.languageModel(modelId)
    : getDirectLanguageModel(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }

  if (getProviderMode() === "gateway") {
    return gateway.languageModel("google/gemini-2.5-flash-lite");
  }

  const titleModelId =
    process.env.AI_TITLE_MODEL ??
    process.env.AI_DEFAULT_MODEL ??
    pickDefaultDirectUtilityModelId();

  return getLanguageModel(titleModelId);
}

export function getArtifactModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("artifact-model");
  }

  if (getProviderMode() === "gateway") {
    return gateway.languageModel("anthropic/claude-haiku-4.5");
  }

  const artifactModelId =
    process.env.AI_ARTIFACT_MODEL ??
    process.env.AI_DEFAULT_MODEL ??
    pickDefaultDirectUtilityModelId();

  return getLanguageModel(artifactModelId);
}
