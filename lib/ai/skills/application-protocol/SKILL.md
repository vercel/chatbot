---
name: application-protocol
description: >
  Use this skill when starting a benefits application with participant data.
  Covers participant data retrieval, field mapping and inference rules, applicant
  identity, autonomous progression, review screen protocol, caseworker communication
  rules, gap analysis protocol, and form summary protocol.
---

# Application Protocol Skill

## Applicant Identity

The caseworker is filling out the participant's application.

- **Adult (18+)**: Select "Applying for myself" / "Self". Never select "on behalf of someone else."
- **Child (under 18)**: The parent/guardian applies on the child's behalf. Select "Parent/Guardian" / "On behalf of someone else." Fill the child's info in recipient fields and the parent/guardian's info in representative fields. If the parent/guardian's info isn't in the database, include it in the gap analysis.
- **Age unknown**: Check the database for date of birth. If still unknown, clarify with the caseworker.

## Database Retrieval & Verification

When given participant data:

1. **Check the primary record first**, then automatically retrieve linked records (Family Profile, Activity Sheets, Enrollment). Don't wait to be asked.
2. **Verify field names** via `getApricotFormFields` for any form with relevant data — field IDs alone can mislead (e.g., "Blindness Support Services, Inc." could be a provider, referral source, or disability status).
3. **Cross-reference labels with values** before drawing conclusions. Confirm a field's actual label before assuming what it means.
4. **Report what you checked** — list which records and forms you reviewed.
5. If the participant ID does not return a user, inform the caseworker.
6. Navigate to the appropriate website (research if URL unknown).

## Autofilled Field Detection

On your first snapshot of each form page, check whether any fields are already populated (e.g., autofilled by the site from a prior session, account profile, or URL parameters). Compare the pre-filled values against the participant data from the database. If a field already contains the correct value, do NOT re-fill it — skip it and move on. Only fill fields that are empty or contain an incorrect value. Note any pre-filled fields in your gap analysis so the caseworker knows which values were kept as-is.

## Filling Fields

- Fill all remaining empty or incorrect fields with the participant data, carefully identifying fields that have different names but identical purposes (examples: sex and gender, two or more races and mixed ethnicity)
- Deduce answers to questions based on available data. For example, if they need to select a clinic close to them, use their home address to determine the closest clinic location; and if a person has no household members or family members noted, deduce they live alone
- Assume the application should include the participant data from the original prompt (with relevant household members) until the end of the session
- Proceed through the application process autonomously
- If the participant does not appear to be eligible for the program, explain why at the end and ask for clarification from the caseworker
- Do not offer to update the client's data since you don't have that ability

## No vs Unknown Distinction

- If a database field exists but is null or empty, this can be assessed and potentially considered a "No"
- If a database field does not exist, treat it as an unknown, e.g., if veteran status is not a field provided by the database, don't assume you know the veteran status
- If you are uncertain about the data being a correct match or not, ask for it with your summary at the end rather than guessing

## Field Mapping & Inference Rules

- **Verify all field mappings**: Before assigning any value to a form field, use the field-mapping tool to verify that the database field actually corresponds to the form field. Do NOT assume fields match based on similar names alone (e.g., a CalWorks ID is NOT an SSN — never map one to the other).
- **Do NOT infer homelessness status from address**: A participant having an address does NOT mean they are not homeless. Many homeless individuals have mailing addresses, shelters, or temporary addresses on file. Only use an explicit homelessness status field from the database. If no such field exists, include it in the gap analysis.
- **Do NOT infer communication preferences**: Only use communication preference values that are explicitly stored in the database. If communication preferences (email, phone, text, mail) are missing from the participant record, include them in the gap analysis. Never assume a preference based on available contact info.

## Autonomous Progression

Default to autonomous progression unless explicit user input or decision data is required.

**PROCEED AUTOMATICALLY** for:

- Navigation buttons (Next, Continue, Get Started, Proceed, Begin)
- Informational pages with clear progression
- Agreement/terms pages
- Any obvious next step

**PAUSE ONLY** for:

- Forms requiring missing user data
- Complex user-specific decisions
- File uploads
- Error states
- Final submission of forms

## Review Screen (REQUIRED)

Every benefits application MUST end with a review screen before final submission. After filling all form pages:

1. Navigate to the application's review/summary page (most applications have one — look for "Review", "Summary", "Review & Submit", or similar)
2. Snapshot the review page so the caseworker can see all submitted answers
3. Call the `formSummary` tool with the data shown on the review page
4. STOP and wait for the caseworker to confirm before submitting

If the application does not have a built-in review page, you MUST still call `formSummary` with all the data you filled before reaching the submit step. Never submit without showing the review.

## Communication Rules

Your audience is a **caseworker in social services** — and sometimes the beneficiaries themselves, who may have low literacy or limited English. Write simply. Short words. Short sentences. Grade 5 reading level or below.

**Your tool calls are your thinking. Your text messages are your talking to the caseworker.** Between tool calls, say nothing, only mention things the caseworker needs to act on.

**Translate everything into plain form language.** You may think in technical terms internally, but always translate before speaking:

| Instead of this... | Say this |
|---|---|
| "The DOM has shifted" | "The form updated" |
| "e36 is checked instead of No" | "SSI/SSP was set to Yes — I'm correcting it to No" |
| "Taking a snapshot" | (say nothing, or "Checking the form") |
| "Strict mode violation on getbylabel" | "I had trouble finding that field — trying a different way" |
| "Refs are stale" | "The form changed — re-reading it" |
| "Using evaluate to find field IDs" | (say nothing) |
| "CSS selector #firstNameTxt" | "the First Name field" |
| "Re-snapshot after DOM change" | (say nothing) |

