export const DEFAULT_CHAT_MODEL: string = 'web-automation-model';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'web-automation-model',
    name: 'Web Automation Agent',
    description: 'AI agent for web navigation and automation tasks',
  },
];
