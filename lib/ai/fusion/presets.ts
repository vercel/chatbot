/**
 * Phase 23B: 11 System Panel Presets
 *
 * Each preset is a CONTAINER: agents[] + judge + capabilities[] + domainHint.
 * Mode (council/swarm/hybrid) is auto-detected at runtime, user can override.
 *
 * Presets:
 *   1. Chinese Frontier (DEFAULT) — Chinese frontier, GLM 5.2 self-judge
 *   2. Speed Trio — fast + cheap, DeepSeek V4 Flash self-judge
 *   3. Sonnet Synth — 5 Chinese agents, GLM 5.2 judge
 *   4. Deep Reasoning — 5 reasoning agents, GLM 5.2 self-judge
 *   5. Code Specialist — GLM 5.2 PRIMARY coder, GLM 5.2 self-judge
 *   6. Research Specialist — GLM 5.2 lead, 1M context
 *   7. Dual Frontier — minimalist Chinese
 *   8. Vision Council — multimodal, GLM 5.2 judge
 *   9. MiniMax Ensemble — diverse reasoning, GLM 5.2 judge
 *  10. Long Context Master — 1M context, GLM 5.2 self-judge
 *  11. Custom — user-defined placeholder
 */

import type { PanelPreset } from "./types";

export const SYSTEM_PRESETS: PanelPreset[] = [
  // ── 1. Chinese Frontier (DEFAULT) ⭐ ────────────────────────────────────
  {
    id: "",
    name: "Chinese Frontier",
    description:
      "Best overall cost-performance. DeepSeek V4 Pro + Kimi K2.7 Code + GLM 5.2 (1M context), judged by GLM 5.2. Perfect for general tasks, planning, and analysis.",
    agents: [
      { modelId: "deepseek/deepseek-v4-pro", provider: "deepseek", name: "DeepSeek V4 Pro" },
      { modelId: "moonshotai/kimi-k2.7-code", provider: "moonshotai", name: "Kimi K2.7 Code" },
      { modelId: "zai/glm-5.2", provider: "zai", name: "GLM 5.2" },
    ],
    judge: { modelId: "zai/glm-5.2", provider: "zai", name: "GLM 5.2", role: "judge" },
    capabilities: ["council", "swarm", "hybrid"],
    domainHint: "general",
    defaultMode: "council",
    estCostMin: 0.05,
    estCostMax: 0.12,
    isSystem: true,
    isDefault: true,
    sortOrder: 0,
    createdBy: null,
  },

  // ── 2. Speed Trio ⚡ ───────────────────────────────────────────────────
  {
    id: "",
    name: "Speed Trio",
    description:
      "Fastest responses at lowest cost. DeepSeek V4 Flash + Kimi K2.7 Code Highspeed + StepFun Step 3.7 Flash with self-judge. Ideal for quick Q&A and real-time chat.",
    agents: [
      { modelId: "deepseek/deepseek-v4-flash", provider: "deepseek", name: "DeepSeek V4 Flash" },
      { modelId: "moonshotai/kimi-k2.7-code-highspeed", provider: "moonshotai", name: "Kimi K2.7 Code HS" },
      { modelId: "stepfun/step-3.7-flash", provider: "stepfun", name: "Step 3.7 Flash" },
    ],
    judge: { modelId: "deepseek/deepseek-v4-flash", provider: "deepseek", name: "DeepSeek V4 Flash", role: "judge" },
    capabilities: ["council", "swarm", "hybrid"],
    domainHint: "general",
    defaultMode: "council",
    estCostMin: 0.01,
    estCostMax: 0.03,
    isSystem: true,
    isDefault: false,
    sortOrder: 1,
    createdBy: null,
  },

  // ── 3. Sonnet Synth 🎯 ─────────────────────────────────────────────────
  {
    id: "",
    name: "Sonnet Synth",
    description:
      "Balanced quality. 5 Chinese frontier agents: DeepSeek V4 Pro + Kimi K2.7 Code + GLM 5.2 + Qwen3 Max + MiniMax M3. GLM 5.2 judges with polish and precision.",
    agents: [
      { modelId: "deepseek/deepseek-v4-pro", provider: "deepseek", name: "DeepSeek V4 Pro" },
      { modelId: "moonshotai/kimi-k2.7-code", provider: "moonshotai", name: "Kimi K2.7 Code" },
      { modelId: "zai/glm-5.2", provider: "zai", name: "GLM 5.2" },
      { modelId: "alibaba/qwen3-max", provider: "alibaba", name: "Qwen3 Max" },
      { modelId: "minimax/minimax-m3", provider: "minimax", name: "MiniMax M3" },
    ],
    judge: { modelId: "zai/glm-5.2", provider: "zai", name: "GLM 5.2", role: "judge" },
    capabilities: ["council", "swarm", "hybrid"],
    domainHint: "general",
    defaultMode: "hybrid",
    estCostMin: 0.1,
    estCostMax: 0.2,
    isSystem: true,
    isDefault: false,
    sortOrder: 2,
    createdBy: null,
  },

  // ── 4. Deep Reasoning 👑 (FLAGSHIP — GLM 5.2 SELF-JUDGE) ──────────────
  {
    id: "",
    name: "Deep Reasoning",
    description:
      "💎 Flagship. 5 frontier reasoning agents: DeepSeek R1 + DeepSeek V3.2 Thinking + Kimi K2 Thinking + GLM 5.2 + Qwen3 Max Thinking. GLM 5.2 self-judges. Highest-stakes decisions, complex reasoning, critical analysis.",
    agents: [
      { modelId: "deepseek/deepseek-r1", provider: "deepseek", name: "DeepSeek R1" },
      { modelId: "deepseek/deepseek-v3.2-thinking", provider: "deepseek", name: "DeepSeek V3.2 Thinking" },
      { modelId: "moonshotai/kimi-k2-thinking", provider: "moonshotai", name: "Kimi K2 Thinking" },
      { modelId: "zai/glm-5.2", provider: "zai", name: "GLM 5.2" },
      { modelId: "alibaba/qwen3-max-thinking", provider: "alibaba", name: "Qwen3 Max Thinking" },
    ],
    judge: { modelId: "zai/glm-5.2", provider: "zai", name: "GLM 5.2", role: "judge" },
    capabilities: ["council", "swarm", "hybrid"],
    domainHint: "reasoning",
    defaultMode: "council",
    estCostMin: 0.25,
    estCostMax: 0.50,
    isSystem: true,
    isDefault: false,
    sortOrder: 3,
    createdBy: null,
  },

  // ── 5. Code Specialist 💻 (GLM 5.2 PRIMARY CODER) ─────────────────────
  {
    id: "",
    name: "Code Specialist",
    description:
      "⭐ GLM 5.2 leads as PRIMARY coder (best individual coder + 1M context). Backed by Kimi K2.7 Code + Qwen3 Coder Next + DeepSeek V4 Pro. GLM 5.2 self-judges. Default mode: Swarm.",
    agents: [
      { modelId: "zai/glm-5.2", provider: "zai", name: "GLM 5.2", role: "lead-coder" },
      { modelId: "moonshotai/kimi-k2.7-code", provider: "moonshotai", name: "Kimi K2.7 Code" },
      { modelId: "alibaba/qwen3-coder-next", provider: "alibaba", name: "Qwen3 Coder Next" },
      { modelId: "deepseek/deepseek-v4-pro", provider: "deepseek", name: "DeepSeek V4 Pro" },
    ],
    judge: { modelId: "zai/glm-5.2", provider: "zai", name: "GLM 5.2", role: "judge" },
    capabilities: ["council", "swarm", "hybrid"],
    domainHint: "coding",
    defaultMode: "swarm",
    estCostMin: 0.12,
    estCostMax: 0.25,
    isSystem: true,
    isDefault: false,
    sortOrder: 4,
    createdBy: null,
  },

  // ── 6. Research Specialist 🔬 ──────────────────────────────────────────
  {
    id: "",
    name: "Research Specialist",
    description:
      "Deep research with 1M context. GLM 5.2 (1M ctx) + Gemini 2.5 Pro (web) + Kimi K2.7 Code + DeepSeek R1. GLM 5.2 self-judges leveraging full context. Default mode: Swarm.",
    agents: [
      { modelId: "zai/glm-5.2", provider: "zai", name: "GLM 5.2" },
      { modelId: "google/gemini-2.5-pro", provider: "google", name: "Gemini 2.5 Pro" },
      { modelId: "moonshotai/kimi-k2.7-code", provider: "moonshotai", name: "Kimi K2.7 Code" },
      { modelId: "deepseek/deepseek-r1", provider: "deepseek", name: "DeepSeek R1" },
    ],
    judge: { modelId: "zai/glm-5.2", provider: "zai", name: "GLM 5.2", role: "judge" },
    capabilities: ["council", "swarm", "hybrid"],
    domainHint: "research",
    defaultMode: "swarm",
    estCostMin: 0.06,
    estCostMax: 0.15,
    isSystem: true,
    isDefault: false,
    sortOrder: 5,
    createdBy: null,
  },

  // ── 7. Dual Frontier 🪶 (MINIMALIST) ───────────────────────────────────
  {
    id: "",
    name: "Dual Frontier",
    description:
      "Minimalist. Just DeepSeek V4 Pro + Kimi K2.7 Code with GLM 5.2 judge. Lowest cost panel for simple decisions. Default mode: Council.",
    agents: [
      { modelId: "deepseek/deepseek-v4-pro", provider: "deepseek", name: "DeepSeek V4 Pro" },
      { modelId: "moonshotai/kimi-k2.7-code", provider: "moonshotai", name: "Kimi K2.7 Code" },
    ],
    judge: { modelId: "zai/glm-5.2", provider: "zai", name: "GLM 5.2", role: "judge" },
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

  // ── 8. Vision Council 👁️ (NEW — MULTIMODAL) ──────────────────────────
  {
    id: "",
    name: "Vision Council",
    description:
      "Multimodal understanding. GLM 5V Turbo + Qwen3 VL 235B + Gemini 2.5 Pro for image analysis, charts, diagrams, and UI review. GLM 5.2 judges.",
    agents: [
      { modelId: "zai/glm-5v-turbo", provider: "zai", name: "GLM 5V Turbo" },
      { modelId: "alibaba/qwen3-vl-235b-a22b-instruct", provider: "alibaba", name: "Qwen3 VL 235B" },
      { modelId: "google/gemini-2.5-pro", provider: "google", name: "Gemini 2.5 Pro" },
    ],
    judge: { modelId: "zai/glm-5.2", provider: "zai", name: "GLM 5.2", role: "judge" },
    capabilities: ["council", "swarm", "hybrid"],
    domainHint: "general",
    defaultMode: "council",
    estCostMin: 0.08,
    estCostMax: 0.15,
    isSystem: true,
    isDefault: false,
    sortOrder: 7,
    createdBy: null,
  },

  // ── 9. MiniMax Ensemble 🌟 (NEW — DIVERSE REASONING) ──────────────────
  {
    id: "",
    name: "MiniMax Ensemble",
    description:
      "Diverse reasoning ensemble. MiniMax M3 + MiniMax M2.7 + DeepSeek V4 Pro for multi-perspective analysis. GLM 5.2 judges. Default mode: Council.",
    agents: [
      { modelId: "minimax/minimax-m3", provider: "minimax", name: "MiniMax M3" },
      { modelId: "minimax/minimax-m2.7", provider: "minimax", name: "MiniMax M2.7" },
      { modelId: "deepseek/deepseek-v4-pro", provider: "deepseek", name: "DeepSeek V4 Pro" },
    ],
    judge: { modelId: "zai/glm-5.2", provider: "zai", name: "GLM 5.2", role: "judge" },
    capabilities: ["council", "swarm", "hybrid"],
    domainHint: "general",
    defaultMode: "council",
    estCostMin: 0.05,
    estCostMax: 0.10,
    isSystem: true,
    isDefault: false,
    sortOrder: 8,
    createdBy: null,
  },

  // ── 10. Long Context Master 📚 (NEW — 1M CONTEXT, HYBRID DEFAULT) ────
  {
    id: "",
    name: "Long Context Master",
    description:
      "1M context powerhouse. GLM 5.2 (1M ctx primary) + Kimi K2.7 Code + DeepSeek V4 Pro. GLM 5.2 self-judges. Perfect for whole-repo analysis, multi-doc synthesis, 500K+ token tasks. Default mode: Hybrid.",
    agents: [
      { modelId: "zai/glm-5.2", provider: "zai", name: "GLM 5.2", role: "primary" },
      { modelId: "moonshotai/kimi-k2.7-code", provider: "moonshotai", name: "Kimi K2.7 Code" },
      { modelId: "deepseek/deepseek-v4-pro", provider: "deepseek", name: "DeepSeek V4 Pro" },
    ],
    judge: { modelId: "zai/glm-5.2", provider: "zai", name: "GLM 5.2", role: "judge" },
    capabilities: ["council", "swarm", "hybrid"],
    domainHint: "general",
    defaultMode: "hybrid",
    estCostMin: 0.08,
    estCostMax: 0.18,
    isSystem: true,
    isDefault: false,
    sortOrder: 9,
    createdBy: null,
  },

  // ── 11. Custom (USER-DEFINED PLACEHOLDER) ──────────────────────────────
  {
    id: "",
    name: "Custom",
    description:
      "Build your own panel. Choose agents, judge, and default mode. All Chinese frontier models available via the custom builder.",
    agents: [],
    judge: { modelId: "", provider: "", name: "Choose a judge", role: "judge" },
    capabilities: ["council", "swarm", "hybrid"],
    domainHint: "general",
    defaultMode: "council",
    estCostMin: 0,
    estCostMax: 0,
    isSystem: true,
    isDefault: false,
    sortOrder: 10,
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
  return SYSTEM_PRESETS.find((p) => p.id === id);
}
