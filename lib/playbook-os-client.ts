// ============================================================
// Playbook OS V2 — Neptune Chat Adapter (TypeScript)
// Client for the neptune-chat Next.js app.
//
// Replaces the existing playbook-loader with full PlaybookOS SDK.
// Wires /playbook-os dashboard route to render OpenSpace data.
// ============================================================

// Note: In production, this is imported from the playbook-os package.
// Dynamic import pattern to avoid hard dependency on playbook-os at build time.

export interface ChatPlaybookConfig {
  repoPath?: string;
  agent?: string;
  logDir?: string;
}

export interface DashboardData {
  skillCount: number;
  toolCount: number;
  integrationCount: number;
  topSkills: Array<{
    skillId: string;
    skillName: string;
    effectiveRate: number;
    totalSelections: number;
  }>;
  degradingSkills: Array<{
    id: string;
    name: string;
    metric: string;
    currentValue: number;
    threshold: number;
    trend: string;
    recommendations: string[];
  }>;
  degradingTools: Array<{
    id: string;
    name: string;
    metric: string;
    currentValue: number;
    threshold: number;
    trend: string;
    recommendations: string[];
  }>;
  recentEvolutions: Array<{
    suggestion: { skillId: string; reason: string };
    status: string;
    prUrl?: string;
  }>;
  globalStats: {
    avgEffectiveRate: number;
    avgSuccessRate: number;
    totalEvolutions: number;
    totalToolCalls: number;
    periodDays: number;
  };
}

export interface HealthSummary {
  healthy: boolean;
  warnings: string[];
  metrics: Record<string, unknown>;
}

let _playbookOS: any = null;
let _config: ChatPlaybookConfig = {};

/**
 * Lazy-load the Playbook OS SDK.
 */
async function getPlaybookOS(): Promise<any> {
  if (_playbookOS) return _playbookOS;

  try {
    const { PlaybookOS } = await import('playbook-os');
    _playbookOS = new PlaybookOS({
      repoPath: _config.repoPath || '/home/neptune/playbook-os',
      agent: _config.agent || 'neptune-chat',
      logDir: _config.logDir || '/var/log/playbook-os',
    });
    return _playbookOS;
  } catch {
    console.warn('[PlaybookOS] SDK not available — using no-op adapter');
    return createNoopAdapter();
  }
}

function createNoopAdapter() {
  return {
    discover: async () => ({ classification: {}, skills: [], playbooks: [], integrations: [] }),
    recordOutcome: async () => {},
    metrics: {
      getSkillEffectiveness: () => null,
      getToolHealth: () => null,
      getAllSkillMetrics: () => [],
      getAllToolMetrics: () => [],
      recordSkillSelection: () => {},
      registerSkill: () => {},
    },
    quality: {
      scan: () => ({ alerts: [] }),
      getHealthSummary: () => ({ healthy: true, warnings: [], metrics: {} }),
    },
    evolution: {
      runCycle: async () => ({ suggestions: [] }),
      getRecentEvolutions: () => [],
      getPendingEvolutions: () => [],
    },
    dashboard: {
      build: () => ({
        skillCount: 0,
        toolCount: 0,
        integrationCount: 0,
        topSkills: [],
        degradingSkills: [],
        degradingTools: [],
        recentEvolutions: [],
        globalStats: { avgEffectiveRate: 0, avgSuccessRate: 0, totalEvolutions: 0, totalToolCalls: 0, periodDays: 30 },
      }),
      health: () => ({ healthy: true, warnings: [], metrics: {} }),
    },
    hardening: {
      harden: (fn: Function) => fn,
    },
    logs: {
      log: () => '',
      flush: () => {},
      stats: async () => ({}),
    },
  };
}

/**
 * Initialize the Playbook OS adapter.
 */
export async function initPlaybookOS(config: ChatPlaybookConfig = {}): Promise<void> {
  _config = config;
  const pos = await getPlaybookOS();
  console.log(`[PlaybookOS] Chat adapter initialized for agent: ${pos.agentName || config.agent}`);
}

// ============================================================
// Discovery API
// ============================================================

/**
 * Discover relevant skills + playbooks + hardening for a user prompt.
 * This replaces the old playbook-loader pattern.
 */
