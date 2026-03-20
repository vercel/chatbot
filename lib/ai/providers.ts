import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { xai } from '@ai-sdk/xai';
import { openai } from '@ai-sdk/openai';
import { gateway } from '@ai-sdk/gateway';
import { vertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { createVertex } from '@ai-sdk/google-vertex';

const vertex = createVertex({
  location: process.env.GOOGLE_VERTEX_LOCATION ?? 'us-central1',
  project: process.env.GOOGLE_VERTEX_PROJECT ?? 'placeholder',
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
        'gpt-4o': openai('gpt-4o'),
        'gpt-4o-mini': openai('gpt-4o-mini'),
        'o1-mini': openai('o1-mini'),
        'claude-sonnet-4-6': vertexAnthropic('claude-sonnet-4-6'),
        'claude-haiku-4-5': vertexAnthropic('claude-haiku-4-5'),
        'grok-2-1212': xai('grok-2-1212'),
        'gemini-2.5-pro': vertex('gemini-2.5-pro'),
        'gemini-2.5-flash': vertex('gemini-2.5-flash'),
        'gemini-2.5-flash-lite': vertex('gemini-2.5-flash-lite'),
        // 'gemini-3.1': vertex('gemini-3.1-pro-preview'),
        // 'gemini-3.1-flash': vertex('gemini-3.1-flash-lite-preview')
      },
      imageModels: {
        'small-model': openai.image('dall-e-3'),
      },
    });
