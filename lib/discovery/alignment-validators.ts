/**
 * lib/discovery/alignment-validators.ts
 * Phase 38 Stream 2 — Four Alignment Validators
 *
 * 1. validateBillingAlignment: Slack says X about billing ↔ NMI subscription state ↔ Base44 billingStatus
 * 2. validateEnrollmentAlignment: Slack says "enrolled" ↔ Base44 enrollmentStatus
 * 3. validateAgentPromiseAlignment: Agent promised action ↔ Was action completed?
 * 4. validateDocumentationAlignment: Customer name/phone in Slack ↔ Base44 profile ↔ NMI vault
 *
 * Each validator returns a scored AlignmentResult (0.0–1.0).
 */

import type {
  CustomerDiscoveryContext,
  AlignmentResult,
  AlignmentDetail,
} from "./types";

// ── Validator 1: Billing Alignment ───────────────────────────────

export function validateBillingAlignment(
  ctx: CustomerDiscoveryContext
): AlignmentResult {
  const details: AlignmentDetail[] = [];
  let score = 1.0;

  // Check 1: Base44 billingStatus vs NMI subscriptionStatus
  const base44Status = ctx.base44.billingStatus?.toLowerCase() || 'unknown';
  const nmiStatus = ctx.nmi.subscriptionStatus;

  if (base44Status === 'active' && nmiStatus === 'active') {
    details.push({
      field: 'billing_status',
      expected: 'active',
      actual: 'active (both)',
      source: 'base44+nmi',
      discrepancy: '',
    });
  } else if (base44Status === 'cancelled' && nmiStatus === 'active') {
    // CRITICAL: CRM says cancelled but NMI still charging
    details.push({
      field: 'billing_status',
      expected: 'cancelled (per Base44)',
      actual: 'active (NMI still charging)',
      source: 'base44',
      discrepancy: 'CRM shows cancelled but NMI subscription still active. Customer may still be getting charged.',
    });
    score -= 0.5;
  } else if (base44Status === 'cancelled' && nmiStatus === 'cancelled') {
    details.push({
      field: 'billing_status',
      expected: 'cancelled',
      actual: 'cancelled (both)',
      source: 'base44+nmi',
      discrepancy: '',
    });
  } else if (base44Status === 'declining' && nmiStatus === 'declining') {
    details.push({
      field: 'billing_status',
      expected: 'declining',
      actual: 'declining (both)',
      source: 'base44+nmi',
      discrepancy: '',
    });
  } else if (base44Status === 'active' && nmiStatus === 'none') {
    details.push({
      field: 'billing_status',
      expected: 'active subscription',
      actual: 'no NMI subscription found',
      source: 'nmi',
      discrepancy: 'Customer enrolled but no NMI subscription exists.',
    });
    score -= 0.3;
  } else if (nmiStatus === 'error') {
    details.push({
      field: 'billing_status',
      expected: 'any',
      actual: 'NMI query error',
      source: 'nmi',
      discrepancy: `NMI error: ${ctx.nmi.subscriptionId ? ctx.nmi.subscriptionId : 'query failed'}`,
    });
    score -= 0.2;
  }

  // Check 2: Slack inferred action vs actual billing state
  const slackAction = ctx.slack.inferredActionRequested?.toLowerCase() || '';
  if (
    slackAction.includes('cancel') &&
    nmiStatus === 'active' &&
    base44Status !== 'cancelled'
  ) {
    details.push({
      field: 'slack_vs_billing',
      expected: 'Cancelled (per Slack request)',
      actual: `Active (NMI: ${nmiStatus}, Base44: ${base44Status})`,
      source: 'slack',
      discrepancy: 'Customer requested cancellation in Slack but subscription is still active.',
    });
    score -= 0.4;
  }

  // Check 3: COF compliance
  if (!ctx.nmi.cofCompliant && nmiStatus === 'active') {
    details.push({
      field: 'cof_compliance',
      expected: 'COF compliant',
      actual: 'Not COF compliant',
      source: 'nmi',
      discrepancy: 'Active subscription not flagged as COF compliant.',
    });
    score -= 0.1;
  }

  // Determine overall status
  let status: AlignmentResult['status'];
  let priority: AlignmentResult['priority'];

  if (score >= 0.9) {
    status = 'aligned';
    priority = 'low';
  } else if (score >= 0.7) {
    status = 'aligned';
    priority = 'medium';
  } else if (score >= 0.4) {
    status = 'misaligned';
    priority = 'high';
  } else {
    status = 'misaligned';
    priority = 'critical';
  }

  const recommendation = generateBillingRecommendation(ctx, details, score);

  return {
    dimension: 'billing',
    status,
    score: Math.max(0, score),
    details,
    recommendation,
    priority,
  };
}