export async function discoverForChat(
  prompt: string,
  options?: { repo?: string },
): Promise<{
  classification: { domain: string; sub_domain: string; confidence: number };
  skills: Array<{ cluster: string; name: string; file: string; score: number; tier: number; content: string }>;
  playbooks: Array<{ integration: string; content: string; sections: string[] }>;
  integrations: string[];
}> {
  const pos = await getPlaybookOS();
  const context = await pos.discover({
    prompt,
    repo: options?.repo,
  });

  return {
    classification: context.classification,
    skills: context.skills || [],
    playbooks: context.playbooks || [],
    integrations: context.integrations || [],
  };
}

/**
 * Record a chat interaction outcome.
 * Each user message + agent response is a discoverable task.
 */
export async function recordChatOutcome(params: {
  sessionId: string;
  success: boolean;
  durationMs: number;
  tokensUsed: number;
  skillsLoaded?: string[];
  playbooksLoaded?: string[];
}): Promise<void> {
  const pos = await getPlaybookOS();

  // Register skills used in this interaction
  if (params.skillsLoaded) {
    for (const skillName of params.skillsLoaded) {
      try {
        pos.metrics.recordSkillSelection(skillName);
      } catch {
        // Skill may not be registered — skip
      }
    }
  }

  await pos.recordOutcome({
    task_id: `chat-${params.sessionId}-${Date.now()}`,
    success: params.success,
    duration_ms: params.durationMs,
    tokens_used: params.tokensUsed,
    skills_loaded: params.skillsLoaded || [],
    playbooks_loaded: params.playbooksLoaded || [],
  });
}

// ============================================================
// Dashboard API (for /playbook-os route)
// ============================================================

/**
 * Get the full dashboard data for the /playbook-os route.
 */
export async function getDashboard(): Promise<DashboardData> {
  const pos = await getPlaybookOS();
  const data = pos.dashboard.build();

  return {
    skillCount: data.skillCount || 0,
    toolCount: data.toolCount || 0,
    integrationCount: data.integrationCount || 0,
    topSkills: (data.topSkills || []).slice(0, 10).map((s: any) => ({
      skillId: s.skillId,
      skillName: s.skillName,
      effectiveRate: s.effectiveRate,
      totalSelections: s.totalSelections,
    })),
    degradingSkills: data.degradingSkills || [],
    degradingTools: data.degradingTools || [],
    recentEvolutions: (data.recentEvolutions || []).slice(0, 5),
    globalStats: data.globalStats || {
      avgEffectiveRate: 0,
      avgSuccessRate: 0,
      totalEvolutions: 0,
      totalToolCalls: 0,
      periodDays: 30,
    },
  };
}

/**
 * Get a health summary for status checks.
 */
export async function getHealthSummary(): Promise<HealthSummary> {
  const pos = await getPlaybookOS();
  return pos.dashboard.health();
}

/**
 * Scan for quality degradation (for admin alerts).
 */
export async function scanQuality(): Promise<{
  degradingSkills: any[];
  degradingTools: any[];
  integrationAlerts: any[];
}> {
  const pos = await getPlaybookOS();
  const result = pos.quality.scan();
  return {
    degradingSkills: result.degradingSkills || result.skillAlerts || [],
    degradingTools: result.degradingTools || result.toolAlerts || [],
    integrationAlerts: result.integrationAlerts || [],
  };
}

// ============================================================
// Evolution API
// ============================================================

/**
 * Get recent OpenSpace evolutions for the dashboard timeline.
 */
export async function getRecentEvolutions(limit = 10): Promise<any[]> {
  const pos = await getPlaybookOS();
  const evolutions = pos.metrics.getRecentEvolutions?.() || [];
  return evolutions.slice(0, limit);
}

// ============================================================
// V3 Logs API
// ============================================================

/**
 * Log a tool call for V3 audit logs.
 */
export function logToolCall(entry: {
  toolName: string;
  integrationName: string;
  agentName: string;
  input: Record<string, unknown>;
  output: 'success' | 'failure';
  errorCode?: string;
  latencyMs: number;
  retryCount: number;
}): string {
  // V3 logs are available via pos.logs.log()
  // For now, return a client-generated ID
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Export for direct use
export { getPlaybookOS };
export default {
  initPlaybookOS,
  discoverForChat,
  recordChatOutcome,
  getDashboard,
  getHealthSummary,
  scanQuality,
  getRecentEvolutions,
  logToolCall,
};
