/**
 * Phase 23B: viewFile Tool Fix
 *
 * Three-tier fallback strategy:
 *   1. fs.readFile direct (absolute or relative-to-cwd)
 *   2. git show HEAD:filePath (for moved/renamed files)
 *   3. find . -name basename (returns candidates list on miss)
 *
 * Supports startLine/endLine slicing.
 */

import { tool } from "ai";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export const viewFile = tool({
  description:
    "View the contents of a file in the repository. Supports relative or absolute paths with optional line slicing.",
  inputSchema: z.object({
    path: z.string().describe("Relative or absolute file path to read"),
    startLine: z.number().optional().describe("Optional 1-based start line"),
    endLine: z.number().optional().describe("Optional 1-based end line"),
  }),

  execute: async ({ path: filePath, startLine, endLine }) => {
    // ── Normalize path ──────────────────────────────────────────────────
    const normalized = filePath.startsWith("/")
      ? filePath
      : path.join(process.cwd(), filePath);

    /**
     * Slice lines if startLine/endLine provided.
     */
    function slice(content: string): string {
      if (startLine == null && endLine == null) return content;
      const lines = content.split("\n");
      const s = (startLine ?? 1) - 1;
      const e = endLine ?? lines.length;
      return lines.slice(Math.max(0, s), Math.min(lines.length, e)).join("\n");
    }

    // ── Tier 1: Direct fs.readFile ──────────────────────────────────────
    try {
      const content = await fs.readFile(normalized, "utf-8");
      const lines = content.split("\n");
      return {
        success: true,
        path: normalized,
        content: slice(content),
        totalLines: lines.length,
        source: "fs",
      };
    } catch (fsErr: unknown) {
      // fs error — continue to tier 2
    }

    // ── Tier 2: git show HEAD:filePath ──────────────────────────────────
    try {
      const { stdout } = await execAsync(`git show HEAD:${filePath}`, {
        cwd: process.cwd(),
      });
      const lines = stdout.split("\n");
      return {
        success: true,
        path: filePath,
        content: slice(stdout),
        totalLines: lines.length,
        source: "git-HEAD",
      };
    } catch (gitErr: unknown) {
      // git error — continue to tier 3
    }

    // ── Tier 3: find by basename (last resort) ──────────────────────────
    try {
      const basename = path.basename(filePath);
      const { stdout } = await execAsync(
        `find . -name "${basename}" -not -path './node_modules/*' -not -path './.next/*' -not -path './.git/*' | head -10`,
        { cwd: process.cwd() }
      );
      const candidates = stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((c) => c.replace(/^\.\//, ""));

      if (candidates.length === 1) {
        // Exactly one candidate — read it directly
        try {
          const candidatePath = path.join(process.cwd(), candidates[0]);
          const content = await fs.readFile(candidatePath, "utf-8");
          const lines = content.split("\n");
          return {
            success: true,
            path: candidates[0],
            content: slice(content),
            totalLines: lines.length,
            source: "find-candidate",
          };
        } catch {
          // Fall through to candidate list
        }
      }

      return {
        success: false,
        error: `File not found: ${filePath}`,
        candidates: candidates.slice(0, 5),
        suggestion:
          candidates.length > 0
            ? `Did you mean one of these? ${candidates.slice(0, 5).join(", ")}`
            : "File not found in repo. Use grep or ls to find the right path.",
      };
    } catch {
      return {
        success: false,
        error: `File not found: ${filePath}`,
        suggestion:
          "File not found. Try using grep to locate it, or check the path.",
      };
    }
  },
});
