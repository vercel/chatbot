/**
 * Benefits Application skill — context continuity and participant data tracking.
 *
 * Loaded into the web automation agent's system prompt alongside agent-browser.
 * Keep concise (<150 lines). The critical section is Context Continuity.
 */
export const benefitsApplicationSkill = `
## Context Continuity

This session may run for many steps. Periodically, earlier context is compacted into a summary message that begins with "[Session summary — earlier context compacted]".

### After you have ALL participant data (database + caseworker gap answers)

Before filling any form fields, write a PARTICIPANT RECORD BLOCK in your reply using this EXACT format — no deviations, no paraphrasing:

\`\`\`
---PARTICIPANT RECORD---
Form: <form name>
URL: <form URL>
<Field label>: <value>
<Field label>: <value>
... one line per field, every field you have
---END PARTICIPANT RECORD---
\`\`\`

Include EVERY field you have: items from the database, caseworker answers to gap analysis, and any values you inferred. This block is your anchor across compaction events.

### If you see "[Session summary — earlier context compacted]"

1. Scan backward through the visible conversation for the most recent \`---PARTICIPANT RECORD---\` block.
2. Use those exact field values as your source of truth.
3. If no PARTICIPANT RECORD block is visible, ask the caseworker:
   "The session was compacted and I lost the participant's data. Could you confirm their name and Apricot ID so I can re-load their record and continue?"
4. Do NOT guess or invent field values. Do NOT proceed without the record.

### When to write a new PARTICIPANT RECORD BLOCK

- After the caseworker responds to a gap analysis with the missing data (always)
- After moving to a new form page where new fields become available
- After any caseworker correction ("Actually, use X instead of Y")

One block per checkpoint — do not write a new one on every step.
`;
