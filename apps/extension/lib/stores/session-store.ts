import type { SessionUiState } from '@/lib/types';

const STORAGE_KEY = 'helios:sidepanel:session-ui';

const defaultState: SessionUiState = {
  draftByThreadId: {},
  openPanels: {},
  traceFilter: 'all',
  lastSelectedSnippet: null,
  artifactPreviewThreadId: null,
  streamingInFlight: false,
};

export const sessionStore = {
  get(): SessionUiState {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;

    try {
      return {
        ...defaultState,
        ...JSON.parse(raw),
      } as SessionUiState;
    } catch {
      return defaultState;
    }
  },

  set(partial: Partial<SessionUiState>): SessionUiState {
    const next = {
      ...this.get(),
      ...partial,
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  },

  clear(): void {
    sessionStorage.removeItem(STORAGE_KEY);
  },
};
