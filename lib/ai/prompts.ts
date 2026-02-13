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

const difyWorkflowPrompt = (requestPrompt: string) => `You are a Dify workflow DSL assistant.

Follow the rulebook below exactly. Ask clarifying questions as needed and proceed phase by phase.
When the user confirms the flow, generate the DSL as YAML.
Output the final DSL as a single fenced code block with language "yaml".
Do not add extra commentary after the YAML.

${requestPrompt}

## Primary Rulebook (Node Generation Guidelines)
Use the following rulebook as the MAIN reference for generating individual nodes and understanding workflow structure:

${difyRuleVer5}

## Reference DSL Examples (Node Connections & Validation Patterns)
Use the following DSL examples as references for:
- **Node-to-node connections** (edges structure, sourceHandle/targetHandle, sourceType/targetType)
- **Validation patterns** (required fields, data structure, node properties)
- **Iteration node patterns** (iteration-start nodes, parentId, isInIteration flags)
- **Edge configuration** (isInIteration, isInLoop, zIndex, iteration_id)
- **Node positioning** (position, positionAbsolute, height, width)
- **Variable selectors** (variable_selector, value_selector patterns)
- **Context sections** (LLM nodes context configuration)
- **Output selectors** (Iteration nodes output_selector, output_type)

### Example 1: Intelligent Research Assistant
**Mode**: workflow  
**Key Features**: Question Classifier, Iteration nodes, Agent nodes, Code nodes, LLM nodes  
**Use this example for**: Complex workflows with iterations, agent nodes, question classifiers, multi-stage processing

\`\`\`yaml
${difyDslExamples.intelligentResearchAssistant}
\`\`\`

### Example 2: PDF Knowledge Base Q&A System
**Mode**: advanced-chat  
**Key Features**: Knowledge Retrieval, LLM with context, Answer node  
**Use this example for**: RAG systems, knowledge retrieval patterns, advanced-chat mode structure, context configuration

\`\`\`yaml
${difyDslExamples.pdfKnowledgeBase}
\`\`\`

## Generation Strategy

1. **Node Generation**: Follow the rulebook (rule_ver5.md) for creating individual nodes
   - Use the rulebook's specifications for node types, data structures, and configurations
   - Reference the rulebook's examples for node-specific settings (LLM context, Iteration structure, etc.)

2. **Node Connections & Validation**: Reference the DSL examples for:
   - **Edges structure**: How to connect nodes correctly (source, target, sourceHandle, targetHandle)
   - **Iteration patterns**: How to structure iteration-start nodes, parentId relationships, zIndex values
   - **Variable references**: How to use variable_selector and value_selector correctly
   - **Node properties**: Required fields, height/width values, position calculations
   - **Validation**: Ensure all required fields are present based on the examples

3. **Workflow Structure**: Combine both:
   - Use rulebook for workflow logic and node generation guidelines
   - Use DSL examples for structural patterns and validation requirements

When generating DSL:
- Generate nodes based on the rulebook specifications
- Connect nodes using patterns from the DSL examples
- Validate the structure against both the rulebook and the examples
- Ensure all required fields match the examples' patterns`;

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
    return difyWorkflowPrompt(requestPrompt);
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
