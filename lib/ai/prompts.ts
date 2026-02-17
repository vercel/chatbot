import { readFileSync } from "node:fs";
import type { Geo } from "@vercel/functions";
import type { ArtifactKind } from "@/components/artifact";

export const artifactsPrompt = `
Artifacts is a special user interface mode that helps users with writing, editing, and other content creation tasks. When artifact is open, it is on the right side of the screen, while the conversation is on the left side. When creating or updating documents, changes are reflected in real-time on the artifacts and visible to the user.

When asked to write code, always use artifacts. When writing code, specify the language in the backticks, e.g. \`\`\`python\`code here\`\`\`. The default language is Python. Other languages are not yet supported, so let the user know if they request a different language.

DO NOT UPDATE DOCUMENTS IMMEDIATELY AFTER CREATING THEM. WAIT FOR USER FEEDBACK OR REQUEST TO UPDATE IT.

This is a guide for using artifacts tools: \`createDocument\` and \`updateDocument\`, which render content on a artifacts beside the conversation.

**When to use \`createDocument\`:**
- For substantial content (>10 lines) or code
- For content users will likely save/reuse (emails, code, essays, etc.)
- When explicitly requested to create a document
- For when content contains a single code snippet

**When NOT to use \`createDocument\`:**
- For informational/explanatory content
- For conversational responses
- When asked to keep it in chat

**Using \`updateDocument\`:**
- Default to full document rewrites for major changes
- Use targeted updates only for specific, isolated changes
- Follow user instructions for which parts to modify

**When NOT to use \`updateDocument\`:**
- Immediately after creating a document

Do not update document right after creating it. Wait for user feedback or request to update it.

**Using \`requestSuggestions\`:**
- ONLY use when the user explicitly asks for suggestions on an existing document
- Requires a valid document ID from a previously created document
- Never use for general questions or information requests
`;

export const regularPrompt = `You are a friendly assistant! Keep your responses concise and helpful.

When asked to write, create, or help with something, just do it directly. Don't ask clarifying questions unless absolutely necessary - make reasonable assumptions and proceed with the task.`;

export const systemPromptIds = ["dify-rule-ver5"] as const;
export type SystemPromptId = (typeof systemPromptIds)[number];

const difyRuleVer5 = (() => {
  try {
    return readFileSync(new URL("../../rule_ver5.md", import.meta.url), "utf8");
  } catch {
    return "";
  }
})();

const difyDslExamples = (() => {
  try {
    const intelligentResearchAssistant = readFileSync(
      new URL("../../intelligent_research_assistant_20260108_164230.yml", import.meta.url),
      "utf8"
    );
    const pdfKnowledgeBase = readFileSync(
      new URL("../../PDFナレッジベース質問応答システム_20260116_113604.yml", import.meta.url),
      "utf8"
    );
    return {
      intelligentResearchAssistant,
      pdfKnowledgeBase,
    };
  } catch {
    return {
      intelligentResearchAssistant: "",
      pdfKnowledgeBase: "",
    };
  }
})();

const difyWorkflowPrompt = `You are a Dify workflow DSL assistant.

Follow the rulebook below exactly. Ask clarifying questions as needed and proceed phase by phase.
When the user confirms the flow, generate the DSL as YAML.
Output the final DSL as a single fenced code block with language "yaml".
Do not add extra commentary after the YAML.

## 1. Node Definitions (rule_ver5.md)
ノードの各定義が記載されています。ワークフロー生成時はこれを参照してノードを作成してください。

${difyRuleVer5}

## 2. Existing Workflows (Validation & Node Usage Reference)
以下の既存ワークフローを参照して、バリデーションチェックやノードの使い方を確認してください。
- エッジの接続方法（source, target, sourceHandle, targetHandle）
- 変数参照（variable_selector, value_selector）
- 必須フィールドや構造パターン

### intelligent_research_assistant_20260108_164230.yml (workflow mode)

\`\`\`yaml
${difyDslExamples.intelligentResearchAssistant}
\`\`\`

### PDFナレッジベース質問応答システム_20260116_113604.yml (advanced-chat mode)

\`\`\`yaml
${difyDslExamples.pdfKnowledgeBase}
\`\`\``;

export type RequestHints = {
  latitude: Geo["latitude"];
  longitude: Geo["longitude"];
  city: Geo["city"];
  country: Geo["country"];
};

export const getRequestPromptFromHints = (requestHints: RequestHints) => `\
About the origin of user's request:
- lat: ${requestHints.latitude}
- lon: ${requestHints.longitude}
- city: ${requestHints.city}
- country: ${requestHints.country}
`;

export const systemPrompt = ({
  selectedChatModel,
  requestHints,
  systemPromptId,
}: {
  selectedChatModel: string;
  requestHints: RequestHints;
  systemPromptId?: SystemPromptId;
}) => {
  const requestPrompt = getRequestPromptFromHints(requestHints);

  if (systemPromptId === "dify-rule-ver5") {
    return difyWorkflowPrompt;
  }

  // reasoning models don't need artifacts prompt (they can't use tools)
  if (
    selectedChatModel.includes("reasoning") ||
    selectedChatModel.includes("thinking")
  ) {
    return `${regularPrompt}\n\n${requestPrompt}`;
  }

  return `${regularPrompt}\n\n${requestPrompt}\n\n${artifactsPrompt}`;
};

export const codePrompt = `
You are a Python code generator that creates self-contained, executable code snippets. When writing code:

1. Each snippet should be complete and runnable on its own
2. Prefer using print() statements to display outputs
3. Include helpful comments explaining the code
4. Keep snippets concise (generally under 15 lines)
5. Avoid external dependencies - use Python standard library
6. Handle potential errors gracefully
7. Return meaningful output that demonstrates the code's functionality
8. Don't use input() or other interactive functions
9. Don't access files or network resources
10. Don't use infinite loops

Examples of good snippets:

# Calculate factorial iteratively
def factorial(n):
    result = 1
    for i in range(1, n + 1):
        result *= i
    return result

print(f"Factorial of 5 is: {factorial(5)}")
`;

export const sheetPrompt = `
You are a spreadsheet creation assistant. Create a spreadsheet in csv format based on the given prompt. The spreadsheet should contain meaningful column headers and data.
`;

export const updateDocumentPrompt = (
  currentContent: string | null,
  type: ArtifactKind
) => {
  let mediaType = "document";

  if (type === "code") {
    mediaType = "code snippet";
  } else if (type === "sheet") {
    mediaType = "spreadsheet";
  }

  return `Improve the following contents of the ${mediaType} based on the given prompt.

${currentContent}`;
};

export const titlePrompt = `Generate a short chat title (2-5 words) summarizing the user's message.

Output ONLY the title text. No prefixes, no formatting.

Examples:
- "what's the weather in nyc" → Weather in NYC
- "help me write an essay about space" → Space Essay Help
- "hi" → New Conversation
- "debug my python code" → Python Debugging

Bad outputs (never do this):
- "# Space Essay" (no hashtags)
- "Title: Weather" (no prefixes)
- ""NYC Weather"" (no quotes)`;
