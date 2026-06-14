"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Globe,
  Package,
  FileCode2,
  BookOpen,
  Shield,
  FlaskConical,
  Rocket,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  ExternalLink,
  Copy,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────

interface WizardState {
  step: number;
  // Step 1 — API discovery
  apiUrl: string;
  apiDocUrl: string;
  discoveredEndpoints: string[];
  discoveryStatus: "idle" | "loading" | "success" | "error";
  discoveryError: string | null;
  // Step 2 — MCP check
  mcpCheckResult: { exists: boolean; url: string | null; servers: string[] } | null;
  mcpCheckStatus: "idle" | "loading" | "success" | "error";
  // Step 3 — Skill generation
  skillContent: string | null;
  skillStatus: "idle" | "loading" | "success" | "error";
  // Step 4 — Function wrapping
  functions: { name: string; signature: string; description: string }[];
  functionStatus: "idle" | "loading" | "success" | "error";
  // Step 5 — Playbook suggestions
  suggestedDomains: string[];
  domainStatus: "idle" | "loading" | "success" | "error";
  // Step 6 — SOP generation
  sopContent: string | null;
  sopStatus: "idle" | "loading" | "success" | "error";
  // Step 7 — Sandbox test
  sandboxResult: { passed: boolean; output: string; durationMs: number } | null;
  sandboxStatus: "idle" | "loading" | "success" | "error";
  // Step 8 — Adopt
  adoptResult: { success: boolean; insertedRecords: Record<string, number> } | null;
  adoptStatus: "idle" | "loading" | "success" | "error";
  // Meta
  connectorName: string;
}

const TOTAL_STEPS = 8;

const STEP_LABELS = [
  "API Discovery",
  "MCP Server Check",
  "Skill Authoring",
  "Function Wrapping",
  "Playbook Integration",
  "SOP Generation",
  "Sandbox Test",
  "Adopt & Register",
];

const STEP_ICONS = [
  Globe,
  Package,
  Sparkles,
  FileCode2,
  BookOpen,
  Shield,
  FlaskConical,
  Rocket,
];

const STEP_DESCRIPTIONS = [
  "Enter an API URL to discover available endpoints and schema",
  "Check if an MCP server already exists on smithery.ai or GitHub",
  "Auto-generate a SKILL.md with constraints and best practices",
  "Generate TypeScript function wrappers for each endpoint",
  "Suggest playbook domain matches based on API capabilities",
  "Generate SOP with common operations, anti-patterns, and rate limits",
  "Run a sample call in Vercel Sandbox to verify connectivity",
  "Insert into library_* tables, generate KG embeddings, update registry",
];