// ── Validator 2: Enrollment Alignment ────────────────────────────

export function validateEnrollmentAlignment(
  ctx: CustomerDiscoveryContext
): AlignmentResult {
  const details: AlignmentDetail[] = [];
  let score = 1.0;

  const base44Enrollment = ctx.base44.enrollmentStatus?.toLowerCase() || 'unknown';
  const hasSlackActivity = ctx.slack.mentions.length > 0;
  const slackAction = ctx.slack.inferredActionRequested?.toLowerCase() || '';

  // Check: Slack suggests enrollment but Base44 says not enrolled
  if (slackAction.includes('enroll') && base44Enrollment === 'unknown') {
    details.push({
      field: 'enrollment_status',
      expected: 'Enrolled (per Slack submission)',
      actual: 'Unknown (Base44)',
      source: 'slack',
      discrepancy: 'Enrollment mentioned in Slack but no Base44 record found.',
    });
    score -= 0.5;
  }

  // Check: Base44 shows inactive but has active payment
  if (
    (base44Enrollment === 'inactive' || base44Enrollment === 'cancelled') &&
    ctx.nmi.subscriptionStatus === 'active'
  ) {
    details.push({
      field: 'enrollment_vs_billing',
      expected: 'Inactive enrollment → no billing',
      actual: 'Active NMI subscription despite inactive enrollment',
      source: 'base44',
      discrepancy: 'Customer marked inactive/cancelled but subscription still billing.',
    });
    score -= 0.4;
  }

  // Check: Base44 says active but no NMI subscription
  if (base44Enrollment === 'active' && ctx.nmi.subscriptionStatus === 'none') {
    details.push({
      field: 'enrollment_vs_billing',
      expected: 'Active enrollment → active subscription',
      actual: 'No NMI subscription for active customer',
      source: 'nmi',
      discrepancy: 'Customer marked active but has no billing subscription.',
    });
    score -= 0.3;
  }

  // Check: Empty profile
  if (!ctx.base44.profile) {
    details.push({
      field: 'profile',
      expected: 'Customer profile exists',
      actual: 'No profile found',
      source: 'base44',
      discrepancy: 'No Base44 customer profile exists.',
    });
    score -= 0.3;
  }

  let status: AlignmentResult['status'];
  let priority: AlignmentResult['priority'];

  if (score >= 0.9) {
    status = 'aligned';
    priority = 'low';
  } else if (score >= 0.7) {
    status = 'aligned';
    priority = 'medium';
  } else if (score >= 0.4) {
    status = 'misaligned';
    priority = 'high';
  } else {
    status = 'misaligned';
    priority = 'critical';
  }

  const recommendation = score < 0.7
    ? 'Review enrollment status. Possible data inconsistency between CRM and billing.'
    : 'Enrollment appears correctly aligned.';

  return {
    dimension: 'enrollment',
    status,
    score: Math.max(0, score),
    details,
    recommendation,
    priority,
  };
}

// ── Validator 3: Agent Promise Alignment ─────────────────────────

