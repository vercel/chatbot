/**
 * lib/discovery/customer-matcher.ts
 * Phase 38 Stream 0 — 5-Tier Customer Matching Algorithm
 *
 * Tier 1: Exact phone match (highest confidence)
 * Tier 2: Exact email match
 * Tier 3: Name + phone fuzzy match (Levenshtein < 3)
 * Tier 4: Name + email fuzzy match
 * Tier 5: Name-only match (lowest confidence)
 */

import type { ExtractedCustomerMention, CustomerMatch } from "./types";

// ── Phone Number Regex ───────────────────────────────────────────

const PHONE_REGEX = /(\+?1[-\s.]?)?\(?\d{3}\)?[-\s.]?\d{3}[-\s.]?\d{4}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Common name patterns: "John Smith", "Smith, John", "@John Smith"
const NAME_PATTERN = /(?:^|\s|@)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})(?:\s|$|,|\.)/g;

// Customer ID pattern: "cust_xxx" or "CUS-xxx" or "#12345"
const CUSTOMER_ID_PATTERN = /(?:cust[_\-\s]?|CUS[_\-\s]?|#)\w{4,}/gi;

// ── Extraction ───────────────────────────────────────────────────

export function extractCustomerMentions(text: string): ExtractedCustomerMention[] {
  const mentions: ExtractedCustomerMention[] = [];

  // Phones
  const phones = text.match(PHONE_REGEX) || [];
  for (const phone of phones) {
    mentions.push({
      raw: phone,
      type: 'phone',
      value: normalizePhone(phone),
      confidence: 0.9,
    });
  }

  // Emails
  const emails = text.match(EMAIL_REGEX) || [];
  for (const email of emails) {
    mentions.push({
      raw: email,
      type: 'email',
      value: email.toLowerCase(),
      confidence: 0.85,
    });
  }

  // Customer IDs
  const custIds = text.match(CUSTOMER_ID_PATTERN) || [];
  for (const id of custIds) {
    mentions.push({
      raw: id,
      type: 'customer_id',
      value: id.replace(/^#/, ''),
      confidence: 0.75,
    });
  }

  // Names (lower confidence — many false positives)
  const names = text.match(NAME_PATTERN) || [];
  for (const name of names) {
    const cleaned = name.replace(/^[@\s]+/, '').replace(/[\s,.]$/, '').trim();
    if (cleaned.length >= 5 && !cleaned.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)$/i)) {
      mentions.push({
        raw: cleaned,
        type: 'name',
        value: cleaned,
        confidence: 0.5,
      });
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return mentions.filter((m) => {
    const key = `${m.type}:${m.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

// ── Levenshtein Distance ─────────────────────────────────────────

export function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return matrix[a.length][b.length];
}

// ── Name Fuzzy Match ─────────────────────────────────────────────

export function fuzzyNameMatch(
  extractedName: string,
  profileName: string
): number {
  // Normalize both
  const a = extractedName.toLowerCase().trim();
  const b = profileName.toLowerCase().trim();

  // Exact match
  if (a === b) return 1.0;

  // Contains match
  if (a.includes(b) || b.includes(a)) return 0.85;

  // First + last swap
  const aParts = a.split(/\s+/);
  const bParts = b.split(/\s+/);
  if (aParts.length >= 2 && bParts.length >= 2) {
    const aFirst = aParts[0];
    const aLast = aParts[aParts.length - 1];
    const bFirst = bParts[0];
    const bLast = bParts[bParts.length - 1];

    const firstMatch = levenshtein(aFirst, bFirst) <= 2;
    const lastMatch = levenshtein(aLast, bLast) <= 2;

    if (firstMatch && lastMatch) return 0.9;
    if (firstMatch || lastMatch) return 0.6;
  }

  // Levenshtein-based
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  const similarity = 1 - dist / maxLen;

  if (similarity > 0.9) return 0.7;
  if (similarity > 0.7) return 0.5;
  return 0;
}

// ── 5-Tier Matching Algorithm ────────────────────────────────────

export interface CustomerProfileRecord {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

export function matchCustomer(
  mention: ExtractedCustomerMention,
  profiles: CustomerProfileRecord[]
): CustomerMatch {
  const candidates: string[] = [];

  // Tier 1: Exact phone match
  if (mention.type === 'phone') {
    const normalized = mention.value;
    for (const profile of profiles) {
      if (profile.phone && normalizePhone(profile.phone) === normalized) {
        return {
          base44Id: profile.id,
          confidence: 0.98,
          matchTier: 1,
          matchedOn: `phone:${normalized}`,
          candidates: [],
        };
      }
      if (profile.phone) candidates.push(profile.id);
    }
  }

  // Tier 2: Exact email match
  if (mention.type === 'email') {
    const email = mention.value.toLowerCase();
    for (const profile of profiles) {
      if (profile.email && profile.email.toLowerCase() === email) {
        return {
          base44Id: profile.id,
          confidence: 0.95,
          matchTier: 2,
          matchedOn: `email:${email}`,
          candidates,
        };
      }
      if (profile.email) candidates.push(profile.id);
    }
  }

  // Tier 3: Name + phone fuzzy
  if (mention.type === 'name') {
    for (const profile of profiles) {
      const profileName = [profile.firstName, profile.lastName]
        .filter(Boolean)
        .join(' ');
      const nameScore = fuzzyNameMatch(mention.value, profileName);
      if (nameScore >= 0.7 && profile.phone) {
        return {
          base44Id: profile.id,
          confidence: 0.8 * nameScore,
          matchTier: 3,
          matchedOn: `name:${mention.value}+phone:${profile.phone}`,
          candidates,
        };
      }
    }

    // Tier 4: Name + email fuzzy
    for (const profile of profiles) {
      const profileName = [profile.firstName, profile.lastName]
        .filter(Boolean)
        .join(' ');
      const nameScore = fuzzyNameMatch(mention.value, profileName);
      if (nameScore >= 0.7 && profile.email) {
        return {
          base44Id: profile.id,
          confidence: 0.75 * nameScore,
          matchTier: 4,
          matchedOn: `name:${mention.value}+email:${profile.email}`,
          candidates,
        };
      }
    }

    // Tier 5: Name-only match
    let bestProfile: CustomerProfileRecord | null = null;
    let bestScore = 0;
    for (const profile of profiles) {
      const profileName = [profile.firstName, profile.lastName]
        .filter(Boolean)
        .join(' ');
      const nameScore = fuzzyNameMatch(mention.value, profileName);
      if (nameScore > bestScore) {
        bestScore = nameScore;
        bestProfile = profile;
      }
    }

    if (bestProfile && bestScore >= 0.5) {
      return {
        base44Id: bestProfile.id,
        confidence: 0.5 * bestScore,
        matchTier: 5,
        matchedOn: `name:${mention.value}`,
        candidates,
      };
    }
  }

  // No match
  return {
    base44Id: null,
    confidence: 0,
    matchTier: 5,
    matchedOn: 'none',
    candidates,
  };
}

// ── Batch matching ───────────────────────────────────────────────

export function batchMatchCustomers(
  mentions: ExtractedCustomerMention[],
  profiles: CustomerProfileRecord[]
): Map<string, { match: CustomerMatch; mention: ExtractedCustomerMention }> {
  const result = new Map<string, { match: CustomerMatch; mention: ExtractedCustomerMention }>();

  for (const mention of mentions) {
    const match = matchCustomer(mention, profiles);
    if (match.base44Id) {
      // Use highest confidence match per customer
      const existing = result.get(match.base44Id);
      if (!existing || match.confidence > existing.match.confidence) {
        result.set(match.base44Id, { match, mention });
      }
    }
  }

  return result;
}
