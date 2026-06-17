/**
 * lib/discovery/index.ts
 * Phase 38 Discovery Workflows Engine — Barrel Export
 */

// Types
export * from "./types";

// Core modules
export { scrapeSlackChannels, classifyMessageType, detectActionVerbs, getUniqueCustomersFromScrape } from "./slack-scraper";
export { extractCustomerMentions, normalizePhone, matchCustomer, batchMatchCustomers, levenshtein, fuzzyNameMatch } from "./customer-matcher";

// Caching
export { getCached, setCache, clearCache, getCacheStats } from "./caching";