export function validateAgentPromiseAlignment(
  ctx: CustomerDiscoveryContext
): AlignmentResult {
  const details: AlignmentDetail[] = [];
  let score = 1.0;
  let promisesMade = 0;
  let promisesKept = 0;

  for (const msg of ctx.slack.mentions) {
    const text = msg.text;

    // Detect promises
    if (
      /(I'?ll|I\s*will|let\s*me)\s*(call|follow\s*up|reach\s*out|get\s*back|check|look\s*into|handle|take\s*care)/i.test(
        text
      )
    ) {
      promisesMade++;

      // Check if promise was fulfilled:
      // 1. Was there a follow-up call?
      const hasFollowUpCall = ctx.base44.recentCalls.some(
        (call) => {
          const c = call as Record<string, unknown>;
          return (
            c.createdAt &&
            new Date(c.createdAt as string).getTime() > parseFloat(msg.ts) * 1000
          );
        }
      );

      // 2. Was the ticket resolved?
      const relatedTicketResolved = ctx.base44.openTickets.length === 0;

      if (hasFollowUpCall || relatedTicketResolved) {
        promisesKept++;
      } else {
        details.push({
          field: 'promise_fulfillment',
          expected: 'Follow-up action completed',
          actual: 'No evidence of follow-up',
          source: 'slack',
          discrepancy: `Agent promised action "${text.slice(0, 100)}" but no follow-up call or ticket resolution found.`,
        });
        score -= 0.25 / promisesMade;
      }
    }
  }

  // Check stale tickets
  const staleCount = ctx.base44.openTickets.filter((t) => {
    const ticket = t as Record<string, unknown>;
    const updatedAt = ticket.updatedAt
      ? new Date(ticket.updatedAt as string).getTime()
      : new Date(ticket.createdAt as string).getTime();
    return Date.now() - updatedAt > 48 * 60 * 60 * 1000;
  }).length;

  if (staleCount > 0) {
    details.push({
      field: 'stale_tickets',
      expected: '0 stale tickets',
      actual: `${staleCount} stale ticket(s)`,
      source: 'base44',
      discrepancy: `${staleCount} ticket(s) have not been updated in 48+ hours.`,
    });
    score -= 0.15 * staleCount;
  }

  let status: AlignmentResult['status'];
  let priority: AlignmentResult['priority'];

  if (score >= 0.9) {
    status = 'aligned';
    priority = 'low';
  } else if (score >= 0.7) {
    status = 'misaligned';
    priority = 'medium';
  } else if (score >= 0.4) {
    status = 'misaligned';
    priority = 'high';
  } else {
    status = 'misaligned';
    priority = 'critical';
  }

  const recommendation =
    promisesMade > 0 && promisesKept < promisesMade
      ? `${promisesMade - promisesKept} agent promise(s) unfulfilled. Follow up with responsible agents.`
      : staleCount > 0
        ? `${staleCount} stale ticket(s) need attention.`
        : 'Agent promises appear fulfilled.';

  return {
    dimension: 'agent_promise',
    status,
    score: Math.max(0, score),
    details,
    recommendation,
    priority,
  };
}

// ── Validator 4: Documentation Alignment ─────────────────────────

