"use client";

import type { BundledLanguage } from "shiki";
import type { HTMLAttributes, ReactElement } from "react";

import {
  CodeBlock,
  CodeBlockContainer,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockFilename,
} from "@/components/ai-elements/code-block";
import { cn } from "@/lib/utils";
import { memo, useCallback } from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract language from a className string like "language-typescript"
 */
const extractLanguage = (className?: string): string | undefined => {
  if (!className) return undefined;
  const match = className.match(/language-(\S+)/);
  return match ? match[1] : undefined;
};

/**
 * Extract plain text content from React children recursively
 */
const extractTextContent = (children: React.ReactNode): string => {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(extractTextContent).join("");
  if (children && typeof children === "object" && "props" in children) {
    const el = children as ReactElement;
    return extractTextContent(el.props.children);
  }
  return "";
};

/**
 * Map language identifier to Shiki BundledLanguage.
 * Falls back to "text" for unsupported languages.
 */
const normalizeLanguage = (lang?: string): BundledLanguage => {
  if (!lang) return "text" as BundledLanguage;

  // Direct shiki language IDs
  const knownLangs = new Set([
    "javascript", "js", "typescript", "ts", "tsx", "jsx",
    "python", "py", "rust", "rs", "go", "java", "kotlin",
    "swift", "ruby", "rb", "php", "c", "cpp", "csharp", "cs",
    "html", "css", "scss", "sass", "less",
    "json", "yaml", "yml", "toml", "xml",
    "markdown", "md", "mdx",
    "sql", "graphql", "bash", "sh", "shell", "zsh",
    "dockerfile", "docker",
    "vue", "svelte",
    "astro", "prisma", "solidity",
    "terraform", "tf", "hcl",
    "nginx", "ini", "toml",
    "diff", "log",
    "text", "txt", "plain",
  ]);

  // Normalize aliases
  const aliasMap: Record<string, BundledLanguage> = {
    js: "javascript",
    ts: "typescript",
    tsx: "tsx",
    jsx: "jsx",
    py: "python",
    rb: "ruby",
    rs: "rust",
    cs: "csharp",
    sh: "bash",
    shell: "bash",
    zsh: "bash",
    yml: "yaml",
    docker: "dockerfile",
    tf: "terraform",
    md: "markdown",
    txt: "text" as BundledLanguage,
    plain: "text" as BundledLanguage,
  };

  const normalized = aliasMap[lang.toLowerCase()] ?? lang.toLowerCase();
  return (knownLangs.has(normalized) ? normalized : "text") as BundledLanguage;
};

// ── Streamdown Pre Component ─────────────────────────────────────────────────

interface StreamdownPreProps extends HTMLAttributes<HTMLPreElement> {
  children: React.ReactNode;
}

/**
 * Custom <pre> renderer for Streamdown that wraps CodeBlock component.
 * Provides syntax highlighting, copy button, language label, and line numbers.
 */
const StreamdownPre = memo(({ children, className, ...props }: StreamdownPreProps) => {
  // Extract language and code from children
  const codeElement = children as ReactElement | undefined;
  const codeClassName = codeElement?.props?.className as string | undefined;
  const lang = extractLanguage(codeClassName) ?? extractLanguage(className);
  const language = normalizeLanguage(lang);
  const code = extractTextContent(codeElement?.props?.children ?? children);

  // Don't use CodeBlock wrapper for very short inline snippets
  const isInline = !className?.includes("language-") && code.length < 80 && !code.includes("\n");
  if (isInline) {
    return (
      <pre className={cn("inline-block", className)} {...props}>
        {children}
      </pre>
    );
  }

  // Show line numbers for blocks with 3+ lines
  const lineCount = code.split("\n").length;
  const showLineNumbers = lineCount >= 3;

  return (
    <div className="not-prose my-3">
      <CodeBlockContainer language={language}>
        <CodeBlockHeader>
          <CodeBlockTitle>
            <CodeBlockFilename>
              {(language as string) !== "text" ? language : "code"}
            </CodeBlockFilename>
          </CodeBlockTitle>
          <div className="flex items-center gap-1">
            <CodeBlockCopyButton />
          </div>
        </CodeBlockHeader>
        <CodeBlockContent
          code={code}
          language={language}
          showLineNumbers={showLineNumbers}
        />
      </CodeBlockContainer>
    </div>
  );
});

StreamdownPre.displayName = "StreamdownPre";

// ── Export ────────────────────────────────────────────────────────────────────

/**
 * Streamdown components map for rendering code blocks via CodeBlock.
 *
 * Usage:
 * ```tsx
 * <Streamdown components={codeBlockComponents}>
 *   {markdown}
 * </Streamdown>
 * ```
 */
export const codeBlockComponents = {
  pre: StreamdownPre,
};
