/**
 * POST /api/self-code/apply
 *
 * M-N-SELF-CODING (2026-06-21): Self-coding endpoint that applies code
 * directly to GitHub and optionally deploys to Vercel.
 *
 * This is the primary API endpoint for the self-coding lane.
 * When V2 handoff or VPS dispatch fail, the UI falls back to this.
 *
 * Accepts: { repo, content, sessionId, files?, deploy? }
 * Returns: { success, sessionId, branch, prUrl, deployUrl, committedFiles }
 *
 * Auth: NextAuth session required (matches spawn-coding-agent pattern)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { codeApply } from "@/lib/self-coding/code-apply";
import { deployToVercel, NEPTUNE_CHAT_PROJECT_ID } from "@/lib/self-coding/deploy";
import type { CodeApplyInput, FileChangeInput } from "@/lib/self-coding/code-apply";

// ─── Repo Mapping ──────────────────────────────────────────────────────────

const REPO_MAP: Record<string, string> = {
  "neptune-chat": "neptune-chat",
  "neptune-v2": "neptune-v2",
  "newleaf-financial": "newleaf-financial",
  portal: "portal",
  pay: "pay",
};

function mapRepo(repoId: string): string {
  return REPO_MAP[repoId] || "neptune-chat";
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Extract file changes from a chat message containing code blocks.
 * Looks for file path hints in markdown or comments before code blocks.
 */
function extractFilesFromContent(content: string): FileChangeInput[] {
  const files: FileChangeInput[] = [];
  const lines = content.split("\n");

  let currentFile: { path: string; lines: string[] } | null = null;

  for (const line of lines) {
    // Detect file path hints: // filename.ts, /* path/to/file.tsx */, # file: src/...
    const pathMatch = line.match(
      /(?:\/\/|#|--)\s*(?:file|path|filename)[\s:]+([\w\/\-\.]+\.(?:tsx?|jsx?|css|json|yaml|yml|md))/
    );

    if (pathMatch) {
      // Flush previous file
      if (currentFile) {
        files.push({
          path: currentFile.path,
          content: currentFile.lines.join("\n"),
          operation: "create",
        });
      }
      currentFile = { path: pathMatch[1], lines: [] };
    } else if (currentFile) {
      currentFile.lines.push(line);
    }
  }

  // Flush last file
  if (currentFile) {
    files.push({
      path: currentFile.path,
      content: currentFile.lines.join("\n"),
      operation: "create",
    });
  }

  // If no file hints found, extract code blocks
  if (files.length === 0) {
    const codeBlockRegex = /```(\w+)?\s*\n([\s\S]*?)```/g;
    let match;
    let blockIndex = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const lang = match[1] || "txt";
      const code = match[2];
      const ext = langToExt(lang);
      files.push({
        path: `self-code-patch-${blockIndex}.${ext}`,
        content: code,
        operation: "create",
      });
      blockIndex++;
    }
  }

  return files;
}

function langToExt(lang: string): string {
  const map: Record<string, string> = {
    typescript: "ts",
    ts: "ts",
    tsx: "tsx",
    javascript: "js",
    js: "js",
    jsx: "jsx",
    css: "css",
    json: "json",
    yaml: "yaml",
    yml: "yml",
    markdown: "md",
    md: "md",
    python: "py",
    bash: "sh",
    shell: "sh",
    sql: "sql",
  };
  return map[lang.toLowerCase()] || "txt";
}

// ─── POST Handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const requestId = `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized — login required" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      repo: repoId,
      content,
      sessionId,
      files: providedFiles,
      deploy = true,
      goal,
    } = body as {
      repo?: string;
      content?: string;
      sessionId?: string;
      files?: FileChangeInput[];
      deploy?: boolean;
      goal?: string;
    };

    if (!content && !providedFiles) {
      return NextResponse.json(
        { success: false, error: "content or files is required" },
        { status: 400 }
      );
    }

    const repo = mapRepo(repoId || "neptune-chat");
    const taskGoal = goal || content?.slice(0, 100) || "Self-code task";

    // Extract or use provided files
    const files = providedFiles || extractFilesFromContent(content || "");

    if (files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No file changes could be extracted from the content. Provide explicit files array or add file path hints (e.g., // file: src/component.tsx).",
        },
        { status: 400 }
      );
    }

    console.log(
      `[self-code/apply] [${requestId}] Applying ${files.length} file(s) to ${repo}: ${taskGoal.slice(0, 80)}`
    );

    // ── Step 1: Apply code to GitHub ──
    const applyInput: CodeApplyInput = {
      repo,
      goal: taskGoal,
      files,
      commitPrefix: "feat(self-code)",
      lane: "self",
    };

    const applyResult = await codeApply(applyInput);

    if (!applyResult.success) {
      console.error(
        `[self-code/apply] [${requestId}] Code apply failed: ${applyResult.error}`
      );
      return NextResponse.json(
        {
          success: false,
          error: applyResult.error || "Code apply failed",
          committedFiles: applyResult.committedFiles,
          failedFiles: applyResult.failedFiles,
        },
        { status: 500 }
      );
    }

    // ── Step 2: Optionally deploy to Vercel ──
    let deployResult: { success: boolean; url?: string; error?: string } = {
      success: false,
    };

    if (deploy && applyResult.branch && repo === "neptune-chat") {
      console.log(`[self-code/apply] [${requestId}] Triggering Vercel deploy for branch: ${applyResult.branch}`);

      try {
        const result = await deployToVercel({
          projectId: NEPTUNE_CHAT_PROJECT_ID,
          branch: applyResult.branch,
          target: "preview",
          timeoutMs: 120_000,
        });

        deployResult = {
          success: result.success,
          url: result.url,
          error: result.error,
        };
      } catch (err) {
        deployResult = {
          success: false,
          error: err instanceof Error ? err.message : "Deploy failed",
        };
      }
    }

    console.log(
      `[self-code/apply] [${requestId}] ✅ Complete: PR=${applyResult.prUrl}, deploy=${deployResult.url || "N/A"}`
    );

    return NextResponse.json({
      success: true,
      sessionId: requestId,
      repo,
      branch: applyResult.branch,
      prUrl: applyResult.prUrl,
      prNumber: applyResult.prNumber,
      deployUrl: deployResult.url,
      deploySuccess: deployResult.success,
      committedFiles: applyResult.committedFiles,
      failedFiles: applyResult.failedFiles,
    });
  } catch (err) {
    console.error(`[self-code/apply] [${requestId}] Unhandled error:`, err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
