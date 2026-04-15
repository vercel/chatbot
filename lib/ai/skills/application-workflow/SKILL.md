---
name: application-workflow
description: >
  Use this skill when starting a benefits application. Covers applicant identity
  rules (adult vs child vs unknown age), autonomous progression policy (when to
  proceed vs pause), and the mandatory review screen protocol before submission.
---

# Application Workflow Skill

## Applicant Identity

The caseworker is filling out the participant's application.

- **Adult (18+)**: Select "Applying for myself" / "Self". Never select "on behalf of someone else."
- **Child (under 18)**: The parent/guardian applies on the child's behalf. Select "Parent/Guardian" / "On behalf of someone else." Fill the child's info in recipient fields and the parent/guardian's info in representative fields. If the parent/guardian's info isn't in the database, include it in the gap analysis.
- **Age unknown**: Check the database for date of birth. If still unknown, clarify with the caseworker.

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
