/**
 * route-intent.ts — Intent matching logic for playbook-skills meta-skill.
 *
 * Parses user input against the PLAYBOOK-ROUTER.md intent table (98+ routes)
 * and returns the best-matching playbook path + confidence score.
 *
 * Fractal pattern: This function lives inside the playbook-skills meta-skill,
 * serving the same role that PLAYBOOK-ROUTER.md serves for the entire library.
 */

export interface IntentMatch {
  /** Canonical playbook path (e.g., playbook-skills/playbooks/playbook-billing.md) */
  playbookPath: string;
  /** Friendly domain name */
  domain: string;
  /** Priority tier (P0/P1/P2) */
  priority: "P0" | "P1" | "P2" | "META";
  /** Match confidence 0.0–1.0 */
  confidence: number;
  /** Which trigger keywords matched */
  matchedTriggers: string[];
  /** Intent route number (from router table) */
  routeNumber: number;
}

interface IntentRoute {
  number: number;
  intent: string;
  triggers: RegExp[];
  playbookPath: string;
  domain: string;
  priority: "P0" | "P1" | "P2" | "META";
}

// ── Intent Route Table (mirrors PLAYBOOK-ROUTER.md) ─────────────────────

const INTENT_ROUTES: IntentRoute[] = [
  // P0: BILLING
  { number: 1, intent: "charge_customer", triggers: [/charge|bill|payment|collect|run\s*card|process|transaction/i], playbookPath: "playbook-skills/playbooks/billing/playbook-billing.md", domain: "billing", priority: "P0" },
  { number: 2, intent: "refund_customer", triggers: [/refund|return\s*money|reverse\s*charge|give\s*back/i], playbookPath: "playbook-skills/playbooks/billing/playbook-billing.md", domain: "billing", priority: "P0" },
  { number: 3, intent: "check_payment", triggers: [/payment\s*status|did\s*payment|charge\s*status|txn\s*lookup|verify\s*payment/i], playbookPath: "playbook-skills/playbooks/billing/playbook-billing.md", domain: "billing", priority: "P0" },
  { number: 4, intent: "recover_decline", triggers: [/decline|failed|insufficient\s*funds|do\s*not\s*honor|card\s*declined/i], playbookPath: "playbook-skills/playbooks/billing/playbook-billing.md", domain: "billing", priority: "P0" },
  { number: 5, intent: "billing_link", triggers: [/billing\s*link|pay\s*now|update\s*card|new\s*payment|Collect\.js/i], playbookPath: "playbook-skills/playbooks/billing/playbook-billing.md", domain: "billing", priority: "P0" },
  { number: 6, intent: "subscriptions", triggers: [/subscription|recurring|cancel\s*sub|pause|resume|next\s*charge/i], playbookPath: "playbook-skills/playbooks/billing/playbook-billing.md", domain: "billing", priority: "P0" },
  { number: 7, intent: "vault_health", triggers: [/vault\s*check|CoF\s*health|card\s*on\s*file|vault\s*audit|vanished\s*vault/i], playbookPath: "playbook-skills/playbooks/billing/playbook-billing.md", domain: "billing", priority: "P0" },
  { number: 8, intent: "billing_chain", triggers: [/broken\s*chain|orphan\s*sub|ghost\s*CRM|billing\s*recon|missing\s*sub/i], playbookPath: "playbook-skills/playbooks/billing/playbook-billing.md", domain: "billing", priority: "P0" },

  // P0: SUPPORT
  { number: 13, intent: "customer_360", triggers: [/customer\s*360|look\s*up|who\s*is|check\s*on|pull\s*up|find\s*customer|account/i], playbookPath: "playbook-skills/playbooks/customer-support/playbook-support.md", domain: "support", priority: "P0" },
  { number: 14, intent: "create_ticket", triggers: [/ticket|create\s*ticket|open\s*issue|support\s*request|help\s*ticket/i], playbookPath: "playbook-skills/playbooks/customer-support/playbook-support.md", domain: "support", priority: "P0" },
  { number: 15, intent: "triage_ticket", triggers: [/triage|classify|route|assign|priority|sla/i], playbookPath: "playbook-skills/playbooks/customer-support/playbook-support.md", domain: "support", priority: "P0" },

  // P0: DISPUTES
  { number: 20, intent: "start_dispute", triggers: [/dispute|challenge|remove\s*from\s*credit|fix\s*credit|delete\s*item/i], playbookPath: "playbook-skills/playbooks/disputes/playbook-disputes.md", domain: "disputes", priority: "P0" },
  { number: 21, intent: "track_dispute", triggers: [/dispute\s*status|bureau\s*response|what\s*happened\s*with|responded/i], playbookPath: "playbook-skills/playbooks/disputes/playbook-disputes.md", domain: "disputes", priority: "P0" },
  { number: 22, intent: "dispute_letter", triggers: [/draft\s*letter|write\s*dispute|bureau\s*letter|fcra\s*letter/i], playbookPath: "playbook-skills/playbooks/disputes/playbook-disputes.md", domain: "disputes", priority: "P0" },

  // P0: PLANNING
  { number: 26, intent: "write_prd", triggers: [/write\s*prd|create\s*prd|product\s*requirement|spec\s*out|document\s*requirements|prd\s*for|feature\s*spec/i], playbookPath: "playbook-skills/playbooks/planning/playbook-planning.md", domain: "planning", priority: "P0" },
  { number: 27, intent: "draft_trd", triggers: [/draft\s*trd|write\s*trd|technical\s*design|architecture\s*doc|design\s*document|system\s*design/i], playbookPath: "playbook-skills/playbooks/planning/playbook-planning.md", domain: "planning", priority: "P0" },
  { number: 28, intent: "impl_plan", triggers: [/implementation\s*plan|impl\s*plan|build\s*plan|execution\s*plan|sprint\s*plan|phase\s*plan/i], playbookPath: "playbook-skills/playbooks/planning/playbook-planning.md", domain: "planning", priority: "P0" },
  { number: 29, intent: "deep_research", triggers: [/research|investigate|explore|compare|state\s*of|deep\s*dive|background\s*on|survey/i], playbookPath: "playbook-skills/playbooks/planning/playbook-planning.md", domain: "planning", priority: "P0" },
  { number: 30, intent: "gap_analysis", triggers: [/gap\s*analysis|gap|what\s*is\s*missing|audit|compare\s*current|delta|discrepancy/i], playbookPath: "playbook-skills/playbooks/planning/playbook-planning.md", domain: "planning", priority: "P0" },

  // P1: ENGINEERING
  { number: 33, intent: "code_review", triggers: [/review|code\s*review|audit\s*code|look\s*at\s*this\s*code/i], playbookPath: "playbook-skills/playbooks/engineering/playbook-engineering.md", domain: "engineering", priority: "P1" },
  { number: 35, intent: "refactor", triggers: [/refactor|clean\s*up|improve|restructure|reorganize/i], playbookPath: "playbook-skills/playbooks/engineering/playbook-engineering.md", domain: "engineering", priority: "P1" },
  { number: 36, intent: "debug", triggers: [/debug|bug|error|not\s*working|broken|crash|why\s*is/i], playbookPath: "playbook-skills/playbooks/engineering/playbook-engineering.md", domain: "engineering", priority: "P1" },
  { number: 37, intent: "build_feature", triggers: [/build|create|implement|add|make|new\s*feature/i], playbookPath: "playbook-skills/playbooks/engineering/playbook-engineering.md", domain: "engineering", priority: "P1" },

  // P1: DEPLOY
  { number: 41, intent: "ship", triggers: [/ship|deploy|land|merge|release|push\s*to\s*prod/i], playbookPath: "playbook-skills/playbooks/deploy/playbook-deploy.md", domain: "deploy", priority: "P1" },
  { number: 42, intent: "create_pr", triggers: [/pr|pull\s*request|open\s*pr|create\s*pr|merge\s*request/i], playbookPath: "playbook-skills/playbooks/deploy/playbook-deploy.md", domain: "deploy", priority: "P1" },

  // P1: REPORTING
  { number: 45, intent: "morning_pulse", triggers: [/morning\s*pulse|daily\s*report|today\s*summary|overview/i], playbookPath: "playbook-skills/playbooks/reporting/playbook-reporting.md", domain: "reporting", priority: "P1" },
  { number: 46, intent: "metrics", triggers: [/how\s*many|customers|mrr|revenue|churn|growth|metrics|analytics|stats/i], playbookPath: "playbook-skills/playbooks/reporting/playbook-reporting.md", domain: "reporting", priority: "P1" },

  // P1: VPS
  { number: 52, intent: "vps_health", triggers: [/vps\s*health|server\s*status|system\s*check|cpu|memory|disk/i], playbookPath: "playbook-skills/playbooks/vps-ops/playbook-vps-ops.md", domain: "vps-ops", priority: "P1" },
  { number: 53, intent: "vps_incident", triggers: [/vps\s*down|server\s*crashed|outage|offline|not\s*responding/i], playbookPath: "playbook-skills/playbooks/vps-ops/playbook-vps-ops.md", domain: "vps-ops", priority: "P1" },

  // P2: MARKETING
  { number: 57, intent: "campaign", triggers: [/campaign|dialer|outbound|call\s*campaign|auto\s*dialer/i], playbookPath: "playbook-skills/playbooks/marketing/playbook-marketing.md", domain: "marketing", priority: "P2" },
  { number: 58, intent: "nurture", triggers: [/nurture|sequence|follow\s*up|drip|sms\s*sequence/i], playbookPath: "playbook-skills/playbooks/marketing/playbook-marketing.md", domain: "marketing", priority: "P2" },

  // P2: HR
  { number: 63, intent: "team_status", triggers: [/team|who\s*is\s*working|agent\s*availability|staffing/i], playbookPath: "playbook-skills/playbooks/hr/playbook-hr.md", domain: "hr", priority: "P2" },

  // NEW: SALES (Phase 21 V3)
  { number: 83, intent: "sales_pipeline", triggers: [/sales|pipeline|deal|opportunity|lead\s*flow|conversion|prospect/i], playbookPath: "playbook-skills/playbooks/sales/playbook-sales.md", domain: "sales", priority: "P2" },

  // NEW: VIDEO GENERATION (Phase 21 V3)
  { number: 84, intent: "video_gen", triggers: [/video|generate\s*video|create\s*video|ai\s*video|edit\s*video|reel|clip/i], playbookPath: "playbook-skills/playbooks/video-generation/playbook-video-generation.md", domain: "video-generation", priority: "P2" },

  // META: Fallback to 'other' (orphan catcher)
  { number: 82, intent: "fallback_other", triggers: [/fun|random|utility|misc|experimental|try\s*this|random\s*fact|general|other|unknown|unclassified/i], playbookPath: "playbook-skills/playbooks/other/playbook-other.md", domain: "other", priority: "P2" },

  // META: Index fallback
  { number: 99, intent: "list_playbooks", triggers: [/what\s*playbooks|list\s*domains|capabilities|what\s*can\s*you\s*do|help|how\s*to\s*use/i], playbookPath: "playbook-skills/playbooks/playbook-index.md", domain: "index", priority: "META" },
];