export default function ConnectorWizardPage() {
  const [wizard, setWizard] = useState<WizardState>({
    step: 1,
    apiUrl: "",
    apiDocUrl: "",
    discoveredEndpoints: [],
    discoveryStatus: "idle",
    discoveryError: null,
    mcpCheckResult: null,
    mcpCheckStatus: "idle",
    skillContent: null,
    skillStatus: "idle",
    functions: [],
    functionStatus: "idle",
    suggestedDomains: [],
    domainStatus: "idle",
    sopContent: null,
    sopStatus: "idle",
    sandboxResult: null,
    sandboxStatus: "idle",
    adoptResult: null,
    adoptStatus: "idle",
    connectorName: "",
  });

  const update = useCallback(
    (patch: Partial<WizardState>) => setWizard((prev) => ({ ...prev, ...patch })),
    [],
  );

  const canProceed = useCallback((): boolean => {
    const s = wizard.step;
    if (s === 1) return wizard.apiUrl.length > 0 && wizard.discoveryStatus === "success";
    if (s === 2) return wizard.mcpCheckStatus !== "loading";
    if (s === 3) return wizard.skillStatus === "success";
    if (s === 4) return wizard.functionStatus === "success";
    if (s === 5) return wizard.domainStatus === "success" || wizard.domainStatus === "idle";
    if (s === 6) return wizard.sopStatus === "success" || wizard.sopStatus === "idle";
    if (s === 7) return wizard.sandboxStatus === "success";
    return true;
  }, [wizard]);

  // ── Step Handlers ──────────────────────────────────────────────────────

  const discoverApi = async () => {
    update({ discoveryStatus: "loading", discoveryError: null });
    try {
      const res = await fetch("/api/wizard/discover-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiUrl: wizard.apiUrl, apiDocUrl: wizard.apiDocUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Discovery failed");
      update({
        discoveredEndpoints: data.endpoints ?? [],
        connectorName: data.suggestedName ?? "",
        discoveryStatus: "success",
      });
    } catch (err) {
      update({ discoveryStatus: "error", discoveryError: (err as Error).message });
    }
  };

  const checkMcp = async () => {
    update({ mcpCheckStatus: "loading" });
    try {
      const res = await fetch("/api/wizard/check-mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: wizard.connectorName, apiUrl: wizard.apiUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "MCP check failed");
      update({ mcpCheckResult: data, mcpCheckStatus: "success" });
    } catch (err) {
      update({ mcpCheckStatus: "error" });
    }
  };

  const generateSkill = async () => {
    update({ skillStatus: "loading" });
    try {
      const res = await fetch("/api/wizard/generate-skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorName: wizard.connectorName,
          apiUrl: wizard.apiUrl,
          endpoints: wizard.discoveredEndpoints,
          mcpCheck: wizard.mcpCheckResult,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Skill generation failed");
      update({ skillContent: data.skillContent, skillStatus: "success" });
    } catch (err) {
      update({ skillStatus: "error" });
    }
  };

  const generateFunctions = async () => {
    update({ functionStatus: "loading" });
    try {
      const res = await fetch("/api/wizard/generate-skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorName: wizard.connectorName,
          apiUrl: wizard.apiUrl,
          endpoints: wizard.discoveredEndpoints,
          mode: "functions",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Function generation failed");
      update({ functions: data.functions ?? [], functionStatus: "success" });
    } catch (err) {
      update({ functionStatus: "error" });
    }
  };

  const suggestDomains = async () => {
    update({ domainStatus: "loading" });
    try {
      const res = await fetch("/api/wizard/generate-skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorName: wizard.connectorName,
          apiUrl: wizard.apiUrl,
          endpoints: wizard.discoveredEndpoints,
          mode: "domains",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Domain suggestion failed");
      update({ suggestedDomains: data.domains ?? [], domainStatus: "success" });
    } catch (err) {
      update({ domainStatus: "error" });
    }
  };

  const generateSop = async () => {
    update({ sopStatus: "loading" });
    try {
      const res = await fetch("/api/wizard/generate-skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorName: wizard.connectorName,
          apiUrl: wizard.apiUrl,
          endpoints: wizard.discoveredEndpoints,
          mode: "sop",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "SOP generation failed");
      update({ sopContent: data.sopContent, sopStatus: "success" });
    } catch (err) {
      update({ sopStatus: "error" });
    }
  };

  const runSandboxTest = async () => {
    update({ sandboxStatus: "loading" });
    try {
      const res = await fetch("/api/wizard/sandbox-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorName: wizard.connectorName,
          apiUrl: wizard.apiUrl,
          endpoints: wizard.discoveredEndpoints,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sandbox test failed");
      update({ sandboxResult: data, sandboxStatus: "success" });
    } catch (err) {
      update({ sandboxStatus: "error" });
    }
  };

  const adoptConnector = async () => {
    update({ adoptStatus: "loading" });
    try {
      const res = await fetch("/api/wizard/adopt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorName: wizard.connectorName,
          apiUrl: wizard.apiUrl,
          endpoints: wizard.discoveredEndpoints,
          skillContent: wizard.skillContent,
          functions: wizard.functions,
          suggestedDomains: wizard.suggestedDomains,
          sopContent: wizard.sopContent,
          sandboxResult: wizard.sandboxResult,
          mcpCheck: wizard.mcpCheckResult,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Adopt failed");
      update({ adoptResult: data, adoptStatus: "success" });
    } catch (err) {
      update({ adoptStatus: "error" });
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  const StepIcon = STEP_ICONS[wizard.step - 1];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-[11px] font-medium text-primary mb-4">
            <Sparkles className="size-3" />
            Custom Connector Wizard
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            {STEP_LABELS[wizard.step - 1]}
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {STEP_DESCRIPTIONS[wizard.step - 1]}
          </p>
        </motion.div>

        {/* Progress Bar */}
        <div className="flex items-center gap-1.5 mb-8 px-2">
          {STEP_LABELS.map((_, i) => {
            const stepNum = i + 1;
            const isDone = wizard.step > stepNum;
            const isCurrent = wizard.step === stepNum;
            const Icon = STEP_ICONS[i];
            return (
              <div key={i} className="flex-1 flex items-center">
                <motion.div
                  className={cn(
                    "flex items-center justify-center size-7 rounded-full text-[10px] font-bold transition-all",
                    isDone && "bg-emerald-500 text-white",
                    isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                    !isDone && !isCurrent && "bg-muted text-muted-foreground",
                  )}
                  animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ repeat: isCurrent ? Infinity : 0, duration: 2 }}
                >
                  {isDone ? <CheckCircle2 className="size-3.5" /> : <Icon className="size-3.5" />}
                </motion.div>
                {i < TOTAL_STEPS - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-0.5 mx-1 rounded-full transition-colors",
                      i < wizard.step - 1 ? "bg-emerald-500/40" : "bg-border/30",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={wizard.step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="bg-card/60 backdrop-blur-xl border border-border/30 rounded-2xl p-6 shadow-sm"
          >
            {/* Step 1: API Discovery */}
            {wizard.step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    API Base URL
                  </label>
                  <input
                    type="url"
                    value={wizard.apiUrl}
                    onChange={(e) => update({ apiUrl: e.target.value })}
                    placeholder="https://api.example.com/v1"
                    className="w-full h-10 px-3 rounded-lg bg-muted/30 border border-border/30 text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    onKeyDown={(e) => e.key === "Enter" && discoverApi()}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    API Documentation URL (optional)
                  </label>
                  <input
                    type="url"
                    value={wizard.apiDocUrl}
                    onChange={(e) => update({ apiDocUrl: e.target.value })}
                    placeholder="https://docs.example.com/api"
                    className="w-full h-10 px-3 rounded-lg bg-muted/30 border border-border/30 text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>

                <motion.button
                  onClick={discoverApi}
                  disabled={!wizard.apiUrl || wizard.discoveryStatus === "loading"}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                    "bg-primary text-primary-foreground",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                  )}
                >
                  {wizard.discoveryStatus === "loading" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Globe className="size-4" />
                  )}
                  Discover Endpoints
                </motion.button>

                {wizard.discoveryStatus === "error" && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/10 text-xs text-red-500">
                    <AlertCircle className="size-3.5 flex-shrink-0" />
                    {wizard.discoveryError}
                  </div>
                )}

                {wizard.discoveryStatus === "success" && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      Discovered {wizard.discoveredEndpoints.length} endpoints
                      {wizard.connectorName && (
                        <> — suggested name: <code className="text-primary">{wizard.connectorName}</code></>
                      )}
                    </div>
                    <div className="grid gap-1.5 max-h-48 overflow-y-auto">
                      {wizard.discoveredEndpoints.map((ep) => (
                        <div
                          key={ep}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/20 text-xs font-mono"
                        >
                          <code className="text-emerald-500 text-[10px] font-bold">GET</code>
                          <span className="text-muted-foreground">{ep}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: MCP Check */}
            {wizard.step === 2 && (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Checking smithery.ai and GitHub for existing MCP servers matching{" "}
                  <code className="text-foreground font-medium">{wizard.connectorName || wizard.apiUrl}</code>
                </div>

                <motion.button
                  onClick={checkMcp}
                  disabled={wizard.mcpCheckStatus === "loading"}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                    "bg-primary text-primary-foreground",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                  )}
                >
                  {wizard.mcpCheckStatus === "loading" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Package className="size-4" />
                  )}
                  Check MCP Servers
                </motion.button>

                {wizard.mcpCheckStatus === "success" && wizard.mcpCheckResult && (
                  <div className={cn(
                    "p-4 rounded-xl border",
                    wizard.mcpCheckResult.exists
                      ? "bg-emerald-500/5 border-emerald-500/20"
                      : "bg-amber-500/5 border-amber-500/20",
                  )}>
                    <div className="text-sm font-medium mb-2">
                      {wizard.mcpCheckResult.exists
                        ? "✅ Existing MCP server found!"
                        : "⚠️ No existing MCP server — will create new"}
                    </div>
                    {wizard.mcpCheckResult.url && (
                      <a
                        href={wizard.mcpCheckResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        View on smithery.ai <ExternalLink className="size-3" />
                      </a>
                    )}
                    {wizard.mcpCheckResult.servers.length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Related servers: {wizard.mcpCheckResult.servers.join(", ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Steps 3-7: Actions */}
            {[
              { step: 3, status: wizard.skillStatus, handler: generateSkill, label: "Generate SKILL.md", icon: Sparkles },
              { step: 4, status: wizard.functionStatus, handler: generateFunctions, label: "Generate Functions", icon: FileCode2 },
              { step: 5, status: wizard.domainStatus, handler: suggestDomains, label: "Suggest Domains", icon: BookOpen },
              { step: 6, status: wizard.sopStatus, handler: generateSop, label: "Generate SOP", icon: Shield },
              { step: 7, status: wizard.sandboxStatus, handler: runSandboxTest, label: "Run Sandbox Test", icon: FlaskConical },
            ].map(({ step, status, handler, label, icon: Icon }) =>
              wizard.step === step ? (
                <div key={step} className="space-y-4">
                  <motion.button
                    onClick={handler}
                    disabled={status === "loading"}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                      "bg-primary text-primary-foreground",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                    )}
                  >
                    {status === "loading" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Icon className="size-4" />
                    )}
                    {label}
                  </motion.button>

                  {status === "error" && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/10 text-xs text-red-500">
                      <AlertCircle className="size-3.5" /> Failed. Try again.
                    </div>
                  )}

                  {status === "success" && step === 3 && wizard.skillContent && (
                    <div className="p-3 rounded-lg bg-muted/20 border border-border/20 max-h-60 overflow-y-auto">
                      <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap">{wizard.skillContent.slice(0, 500)}{wizard.skillContent.length > 500 ? "..." : ""}</pre>
                      <button
                        onClick={() => navigator.clipboard.writeText(wizard.skillContent!)}
                        className="flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary mt-2"
                      >
                        <Copy className="size-3" /> Copy full content
                      </button>
                    </div>
                  )}

                  {status === "success" && step === 4 && wizard.functions.length > 0 && (
                    <div className="space-y-2">
                      {wizard.functions.map((fn) => (
                        <div key={fn.name} className="p-3 rounded-lg bg-muted/20 border border-border/20">
                          <div className="text-xs font-mono font-medium text-foreground">{fn.signature}</div>
                          <div className="text-[11px] text-muted-foreground mt-1">{fn.description}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {status === "success" && step === 5 && wizard.suggestedDomains.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {wizard.suggestedDomains.map((d) => (
                        <span key={d} className="px-2.5 py-1 rounded-full bg-primary/5 border border-primary/10 text-xs text-primary">
                          {d}
                        </span>
                      ))}
                    </div>
                  )}

                  {status === "success" && step === 6 && wizard.sopContent && (
                    <div className="p-3 rounded-lg bg-muted/20 border border-border/20 max-h-60 overflow-y-auto">
                      <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap">{wizard.sopContent.slice(0, 500)}...</pre>
                    </div>
                  )}

                  {status === "success" && step === 7 && wizard.sandboxResult && (
                    <div className={cn(
                      "p-4 rounded-xl border",
                      wizard.sandboxResult.passed
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : "bg-red-500/5 border-red-500/20",
                    )}>
                      <div className="text-sm font-medium mb-1">
                        {wizard.sandboxResult.passed ? "✅ Test Passed" : "❌ Test Failed"}
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        Duration: {wizard.sandboxResult.durationMs}ms
                      </div>
                      <pre className="text-[10px] font-mono text-muted-foreground/70 max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {wizard.sandboxResult.output}
                      </pre>
                    </div>
                  )}
                </div>
              ) : null,
            )}

            {/* Step 8: Adopt */}
            {wizard.step === 8 && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-muted/20 border border-border/20">
                  <div className="text-sm font-medium mb-2">Summary</div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>Connector: <code className="text-foreground">{wizard.connectorName}</code></div>
                    <div>Endpoints: <code className="text-foreground">{wizard.discoveredEndpoints.length}</code></div>
                    <div>Functions: <code className="text-foreground">{wizard.functions.length}</code></div>
                    <div>Domains: <code className="text-foreground">{wizard.suggestedDomains.length}</code></div>
                    <div>Sandbox: <code className={wizard.sandboxResult?.passed ? "text-emerald-500" : "text-red-500"}>{wizard.sandboxResult?.passed ? "Passed" : "Failed/Not run"}</code></div>
                    <div>SKILL.md: <code className="text-foreground">{wizard.skillContent ? "Generated" : "Not generated"}</code></div>
                  </div>
                </div>

                <motion.button
                  onClick={adoptConnector}
                  disabled={wizard.adoptStatus === "loading"}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all w-full justify-center",
                    "bg-emerald-600 text-white hover:bg-emerald-700",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                  )}
                >
                  {wizard.adoptStatus === "loading" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Rocket className="size-4" />
                  )}
                  Adopt & Register Connector
                </motion.button>

                {wizard.adoptStatus === "success" && wizard.adoptResult && (
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 mb-2">
                      <CheckCircle2 className="size-4" /> Connector Adopted!
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {Object.entries(wizard.adoptResult.insertedRecords).map(([key, val]) => (
                        <div key={key} className="flex justify-between">
                          <span className="capitalize">{key}</span>
                          <code className="text-foreground font-medium">{val}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <motion.button
            onClick={() => update({ step: Math.max(1, wizard.step - 1) })}
            disabled={wizard.step === 1}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              "bg-muted/30 text-muted-foreground border border-border/30",
              wizard.step === 1 && "opacity-30 cursor-not-allowed",
            )}
          >
            <ArrowLeft className="size-3.5" /> Back
          </motion.button>

          <div className="text-xs text-muted-foreground/50">
            Step {wizard.step} of {TOTAL_STEPS}
          </div>

          {wizard.step < TOTAL_STEPS && (
            <motion.button
              onClick={() => update({ step: wizard.step + 1 })}
              disabled={!canProceed()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                "bg-primary text-primary-foreground",
                !canProceed() && "opacity-40 cursor-not-allowed",
              )}
            >
              Next <ArrowRight className="size-3.5" />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
