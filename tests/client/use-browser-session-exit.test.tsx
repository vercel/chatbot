import { expect, test, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { useBrowserSessionExit } from '@/hooks/use-browser-session-exit';
import * as useArtifactModule from '@/hooks/use-artifact';

// Mock the useArtifact hook
vi.mock('@/hooks/use-artifact', () => ({
  useArtifact: vi.fn(),
}));

test('useBrowserSessionExit detects active browser session', () => {
  // Mock an active browser session
  vi.mocked(useArtifactModule.useArtifact).mockReturnValue({
    artifact: {
      documentId: 'test-123',
      content: '',
      kind: 'browser',
      title: 'Browser',
      status: 'idle',
      isVisible: true,
      boundingBox: { top: 0, left: 0, width: 0, height: 0 },
    },
    metadata: {
      sessionId: 'browser-session-123',
      isConnected: true,
      isConnecting: false,
      controlMode: 'agent',
      isFocused: false,
      isFullscreen: false,
    },
    setArtifact: vi.fn(),
    setMetadata: vi.fn(),
  });

  const { result } = renderHook(() => useBrowserSessionExit());

  expect(result.current.hasActiveBrowserSession).toBe(true);
  expect(result.current.showExitWarning).toBe(false);
});

test('useBrowserSessionExit does not detect session when not browser artifact', () => {
  // Mock a non-browser artifact
  vi.mocked(useArtifactModule.useArtifact).mockReturnValue({
    artifact: {
      documentId: 'test-123',
      content: '',
      kind: 'text',
      title: 'Text',
      status: 'idle',
      isVisible: true,
      boundingBox: { top: 0, left: 0, width: 0, height: 0 },
    },
    metadata: null,
    setArtifact: vi.fn(),
    setMetadata: vi.fn(),
  });

  const { result } = renderHook(() => useBrowserSessionExit());

  expect(result.current.hasActiveBrowserSession).toBe(false);
});

test('useBrowserSessionExit does not detect session when browser not connected', () => {
  // Mock a browser artifact that is not connected
  vi.mocked(useArtifactModule.useArtifact).mockReturnValue({
    artifact: {
      documentId: 'test-123',
      content: '',
      kind: 'browser',
      title: 'Browser',
      status: 'idle',
      isVisible: true,
      boundingBox: { top: 0, left: 0, width: 0, height: 0 },
    },
    metadata: {
      sessionId: 'browser-session-123',
      isConnected: false,
      isConnecting: false,
      controlMode: 'agent',
      isFocused: false,
      isFullscreen: false,
    },
    setArtifact: vi.fn(),
    setMetadata: vi.fn(),
  });

  const { result } = renderHook(() => useBrowserSessionExit());

  expect(result.current.hasActiveBrowserSession).toBe(false);
});

test('useBrowserSessionExit intercepts navigation when active session exists', async () => {
  // Mock an active browser session
  vi.mocked(useArtifactModule.useArtifact).mockReturnValue({
    artifact: {
      documentId: 'test-123',
      content: '',
      kind: 'browser',
      title: 'Browser',
      status: 'idle',
      isVisible: true,
      boundingBox: { top: 0, left: 0, width: 0, height: 0 },
    },
    metadata: {
      sessionId: 'browser-session-123',
      isConnected: true,
      isConnecting: false,
      controlMode: 'agent',
      isFocused: false,
      isFullscreen: false,
    },
    setArtifact: vi.fn(),
    setMetadata: vi.fn(),
  });

  const { result } = renderHook(() => useBrowserSessionExit());

  const mockAction = vi.fn();
  
  await result.current.interceptNavigation(mockAction);

  expect(mockAction).not.toHaveBeenCalled();
});

test('useBrowserSessionExit allows navigation when no active session', () => {
  // Mock no active browser session
  vi.mocked(useArtifactModule.useArtifact).mockReturnValue({
    artifact: {
      documentId: 'test-123',
      content: '',
      kind: 'text',
      title: 'Text',
      status: 'idle',
      isVisible: true,
      boundingBox: { top: 0, left: 0, width: 0, height: 0 },
    },
    metadata: null,
    setArtifact: vi.fn(),
    setMetadata: vi.fn(),
  });

  const { result } = renderHook(() => useBrowserSessionExit());

  const mockAction = vi.fn();
  const wasIntercepted = result.current.interceptNavigation(mockAction);

  expect(wasIntercepted).toBe(true);
  expect(result.current.showExitWarning).toBe(false);
  expect(mockAction).toHaveBeenCalledTimes(1);
});

test('useBrowserSessionExit executes pending action on confirm', async () => {
  // Mock an active browser session
  vi.mocked(useArtifactModule.useArtifact).mockReturnValue({
    artifact: {
      documentId: 'test-123',
      content: '',
      kind: 'browser',
      title: 'Browser',
      status: 'idle',
      isVisible: true,
      boundingBox: { top: 0, left: 0, width: 0, height: 0 },
    },
    metadata: {
      sessionId: 'browser-session-123',
      isConnected: true,
      isConnecting: false,
      controlMode: 'agent',
      isFocused: false,
      isFullscreen: false,
    },
    setArtifact: vi.fn(),
    setMetadata: vi.fn(),
  });

  const { result, rerender } = renderHook(() => useBrowserSessionExit());

  const mockAction = vi.fn();
  
  // Intercept navigation
  result.current.interceptNavigation(mockAction);
  rerender();
  
  // Confirm leave
  result.current.handleConfirmLeave();
  rerender();
  
  expect(mockAction).toHaveBeenCalledTimes(1);
});

test('useBrowserSessionExit cancels pending action on cancel', async () => {
  // Mock an active browser session
  vi.mocked(useArtifactModule.useArtifact).mockReturnValue({
    artifact: {
      documentId: 'test-123',
      content: '',
      kind: 'browser',
      title: 'Browser',
      status: 'idle',
      isVisible: true,
      boundingBox: { top: 0, left: 0, width: 0, height: 0 },
    },
    metadata: {
      sessionId: 'browser-session-123',
      isConnected: true,
      isConnecting: false,
      controlMode: 'agent',
      isFocused: false,
      isFullscreen: false,
    },
    setArtifact: vi.fn(),
    setMetadata: vi.fn(),
  });

  const { result } = renderHook(() => useBrowserSessionExit());

  const mockAction = vi.fn();
  
  // Intercept navigation
  await result.current.interceptNavigation(mockAction);
  
  // Cancel leave
  await result.current.handleCancelLeave();
  
  expect(mockAction).not.toHaveBeenCalled();
});

