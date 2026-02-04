/**
 * Structured logging for Kernel browser operations
 * All logs include sessionId, userId, and operation context for debugging and monitoring
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'critical';

interface BaseLogContext {
  sessionId: string;
  userId?: string;
  operation: string;
  timestamp?: number;
}

interface BrowserLogContext extends BaseLogContext {
  browserSessionId?: string;
  cdpUrl?: string;
  liveViewUrl?: string;
}

interface SecurityLogContext extends BaseLogContext {
  expectedUserId?: string;
  actualUserId?: string;
  securityEvent: string;
}

interface PerformanceLogContext extends BaseLogContext {
  durationMs?: number;
  retryCount?: number;
  lockWaitMs?: number;
}

// Allow extra properties on all log contexts
type LogContext = BaseLogContext | BrowserLogContext | SecurityLogContext | PerformanceLogContext | Record<string, any>;

function formatLog(
  level: LogLevel,
  message: string,
  context: LogContext
): void {
  const timestamp = context.timestamp || Date.now();
  const logData = {
    level: level.toUpperCase(),
    timestamp: new Date(timestamp).toISOString(),
    service: 'kernel-browser',
    ...context,
    message,
  };

  const logPrefix = `[Kernel:${context.operation}]`;

  switch (level) {
    case 'critical':
    case 'error':
      console.error(logPrefix, message, JSON.stringify(logData, null, 2));
      break;
    case 'warn':
      console.warn(logPrefix, message, JSON.stringify(logData, null, 2));
      break;
    case 'info':
    default:
      console.log(logPrefix, message, JSON.stringify(logData, null, 2));
      break;
  }
}

export const logger = {
  info: (message: string, context: LogContext) => formatLog('info', message, context),
  warn: (message: string, context: LogContext) => formatLog('warn', message, context),
  error: (message: string, context: LogContext) => formatLog('error', message, context),
  critical: (message: string, context: LogContext) => formatLog('critical', message, context),

  // Specialized logging functions for common scenarios
  browserCreated: (context: BrowserLogContext) => {
    formatLog('info', 'Browser session created successfully', context);
  },

  browserReused: (context: BrowserLogContext) => {
    formatLog('info', 'Reusing existing browser session', context);
  },

  browserExpired: (context: BrowserLogContext) => {
    formatLog('info', 'Browser session expired', context);
  },

  securityViolation: (context: SecurityLogContext) => {
    formatLog('critical', 'SECURITY VIOLATION: User attempted to access another user\'s session', context);
  },

  liveViewAnomaly: (context: BrowserLogContext & { connectionCount: number }) => {
    formatLog(
      'critical',
      `ANOMALY DETECTED: ${context.connectionCount} concurrent live view connections for single session`,
      context
    );
  },

  performanceMetric: (context: PerformanceLogContext) => {
    formatLog('info', 'Performance metric recorded', context);
  },

  lockAcquired: (context: PerformanceLogContext) => {
    formatLog('info', 'Distributed lock acquired', context);
  },

  lockTimeout: (context: PerformanceLogContext) => {
    formatLog('error', 'Failed to acquire distributed lock (timeout)', context);
  },

  raceConditionDetected: (context: BaseLogContext & { details: string }) => {
    formatLog('error', 'Race condition detected during browser creation', context);
  },
};
