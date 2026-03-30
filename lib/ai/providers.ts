import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { xai } from '@ai-sdk/xai';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { gateway } from '@ai-sdk/gateway';
import { createVertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { createVertex } from '@ai-sdk/google-vertex';
import { GoogleAuth } from 'google-auth-library';

const vertex = createVertex({
  location: process.env.GOOGLE_VERTEX_LOCATION ?? 'us-central1',
  project: process.env.GOOGLE_VERTEX_PROJECT ?? 'placeholder',
});

// The SDK's default vertexAnthropic singleton can silently send null tokens
// when google-auth-library's cached token expires mid-stream (401s after
// many successful steps). Use our own GoogleAuth instance with retry.
const googleAuth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

async function getAccessToken(): Promise<string> {
  const client = await googleAuth.getClient();
  const res = await client.getAccessToken();
  if (res?.token) return res.token;
  const retry = await client.getAccessToken();
  if (retry?.token) return retry.token;
  throw new Error('Failed to obtain Google access token after retry');
}

const vertexAnthropic = createVertexAnthropic({
  headers: async () => ({
    Authorization: `Bearer ${await getAccessToken()}`,
  }),
});

import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';
import { isTestEnvironment } from '../constants';

// Anthropic model for web automation via Vertex AI
export const webAutomationModel = vertexAnthropic('claude-sonnet-4-6');
export const prepareStepModel = vertexAnthropic('claude-haiku-4-5');

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    })
  : customProvider({
      languageModels: {
        'chat-model': openai('gpt-4o'),
        'chat-model-reasoning': wrapLanguageModel({
          model: openai('gpt-4o'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'title-model': openai('gpt-4o-mini'),
        'artifact-model': openai('gpt-4o'),
        // Dev-only selectable models (shown in ModelSelectorButton, hidden in production)
        'gpt-5.4': openai('gpt-5.4'),
        'gpt-5.4-pro': openai('gpt-5.4-pro'),
        'gpt-5.4-mini': openai('gpt-5.4-mini'),
        'gpt-5.4-nano': openai('gpt-5.4-nano'),
        'claude-sonnet-4-6': vertexAnthropic('claude-sonnet-4-6'),
        'claude-haiku-4-5': vertexAnthropic('claude-haiku-4-5'),
        'grok-4': xai('grok-4-0709'),
        'grok-4-fast': xai('grok-4-fast-non-reasoning'),
        'grok-4.1-fast': xai('grok-4.1-fast-non-reasoning'),
        'gemini-2.5-pro': vertex('gemini-2.5-pro'),
        'gemini-2.5-flash': vertex('gemini-2.5-flash'),
        'gemini-2.5-flash-lite': vertex('gemini-2.5-flash-lite'),
        'gemini-3.1': google('gemini-3.1-pro-preview'),
        'gemini-3.1-flash': google('gemini-3.1-flash-lite-preview')
      },
      imageModels: {
        'small-model': openai.image('dall-e-3'),
      },
    });
