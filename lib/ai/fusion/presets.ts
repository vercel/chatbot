/**
 * Phase 23A: 7 System Panel Presets
 *
 * Each preset is a CONTAINER: agents[] + judge + capabilities[] + domainHint.
 * Mode (council/swarm/hybrid) is decided at runtime by the task analyzer.
 * All 7 presets support all 3 capabilities.
 */

import type { PanelPreset } from "./types";

export const SYSTEM_PRESETS: PanelPreset[] = [
  // ── 1. Chinese Frontier (DEFAULT) ⭐ ──────────────────────────────────────────
  {
    id: "", // filled at seed time
    name: "Chinese Frontier",
    description:
      "Best overall cost-performance. Three Chinese frontier models deliberate in parallel, GLM 5.1 judges. Great for general tasks, planning, and analysis.",
    agents: [
      {
        modelId: "deepseek/deepseek-v4-pro",
        provider: "deepseek",
        name: "DeepSeek V4 Pro",
      },
      {
        modelId: "moonshotai/kimi-k2.7",
        provider: "moonshotai",
        name: "Kimi K2.7",
      },
      { modelId: "zai/glm-5.1", provider: "zai", name: "GLM 5.1" },
    ],
    judge: {
      modelId: "zai/glm-5.1",
      provider: "zai",
      name: "GLM 5.1",
      role: "judge",
    },
    capabilities: ["council", "swarm", "hybrid"],
    domainHint: "general",
    defaultMode: "council",
    estCostMin: 0.04,
    estCostMax: 0.1,
    isSystem: true,
    isDefault: true,
    sortOrder: 0,
    createdBy: null,
  },

  // ── 2. Speed Trio ⚡ ──────────────────────────────────────────────────────────
  {
    id: "",
    name: "Speed Trio",
    description:
      "Fastest responses. DeepSeek V4 Pro + Kimi K2.7 + Gemini 2.5 Flash with self-judge. Ideal for quick Q&A and real-time chat.",
    agents: [
      {
        modelId: "deepseek/deepseek-v4-pro",
        provider: "deepseek",
        name: "DeepSeek V4 Pro",
      },
      {
        modelId: "moonshotai/kimi-k2.7",
        provider: "moonshotai",
        name: "Kimi K2.7",
      },
      {
        modelId: "google/gemini-2.5-flash",
        provider: "google",
        name: "Gemini 2.5 Flash",
      },
    ],
    judge: {
      modelId: "deepseek/deepseek-v4-pro",
      provider: "deepseek",
      name: "DeepSeek V4 Pro",
      role: "judge",
    },
    capabilities: ["council", "swarm", "hybrid"],
    domainHint: "general",
    defaultMode: "council",
    estCostMin: 0.02,
    estCostMax: 0.05,
    isSystem: true,
    isDefault: false,
    sortOrder: 1,
    createdBy: null,
  },

  // ── 3. Sonnet Synth 🎯 ────────────────────────────────────────────────────────
  {
    id: "",
    name: "Sonnet Synth",
    description:
      "Balanced quality. Four Chinese frontier agents with Claude Sonnet 4.6 as judge. Strong reasoning with cost discipline. Great for important decisions.",
    agents: [
      {
        modelId: "deepseek/deepseek-v4-pro",
        provider: "deepseek",
        name: "DeepSeek V4 Pro",
      },
      {
        modelId: "moonshotai/kimi-k2.7",
        provider: "moonshotai",
        name: "Kimi K2.7",
      },
      { modelId: "zai/glm-5.1", provider: "zai", name: "GLM 5.1" },
      {
        modelId: "alibaba/qwen3-235b",
        provider: "alibaba",
        name: "Qwen 3 235B",
      },
    ],
    judge: {
      modelId: "anthropic/claude-sonnet-4-6",
      provider: "anthropic",
      name: "Claude Sonnet 4.6",
      role: "judge",
    },
    capabilities: ["council", "swarm", "hybrid"],
    domainHint: "general",
    defaultMode: "hybrid",
    estCostMin: 0.1,
    estCostMax: 0.18,
    isSystem: true,
    isDefault: false,
    sortOrder: 2,
    createdBy: null,
  },

  // ── 4. Deep Reasoning 👑 (FLAGSHIP — OPUS ONLY HERE) ─────────────────────────
  {
    id: "",
    name: "Deep Reasoning",
    description:
      "Flagship. Five frontier agents + Opus 4.8 as judge. For highest-stakes decisions, complex reasoning, and critical analysis. 💎 Premium.",
    agents: [
      {
        modelId: "deepseek/deepseek-v4-pro",
        provider: "deepseek",
        name: "DeepSeek V4 Pro",
      },
      {
        modelId: "moonshotai/kimi-k2.7",
        provider: "moonshotai",
        name: "Kimi K2.7",
      },
      { modelId: "zai/glm-5.1", provider: "zai", name: "GLM 5.1" },
      {
        modelId: "alibaba/qwen3-235b",
        provider: "alibaba",
        name: "Qwen 3 235B",
      },
      {
        modelId: "alibaba/qwen-3-coder",
        provider: "alibaba",
        name: "Qwen 3 Coder",
      },
    ],
    judge: {
      modelId: "anthropic/claude-opus-4-8",
      provider: "anthropic",
      name: "Claude Opus 4.8",
      role: "judge",
    },
    capabilities: ["council", "swarm", "hybrid"],
    domainHint: "reasoning",
    defaultMode: "council",
    estCostMin: 0.2,
    estCostMax: 0.4,
    isSystem: true,
    isDefault: false,
    sortOrder: 3,
    createdBy: null,
  },

  // ── 5. Code Specialist 💻 ─────────────────────────────────────────────────────
  {
    id: "",
    name: "Code Specialist",
    description:
      "Built for software engineering. Kimi K2.7 Code + Qwen 3 Coder + DeepSeek V4 Pro, judged by Claude Sonnet 4.6. Best for multi-file coding tasks.",
    agents: [
      {
        modelId: "moonshotai/kimi-k2.7-code",
        provider: "moonshotai",
        name: "Kimi K2.7 Code",
      },
      {
        modelId: "alibaba/qwen-3-coder",
        provider: "alibaba",
        name: "Qwen 3 Coder",
      },
      {
        modelId: "deepseek/deepseek-v4-pro",
        provider: "deepseek",
        name: "DeepSeek V4 Pro",
      },
    ],
    judge: {
      modelId: "anthropic/claude-sonnet-4-6",
      provider: "anthropic",
      name: "Claude Sonnet 4.6",
      role: "judge",
    },
    capabilities: ["council", "swarm", "hybrid"],
    domainHint: "coding",
    defaultMode: "swarm",
    estCostMin: 0.08,
    estCostMax: 0.18,
    isSystem: true,
    isDefault: false,
    sortOrder: 4,
    createdBy: null,
  },

  // ── 6. Research Specialist 🔬 ──────────────────────────────────────────────────
  {
    id: "",
    name: "Research Specialist",
    description:
      "Deep research. GLM 5.1 (200K context) + Gemini 2.5 Pro (web) + Kimi K2.7. Great for audits, multi-document analysis, and comprehensive reports.",
    agents: [
      { modelId: "zai/glm-5.1", provider: "zai", name: "GLM 5.1" },
      {
        modelId: "google/gemini-2.5-pro",
        provider: "google",
        name: "Gemini 2.5 Pro",
      },
      {
        modelId: "moonshotai/kimi-k2.7",
        provider: "moonshotai",
        name: "Kimi K2.7",
      },
    ],
    judge: {
      modelId: "deepseek/deepseek-v4-pro",
      provider: "deepseek",
      name: "DeepSeek V4 Pro",
      role: "judge",
    },
    capabilities: ["council", "swarm", "hybrid"],
    domainHint: "research",
    defaultMode: "swarm",
    estCostMin: 0.05,
    estCostMax: 0.12,
    isSystem: true,
    isDefault: false,
    sortOrder: 5,
    createdBy: null,
  },

  // ── 7. Dual Frontier 🪶 (MINIMALIST) ──────────────────────────────────────────
  {
    id: "",
    name: "Dual Frontier",
    description:
      "Minimalist. Just DeepSeek V4 Pro + Kimi K2.7 with GLM 5.1 judge. Lowest cost panel for simple decisions.",
    agents: [
      {
        modelId: "deepseek/deepseek-v4-pro",
        provider: "deepseek",
        name: "DeepSeek V4 Pro",
      },
      {
        modelId: "moonshotai/kimi-k2.7",
        provider: "moonshotai",
        name: "Kimi K2.7",
      },
    ],
    judge: {
      modelId: "zai/glm-5.1",
      provider: "zai",
      name: "GLM 5.1",
      role: "judge",
    },
    capabilities: ["council", "swarm", "hybrid"],
    domainHint: "general",
    defaultMode: "council",
    estCostMin: 0.03,
    estCostMax: 0.06,
    isSystem: true,
    isDefault: false,
    sortOrder: 6,
    createdBy: null,
  },
];

export const DEFAULT_PRESET_NAME = "Chinese Frontier";

export function getDefaultPreset(): PanelPreset {
  return SYSTEM_PRESETS[0];
}

export function getPresetByName(name: string): PanelPreset | undefined {
  return SYSTEM_PRESETS.find((p) => p.name === name);
}

export function getPresetById(id: string): PanelPreset | undefined {
  // Used after seed populates IDs; for runtime, search by name
  return SYSTEM_PRESETS.find((p) => p.id === id);
}