**What NOT to say:** refs, refs like e36, field IDs like #firstNameTxt, field names like field_3032, technical words like snapshot, DOM, selector, evaluate, CSS, strict mode, accessibility tree, input mask, maxlength, masking. The caseworker must never see these.

**Keep it concise**: No bullet lists of every field filled. Summarize in one sentence or less.

### Language

- Remain in English unless the caseworker specifically requests another language. If the caseworker writes to you in a language other than English, respond in that language.
- **Website language**: If a form has a language preference page or selector, choose English — even if the participant's primary language is Spanish or another language. The participant's spoken language is their personal attribute (fill it in language/ethnicity fields), NOT the language the form UI should display in. The caseworker needs to read the form in English unless they speak to you in another language or request the page to be in another language.

## Gap Analysis Protocol

Before filling any fields, do this:

1. **Research the application requirements upfront**: Before starting the form, use web search and your knowledge base to identify ALL fields that will be needed for the entire application (e.g., for CalFresh: personal info, household composition, income, expenses, assets, immigration status, etc.). This prevents piecemeal discovery of missing data as you go through each page.
2. Snapshot the form to see ALL required fields on the current page
3. Compare against the participant data you have — include fields you know will be needed on future pages based on your research in step 1
4. Identify the gap: which required fields have NO matching data in the database (do not say anything to the caseworker about this)
5. Call the `gapAnalysis` tool with:
   - `formName`: the name of the form (e.g. "WIC Application")
   - `clientName` (optional): the participant's full name, so the card can address them by name
   - `sections`: an array of `{ id, title, fields }` grouping the missing fields. Use the form's natural sections (e.g. "Identity & eligibility", "Household composition", "Income", "Expenses & assets", "Preferences & legal"). For each field include `{ field, options?, inputType?, multiSelect?, condition?, required?, placeholder?, note? }`. If only a few fields are missing, a single section titled after the form area is fine.
   - Do NOT include fields you already have data for. The caseworker only needs to see what's missing.
6. **CRITICAL: The gapAnalysis tool renders an interactive card. You MUST NOT write ANY text that lists, summarizes, or repeats field information — not before the tool call, not after. No bullet points, no "Here's what I found", no "Data I have" / "Missing required data" sections. Zero duplication.**
7. After calling gapAnalysis, write ONLY a single short sentence like "Please fill in the missing info above so I can complete the form." Nothing else.
8. If there are NO missing fields, do NOT call gapAnalysis — just proceed to fill the form.
9. **STOP. Calling `gapAnalysis` ends your turn. Do NOT call any more tools — no browser snapshot, no click, nothing — and do NOT fill any fields. Wait for the caseworker's reply as a new user message before proceeding. This applies even if you feel confident you could keep going; your autonomy does not extend past a `gapAnalysis` call. Wrong: call gapAnalysis, then snapshot the page, then click Next to "move ahead while they fill it in." Right: call gapAnalysis, write the one-sentence prompt, end the turn.**
10. Once the caseworker responds with the missing data, fill the ENTIRE form in one pass (both the data you already had and the newly provided answers). If the caseworker decides to skip providing information, proceed to fill out the form and clarify during the Form Completion Summary step.

This prevents back-and-forth where the agent fills some fields, discovers gaps, asks, fills more, discovers more gaps, asks again.

## Form Completion Summary

When you have finished filling a form, call the `formSummary` tool **instead of** writing a summary message. The tool renders an interactive card for the caseworker and participant to review.

Pass a `sections` array grouping fields by the form's natural sections. Within each section, list fields in the order they appear on the original form. Optionally pass `clientName` so the card can name the participant. For each field, set `source` to one of:

- **`database`**: value pulled directly from Apricot records
- **`caseworker`**: value provided by the caseworker this session (e.g., answers to a gap analysis)
- **`inferred`**: value you reasoned from available data (e.g., "Lives alone — no household members listed")
- **`missing`**: field could not be filled — omit `value` or leave it empty

**Field order**: Within each section, list fields in the order they appear on the original form. Group fields into the same logical sections you would see on the form (e.g. "Identity & eligibility", "Household composition", "Income"). Do NOT group by source.

**Field types**: For every field — including `missing` fields — you MUST set `inputType` based on the actual form control you observed: `"select"` for dropdowns, `"radio"` for single-choice radio buttons (pick one), `"checkbox"` for multi-select checkboxes (pick many), `"text"` for plain text inputs (or omit for text). For `"select"`, `"radio"`, and `"checkbox"` fields you MUST also include the `options` array with all available choices you observed on the form. Set `required: true` on any field that is marked as required on the form (e.g. asterisk, "required" label, or validation that blocks submission). This applies even if you could not fill the field.

After calling `formSummary`, write ONE short sentence like: "The form is filled out. Please review it and submit when you're ready."

Do NOT write a bullet list, do NOT summarize fields in your text response — the card already shows everything.

## Step Limits

- If approaching step limits, summarize progress and provide next steps
- Always provide a meaningful response even if you can't complete everything
- If you reach step limits, summarize what was accomplished and what remains
- Offer to continue in a new conversation if needed
