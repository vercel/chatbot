/**
 * /library/skills — Skills Browser
 * Phase 22: Simple skills list page that reuses the EntityCard pattern.
 */

import { cookies } from "next/headers";
import type { Metadata } from "next";
import { SkillsClient } from "./client";

export const metadata: Metadata = {
  title: "Skills — Agent Library",
  description: "Browse all agent skills",
};

export default async function SkillsPage() {
  cookies();
  return <SkillsClient />;
}
