import { storage } from '@wxt-dev/storage';
import type { AppModelId, ConfigState } from '@/lib/types';

const CONFIG_KEY = 'local:config';

export const defaultConfigState: ConfigState = {
  selectedModel: 'openai/gpt-4.1-mini',
  sidebarWidth: 420,
  compactMode: false,
  featureFlags: {},
  installVersion: 1,
  lastOpenedThreadId: null,
  lightweightThreadIndex: [],
  onboardingComplete: false,
  consentAccepted: false,
};

let configCache: ConfigState | null = null;

export async function getConfigState(): Promise<ConfigState> {
  if (configCache) {
    return configCache;
  }

  const stored = await storage.getItem<ConfigState>(CONFIG_KEY);
  configCache = stored ? { ...defaultConfigState, ...stored } : defaultConfigState;
  return configCache;
}

export async function setConfigState(
  updater: Partial<ConfigState> | ((current: ConfigState) => ConfigState),
): Promise<ConfigState> {
  const current = await getConfigState();
  const next =
    typeof updater === 'function'
      ? updater(current)
      : {
          ...current,
          ...updater,
        };

  configCache = next;
  await storage.setItem(CONFIG_KEY, next);
  return next;
}

export async function setSelectedModel(model: AppModelId) {
  return setConfigState({ selectedModel: model });
}

export async function clearConfigState() {
  configCache = defaultConfigState;
  await storage.setItem(CONFIG_KEY, defaultConfigState);
}
