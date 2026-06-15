"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Cpu, Zap, Brain, Globe, Code, Wrench, Palette, BarChart3, MessageSquare, BookOpen } from "lucide-react";
import { chatModels, DEFAULT_CHAT_MODEL } from "@/lib/ai/models";

// Task type metadata (mirrors model-router.ts without importing server code)
const taskMeta: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  planning: { label: "Planning", icon: <Brain className="size-4" />, description: "Architecture, design, spec writing, PRD creation" },
  coding: { label: "Coding", icon: <Code className="size-4" />, description: "Code generation, refactoring, bug fixes, implementation" },
  long_context: { label: "Long Context", icon: <BookOpen className="size-4" />, description: "Large file analysis, multi-document synthesis, deep audits" },
  multilingual: { label: "Multilingual", icon: <Globe className="size-4" />, description: "Non-English queries, translation, multi-locale support" },
  fast_chat: { label: "Quick Chat", icon: <Zap className="size-4" />, description: "Quick Q&A, simple responses, greetings" },
  tool_heavy: { label: "Tool Orchestration", icon: <Wrench className="size-4" />, description: "Multi-tool orchestration, complex workflows, MCP integration" },
  reasoning: { label: "Reasoning", icon: <Brain className="size-4" />, description: "Complex logic, math, deep analysis, evaluation" },
  creative: { label: "Creative", icon: <Palette className="size-4" />, description: "Content creation, design ideas, writing, brainstorming" },
  analysis: { label: "Analysis", icon: <BarChart3 className="size-4" />, description: "Data analysis, pattern recognition, metrics, reporting" },
  general: { label: "General", icon: <MessageSquare className="size-4" />, description: "Default for unmatched intents — balanced performance" },
};

// Router configuration (mirrors model-router.ts routing rules)
const defaultRouter: Record<string, { primary: string; fallback: string; reasoning: string }> = {
  planning: {
    primary: "anthropic/claude-sonnet-4-6",
    fallback: "deepseek/deepseek-v4-pro",
    reasoning: "Claude excels at structured planning with clear reasoning chains.",
  },
  coding: {
    primary: "moonshotai/kimi-k2.7-code",
    fallback: "deepseek/deepseek-v4-pro",
    reasoning: "Kimi K2.7 Code is purpose-built for code generation and technical tasks.",
  },
  long_context: {
    primary: "zai/glm-5",
    fallback: "deepseek/deepseek-v4-pro",
    reasoning: "GLM 5 handles 200K tokens with strong long-document recall.",
  },
  multilingual: {
    primary: "alibaba/qwen-3-235b",
    fallback: "deepseek/deepseek-v4-pro",
    reasoning: "Qwen 3 235B is trained on 100+ languages with cross-lingual reasoning.",
  },
  fast_chat: {
    primary: "deepseek/deepseek-v4-flash",
    fallback: "deepseek/deepseek-v3.2",
    reasoning: "Fastest response times for simple queries.",
  },
  tool_heavy: {
    primary: "deepseek/deepseek-v4-pro",
    fallback: "anthropic/claude-sonnet-4-6",
    reasoning: "DeepSeek V4 Pro has strong tool-use with lower cost.",
  },
  reasoning: {
    primary: "deepseek/deepseek-v4-pro",
    fallback: "alibaba/qwen3-235b",
    reasoning: "DeepSeek V4 Pro with reasoning effort for complex logic.",
  },
  creative: {
    primary: "anthropic/claude-sonnet-4-6",
    fallback: "alibaba/qwen3-235b",
    reasoning: "Claude excels at creative content and nuanced writing.",
  },
  analysis: {
    primary: "deepseek/deepseek-v4-pro",
    fallback: "zhipuai/glm-5.2",
    reasoning: "DeepSeek for structured analysis, GLM for very large datasets.",
  },
  general: {
    primary: DEFAULT_CHAT_MODEL,
    fallback: "deepseek/deepseek-v3.2",
    reasoning: "DeepSeek V4 Pro — best overall cost/performance ratio.",
  },
};

function getModelName(modelId: string): string {
  const model = chatModels.find((m) => m.id === modelId);
  return model?.name ?? modelId;
}

export default function ModelsSettingsPage() {
  const [autoRoute, setAutoRoute] = useState(true);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Model Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure AI model preferences and intelligent routing for your tasks.
        </p>
      </div>

      <Separator />

      {/* Auto Router Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cpu className="size-5 text-emerald-400" />
              <div>
                <CardTitle>Intelligent Model Router</CardTitle>
                <CardDescription>
                  Automatically select the best model for each task type.
                  When disabled, uses your chosen default model for everything.
                </CardDescription>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoRoute}
              onClick={() => setAutoRoute(!autoRoute)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                autoRoute ? "bg-emerald-500" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow-lg transition-transform ${
                  autoRoute ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </CardHeader>
      </Card>

      {/* Routing Rules */}
      {autoRoute && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Task → Model Routing Rules</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(taskMeta).map(([key, meta]) => {
              const rule = defaultRouter[key];
              const isPhase20 = rule.primary.includes("kimi-k2.7") ||
                               rule.primary.includes("glm-5.2") ||
                               rule.primary.includes("qwen3");

              return (
                <Card key={key} className={isPhase20 ? "border-emerald-500/30" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      {meta.icon}
                      <CardTitle className="text-base">{meta.label}</CardTitle>
                      {isPhase20 && (
                        <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-400">
                          Phase 20
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{meta.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Primary</span>
                      <span className="font-mono text-xs">{getModelName(rule.primary)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Fallback</span>
                      <span className="font-mono text-xs">{getModelName(rule.fallback)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{rule.reasoning}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Separator />

      {/* Available Models */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Available Models ({chatModels.length})</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {chatModels.map((model) => {
            const isNew = model.id.includes("glm-5.2") ||
                         model.id.includes("kimi-k2.7") ||
                         model.id.includes("qwen3");
            const isDefault = model.id === DEFAULT_CHAT_MODEL;
            return (
              <Card key={model.id} className={`${isNew ? "border-emerald-500/30 bg-emerald-500/5" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="size-3.5 text-muted-foreground" />
                    <CardTitle className="text-sm">{model.name}</CardTitle>
                  </div>
                  <CardDescription className="text-xs">{model.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs capitalize">
                      {model.provider}
                    </Badge>
                    {isDefault && (
                      <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400">
                        Default
                      </Badge>
                    )}
                    {isNew && (
                      <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-400">
                        New
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {model.routeType === "direct" ? "Direct" : "Gateway"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="text-xs text-muted-foreground text-center pt-4">
        Model settings take effect on the next message. Changes are applied client-side only.
        <br />
        Phase 20 · NEPTUNE AGENT OS · {new Date().toISOString().split("T")[0]}
      </div>
    </div>
  );
}