export function validateDocumentationAlignment(
  ctx: CustomerDiscoveryContext
): AlignmentResult {
  const details: AlignmentDetail[] = [];
  let score = 1.0;

  // Check: Name consistency
  if (ctx.slack.mentions.length > 0 && ctx.base44.profile) {
    const profileName = [ctx.base44.profile.firstName, ctx.base44.profile.lastName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (ctx.name && profileName) {
      const slackName = ctx.name.toLowerCase();
      if (slackName !== profileName) {
        details.push({
          field: 'customer_name',
          expected: profileName,
          actual: slackName,
          source: 'slack',
          discrepancy: `Name mismatch: Slack mentions "${slackName}" but CRM has "${profileName}".`,
        });
        score -= 0.2;
      }
    }
  }

  // Check: Phone consistency
  const slackPhones = ctx.slack.mentions
    .flatMap((m) => m.extractedCustomers.filter((c) => c.type === 'phone'))
    .map((c) => c.value);

  const profilePhone = ctx.phone?.replace(/\D/g, '');
  if (slackPhones.length > 0 && profilePhone) {
    const slackPhoneDigits = slackPhones[0].replace(/\D/g, '');
    if (!profilePhone.includes(slackPhoneDigits) && !slackPhoneDigits.includes(profilePhone)) {
      details.push({
        field: 'phone',
        expected: profilePhone,
        actual: slackPhones[0],
        source: 'slack',
        discrepancy: `Phone mismatch between Slack and CRM.`,
      });
      score -= 0.3;
    }
  }

  // Check: Email consistency
  const slackEmails = ctx.slack.mentions
    .flatMap((m) => m.extractedCustomers.filter((c) => c.type === 'email'))
    .map((c) => c.value);

  if (slackEmails.length > 0 && ctx.email) {
    if (!slackEmails.some((e) => e.toLowerCase() === ctx.email.toLowerCase())) {
      details.push({
        field: 'email',
        expected: ctx.email,
        actual: slackEmails[0],
        source: 'slack',
        discrepancy: `Email mismatch between Slack and CRM.`,
      });
      score -= 0.3;
    }
  }

  // Check: Missing contact info
  if (!ctx.phone && !ctx.email) {
    details.push({
      field: 'contact_info',
      expected: 'Phone or email in profile',
      actual: 'Neither phone nor email',
      source: 'base44',
      discrepancy: 'Customer profile missing contact information.',
    });
    score -= 0.2;
  }

  let status: AlignmentResult['status'];
  let priority: AlignmentResult['priority'];

  if (score >= 0.9) {
    status = 'aligned';
    priority = 'low';
  } else if (score >= 0.7) {
    status = 'misaligned';
    priority = 'medium';
  } else if (score >= 0.4) {
    status = 'misaligned';
    priority = 'high';
  } else {
    status = 'misaligned';
    priority = 'medium';
  }

  const recommendation =
    details.length > 0
      ? `${details.length} documentation discrepancy(s) found. Update CRM profile to match Slack data.`
      : 'Documentation appears consistent across systems.';

  return {
    dimension: 'documentation',
    status,
    score: Math.max(0, score),
    details,
    recommendation,
    priority,
  };
}

// ── Run All Validators ───────────────────────────────────────────

export function validateAll(
  ctx: CustomerDiscoveryContext
): AlignmentResult[] {
  return [
    validateBillingAlignment(ctx),
    validateEnrollmentAlignment(ctx),
    validateAgentPromiseAlignment(ctx),
    validateDocumentationAlignment(ctx),
  ];
}

export function summarizeValidations(
  results: AlignmentResult[]
): {
  aligned: number;
  misaligned: number;
  unknown: number;
  error: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  averageScore: number;
} {
  const summary = {
    aligned: 0,
    misaligned: 0,
    unknown: 0,
    error: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    averageScore: 0,
  };

  for (const r of results) {
    switch (r.status) {
      case 'aligned':
        summary.aligned++;
        break;
      case 'misaligned':
        summary.misaligned++;
        break;
      case 'unknown':
        summary.unknown++;
        break;
      case 'error':
        summary.error++;
        break;
    }
    switch (r.priority) {
      case 'critical':
        summary.criticalCount++;
        break;
      case 'high':
        summary.highCount++;
        break;
      case 'medium':
        summary.mediumCount++;
        break;
      case 'low':
        summary.lowCount++;
        break;
    }
    summary.averageScore += r.score;
  }

  summary.averageScore =
    results.length > 0 ? summary.averageScore / results.length : 0;

  return summary;
}

// ── Helpers ──────────────────────────────────────────────────────

function generateBillingRecommendation(
  _ctx: CustomerDiscoveryContext,
  details: AlignmentDetail[],
  score: number
): string {
  if (score >= 0.9) return 'Billing appears correctly aligned. No action needed.';
  if (score >= 0.7) return 'Minor billing discrepancies detected. Review and update CRM or NMI as needed.';
  if (score >= 0.4) {
    const billingDetails = details.filter((d) => d.field === 'billing_status' || d.field === 'slack_vs_billing');
    if (billingDetails.length > 0) {
      return `Significant billing misalignment: ${billingDetails[0].discrepancy}`;
    }
    return 'Significant billing discrepancies found. Cross-reference and reconcile CRM with NMI.';
  }
  return 'CRITICAL billing misalignment. Immediate action required — possible unauthorized charges.';
}
