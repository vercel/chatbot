"use client";

/**
 * QuickActionModals — Modal overlays for all 5 Quick Actions
 *
 * Phase 32: Sales Agent Ready Polish
 *
 * Modals:
 *   💳 Send Payment Link  — amount input + currency symbol + validation
 *   💬 Send SMS           — GHL template dropdown + phone + preview
 *   📝 Add Note           — rich textarea with character limit
 *   🎫 Create Ticket      — priority dropdown + assignee selector + description
 *   ⚡ Run Workflow       — library workflows list + search + confirm
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CreditCard,
  MessageCircle,
  StickyNote,
  Ticket,
  Zap,
  DollarSign,
  Send,
  Save,
  Play,
  AlertTriangle,
  Loader2,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TwentyEvent } from "@/lib/harness/postmessage-bus";

// ── Types ──────────────────────────────────────────────────────────────

export type QuickActionType =
  | "send-payment"
  | "send-sms"
  | "add-note"
  | "create-ticket"
  | "run-workflow";

interface QuickActionModalsProps {
  action: QuickActionType | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (action: QuickActionType, data: Record<string, unknown>) => void;
  context: TwentyEvent | null;
}

// ── Payment Link Modal ─────────────────────────────────────────────────

function PaymentLinkModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (data: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const validateAndSubmit = () => {
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) {
      setError("Please enter a valid amount greater than $0");
      return;
    }
    if (num > 50000) {
      setError("Amount cannot exceed $50,000");
      return;
    }
    setError("");
    onSubmit({
      amount: num,
      currency,
      description: description || `Payment of $${num.toFixed(2)}`,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="size-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
          <CreditCard className="size-4 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Send Payment Link</h2>
          <p className="text-[11px] text-white/40">
            Generate and send a secure NMI payment link
          </p>
        </div>
      </div>

      <div>
        <label className="text-[11px] font-medium text-white/60 block mb-1">
          Amount
        </label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-white/30" />
          <input
            type="number"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(""); }}
            placeholder="0.00"
            step="0.01"
            min="0.01"
            max="50000"
            className={cn(
              "w-full pl-8 pr-3 py-2 rounded-lg bg-white/[0.04] border text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-cyan-500/40 transition-colors",
              error ? "border-red-500/40" : "border-white/[0.08]"
            )}
          />
        </div>
        {error && (
          <p className="mt-1 text-[11px] text-red-400 flex items-center gap-1">
            <AlertTriangle className="size-3" />
            {error}
          </p>
        )}
      </div>

      <div>
        <label className="text-[11px] font-medium text-white/60 block mb-1">
          Currency
        </label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/60 outline-none focus:border-cyan-500/40"
        >
          {["USD", "EUR", "GBP", "CAD", "AUD"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[11px] font-medium text-white/60 block mb-1">
          Description (optional)
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this payment for?"
          maxLength={140}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-cyan-500/40 transition-colors"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={validateAndSubmit}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 transition-colors"
        >
          <Send className="size-3.5" />
          Generate Payment Link
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/60 hover:bg-white/[0.08] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── SMS Modal ──────────────────────────────────────────────────────────

function SmsModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (data: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [template, setTemplate] = useState("");
  const [message, setMessage] = useState("");
  const [charCount, setCharCount] = useState(0);

  // GHL templates (placeholder — would load from GHL connector in production)
  const templates = [
    { id: "payment-reminder", label: "Payment Reminder", preview: "Hi {name}, your payment of ${amount} is due on {date}..." },
    { id: "welcome", label: "Welcome Message", preview: "Welcome to NewLeaf Financial! Your account..." },
    { id: "follow-up", label: "Follow Up", preview: "Hi {name}, just checking in on your recent inquiry..." },
    { id: "appointment", label: "Appointment Reminder", preview: "Reminder: You have an appointment on {date}..." },
    { id: "custom", label: "Custom Message", preview: "" },
  ];

  const selectedTemplate = templates.find((t) => t.id === template);

  const handleMessageChange = (text: string) => {
    if (text.length <= 320) {
      setMessage(text);
      setCharCount(text.length);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="size-8 rounded-lg bg-green-500/10 flex items-center justify-center">
          <MessageCircle className="size-4 text-green-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Send SMS</h2>
          <p className="text-[11px] text-white/40">
            Send an SMS via GHL to the customer
          </p>
        </div>
      </div>

      <div>
        <label className="text-[11px] font-medium text-white/60 block mb-1">
          Phone Number
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1 (555) 123-4567"
          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-green-500/40 transition-colors"
        />
      </div>

      <div>
        <label className="text-[11px] font-medium text-white/60 block mb-1">
          GHL Template
        </label>
        <select
          value={template}
          onChange={(e) => {
            setTemplate(e.target.value);
            if (e.target.value === "custom") setMessage("");
          }}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/60 outline-none focus:border-green-500/40"
        >
          <option value="">Select a template...</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        {selectedTemplate?.preview && (
          <p className="mt-1.5 text-[10px] text-white/30 italic px-1">
            Preview: {selectedTemplate.preview}
          </p>
        )}
      </div>

      <div>
        <label className="text-[11px] font-medium text-white/60 block mb-1">
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => handleMessageChange(e.target.value)}
          placeholder="Type your SMS message..."
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-green-500/40 transition-colors resize-none"
        />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-white/20">{320 - charCount} chars remaining</span>
          <span className="text-[10px] text-white/20">{Math.ceil(charCount / 160)} segment{charCount > 160 ? "s" : ""}</span>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => onSubmit({ phone, template, message })}
          disabled={!phone || !message}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-40 transition-colors"
        >
          <Send className="size-3.5" />
          Send SMS
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/60 hover:bg-white/[0.08] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Add Note Modal ─────────────────────────────────────────────────────

function AddNoteModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (data: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const maxChars = 2000;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="size-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
          <StickyNote className="size-4 text-amber-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Add Note</h2>
          <p className="text-[11px] text-white/40">
            Quick note on the current customer record
          </p>
        </div>
      </div>

      <div>
        <label className="text-[11px] font-medium text-white/60 block mb-1">
          Title (optional)
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          maxLength={120}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-amber-500/40 transition-colors"
        />
      </div>

      <div>
        <label className="text-[11px] font-medium text-white/60 block mb-1">
          Note
        </label>
        <textarea
          value={note}
          onChange={(e) => {
            if (e.target.value.length <= maxChars) setNote(e.target.value);
          }}
          placeholder="Type your note here..."
          rows={5}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-amber-500/40 transition-colors resize-none"
        />
        <p className="mt-1 text-[10px] text-white/20 text-right">
          {note.length}/{maxChars}
        </p>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => onSubmit({ title, content: note })}
          disabled={!note.trim()}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-40 transition-colors"
        >
          <Save className="size-3.5" />
          Save Note
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/60 hover:bg-white/[0.08] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Create Ticket Modal ────────────────────────────────────────────────

function CreateTicketModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (data: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignee, setAssignee] = useState("");
  const [description, setDescription] = useState("");

  const priorities = [
    { value: "low", label: "Low", color: "text-white/40" },
    { value: "medium", label: "Medium", color: "text-amber-400" },
    { value: "high", label: "High", color: "text-orange-400" },
    { value: "urgent", label: "Urgent", color: "text-red-400" },
  ];

  // Placeholder assignees — would load from system in production
  const assignees = [
    { id: "agent-1", name: "Jerry Yirenkyi" },
    { id: "agent-2", name: "Abhi Swami" },
    { id: "unassigned", name: "Unassigned" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="size-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
          <Ticket className="size-4 text-purple-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Create Ticket</h2>
          <p className="text-[11px] text-white/40">
            Support ticket in Linear + Twenty
          </p>
        </div>
      </div>

      <div>
        <label className="text-[11px] font-medium text-white/60 block mb-1">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's the issue?"
          maxLength={200}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-purple-500/40 transition-colors"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-medium text-white/60 block mb-1">
            Priority
          </label>
          <div className="flex gap-1">
            {priorities.map((p) => (
              <button
                key={p.value}
                onClick={() => setPriority(p.value)}
                className={cn(
                  "flex-1 py-1.5 rounded text-[10px] font-medium border transition-colors",
                  priority === p.value
                    ? "bg-white/[0.08] border-white/20 " + p.color
                    : "bg-white/[0.02] border-white/[0.04] text-white/30 hover:border-white/10"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-medium text-white/60 block mb-1">
            Assignee
          </label>
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/60 outline-none focus:border-purple-500/40"
          >
            <option value="">Select assignee...</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-[11px] font-medium text-white/60 block mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue in detail..."
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-purple-500/40 transition-colors resize-none"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => onSubmit({ title, priority, assignee, description })}
          disabled={!title.trim()}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-40 transition-colors"
        >
          <Ticket className="size-3.5" />
          Create Ticket
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/60 hover:bg-white/[0.08] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Run Workflow Modal ─────────────────────────────────────────────────

const LIBRARY_WORKFLOWS = [
  {
    id: "payment-recovery",
    name: "Payment Recovery",
    description: "Automated soft-decline recovery flow with smart retry",
    category: "billing",
    avgDuration: "15 min",
  },
  {
    id: "credit-dispute",
    name: "Credit Dispute Resolution",
    description: "End-to-end dispute handling with bureau correspondence",
    category: "credit",
    avgDuration: "5-10 days",
  },
  {
    id: "enrollment-onboard",
    name: "Customer Onboarding",
    description: "Welcome sequence + document collection + first payment",
    category: "enrollment",
    avgDuration: "1-2 hours",
  },
  {
    id: "subscription-sync",
    name: "Subscription Sync",
    description: "Sync NMI subscriptions with Twenty CRM and billing records",
    category: "billing",
    avgDuration: "5 min",
  },
  {
    id: "slack-summary",
    name: "Morning Pulse Report",
    description: "Daily summary of enrollments, payments, and disputes",
    category: "reporting",
    avgDuration: "2 min",
  },
];

function RunWorkflowModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (data: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = LIBRARY_WORKFLOWS.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.description.toLowerCase().includes(search.toLowerCase()) ||
      w.category.toLowerCase().includes(search.toLowerCase())
  );

  const selectedWorkflow = LIBRARY_WORKFLOWS.find((w) => w.id === selected);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
          <Zap className="size-4 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Run Workflow</h2>
          <p className="text-[11px] text-white/40">
            Select and execute an automated workflow
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-white/30" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search workflows..."
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-emerald-500/40 transition-colors"
        />
      </div>

      <div className="max-h-48 overflow-y-auto space-y-1">
        {filtered.length === 0 ? (
          <p className="text-center text-[11px] text-white/30 py-4">
            No workflows found
          </p>
        ) : (
          filtered.map((w) => (
            <button
              key={w.id}
              onClick={() => setSelected(w.id === selected ? null : w.id)}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-colors",
                selected === w.id
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-white/80">
                  {w.name}
                </span>
                <span className="text-[9px] text-white/30 uppercase tracking-wider">
                  {w.category}
                </span>
              </div>
              <p className="text-[10px] text-white/40 mt-0.5">
                {w.description}
              </p>
              <p className="text-[9px] text-white/20 mt-1">
                ~{w.avgDuration}
              </p>
            </button>
          ))
        )}
      </div>

      {selectedWorkflow && (
        <div className="p-3 rounded-lg bg-emerald-500/[0.04] border border-emerald-500/15">
          <p className="text-[10px] text-emerald-400/80 font-medium">Ready to run:</p>
          <p className="text-[12px] text-white/80 mt-0.5">{selectedWorkflow.name}</p>
          <p className="text-[10px] text-white/40 mt-0.5">{selectedWorkflow.description}</p>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => selected && onSubmit({ workflowId: selected, workflow: selectedWorkflow })}
          disabled={!selected}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-40 transition-colors"
        >
          <Play className="size-3.5" />
          Execute Workflow
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/60 hover:bg-white/[0.08] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Shell Modal ────────────────────────────────────────────────────────

export function QuickActionModals({
  action,
  open,
  onClose,
  onSubmit,
  context,
}: QuickActionModalsProps) {
  const actionLabels: Record<QuickActionType, string> = {
    "send-payment": "Send Payment Link",
    "send-sms": "Send SMS",
    "add-note": "Add Note",
    "create-ticket": "Create Ticket",
    "run-workflow": "Run Workflow",
  };

  return (
    <AnimatePresence>
      {open && action && (
        <>
          {/* Backdrop */}
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal-panel"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed left-1/2 top-1/2 z-[70] w-full max-w-[420px] -translate-x-1/2 -translate-y-1/2"
          >
            <div className="rounded-xl border border-white/[0.08] bg-[#0a0a0f] shadow-[0_16px_64px_rgba(0,0,0,0.4)] backdrop-blur-xl p-5">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute right-4 top-4 p-1 rounded-md hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors"
              >
                <X className="size-4" />
              </button>

              {/* Render the right form */}
              {action === "send-payment" && (
                <PaymentLinkModal
                  onSubmit={(data) => onSubmit("send-payment", data)}
                  onClose={onClose}
                />
              )}
              {action === "send-sms" && (
                <SmsModal
                  onSubmit={(data) => onSubmit("send-sms", data)}
                  onClose={onClose}
                />
              )}
              {action === "add-note" && (
                <AddNoteModal
                  onSubmit={(data) => onSubmit("add-note", data)}
                  onClose={onClose}
                />
              )}
              {action === "create-ticket" && (
                <CreateTicketModal
                  onSubmit={(data) => onSubmit("create-ticket", data)}
                  onClose={onClose}
                />
              )}
              {action === "run-workflow" && (
                <RunWorkflowModal
                  onSubmit={(data) => onSubmit("run-workflow", data)}
                  onClose={onClose}
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default QuickActionModals;
