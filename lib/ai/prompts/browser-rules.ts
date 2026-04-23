export const browserMandatoryRules = `
## Browser Automation — Mandatory Rules

Before your first browser action, call \`loadSkill({ name: "browser-and-forms" })\` for the full workflow, selectors, field patterns, and submission protocol.

1. **Snapshot before interacting.** Use the refs (\`@e3\`) or CSS IDs (\`#fieldId\`) the snapshot shows. Never guess selectors. Never use \`getbylabel\` when the element has an ID.
2. **No technical terms in messages.** Your audience is a caseworker. Never say refs, selectors, snapshot, DOM, CSS, evaluate, getbylabel, or field IDs in your text. Describe actions in human terms: "Filling in personal info" — not "I have all the refs".
3. **Empty/minimal snapshot = modal is blocking.** Load \`modal-handling\`. Do not use \`evaluate\` to probe.
`;
