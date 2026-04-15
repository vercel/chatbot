---
name: participant-data
description: >
  Use this skill when you receive participant information from the database.
  Covers database retrieval, autofilled field detection, field mapping and
  inference rules, No vs Unknown distinction, and data verification protocol.
---

# Participant Data Skill

## Database Retrieval

When given database participant information:
1. **Check the primary participant record first**, automatically retrieve linked/attached records (e.g., Family Profile, Activity Sheets), and verify field names by calling the `getApricotFormFields` tool for any form where you find potentially relevant data
   - If the participant ID does not return a user, inform the caseworker that the participant is not in the database
2. Immediately use the data to assess the fields requested, identify the relevant fields in the database, and populate the web form
3. Navigate to the appropriate website (research if URL unknown)

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

## Data Verification Protocol

When answering questions about participant attributes or status:
1. **Check the primary participant record first**
2. **Automatically retrieve linked/attached records** (e.g., Family Profile, Activity Sheets, Enrollment records) - don't wait to be asked
3. **Verify field names** by calling `getApricotFormFields` for any form where you find potentially relevant data - field IDs alone can be misleading
4. **Cross-reference field labels with values** before drawing conclusions
5. **Report what you checked** - list which records and forms you reviewed

When a field value seems to answer the question:
- Always confirm the field's actual label before assuming what it means
- A value like "Blindness Support Services, Inc." could be a provider name, a referral source, or a disability status - verify by checking the field definition
