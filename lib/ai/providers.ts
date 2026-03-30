import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { openai } from '@ai-sdk/openai';
import { gateway } from '@ai-sdk/gateway';
import { vertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
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
      },
      imageModels: {
        'small-model': openai.image('dall-e-3'),
      },
    });