// ── Core Router ──────────────────────────────────────────────────────────

/**
 * Route a user's message to the best-matching playbook.
 * Returns the top match with confidence score, or the index fallback.
 */
export function routeIntent(userMessage: string): IntentMatch {
  const normalized = userMessage.toLowerCase().trim();
  let bestMatch: IntentMatch | null = null;
  let bestScore = 0;

  for (const route of INTENT_ROUTES) {
    const matchedTriggers: string[] = [];
    let totalMatches = 0;

    for (const trigger of route.triggers) {
      if (trigger.test(normalized)) {
        matchedTriggers.push(trigger.source);
        totalMatches++;
      }
    }

    if (totalMatches > 0) {
      // Score: trigger matches weighted, priority bonus
      const priorityBonus = route.priority === "P0" ? 0.3 : route.priority === "P1" ? 0.15 : 0;
      const triggerRatio = totalMatches / route.triggers.length;
      const score = triggerRatio + priorityBonus;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          playbookPath: route.playbookPath,
          domain: route.domain,
          priority: route.priority,
          confidence: Math.min(score, 1.0),
          matchedTriggers,
          routeNumber: route.number,
        };
      }
    }
  }

  // Fallback to 'other' (orphan catcher), then index for discovery
  if (!bestMatch) {
    bestMatch = {
      playbookPath: "playbook-skills/playbooks/other/playbook-other.md",
      domain: "other",
      priority: "P2",
      confidence: 0.1,
      matchedTriggers: [],
      routeNumber: 82,
    };
  }

  return bestMatch;
}

/**
 * Get all available intent routes (for diagnostics).
 */
export function getAllIntentRoutes(): IntentRoute[] {
  return [...INTENT_ROUTES];
}

/**
 * Find a route by number.
 */
export function getRouteByNumber(number: number): IntentRoute | undefined {
  return INTENT_ROUTES.find((r) => r.number === number);
}

export default routeIntent;
