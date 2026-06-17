# Disputes — Custom Business Knowledge (NewLeaf Financial)

> **Domain:** credit-disputes | **Priority:** P0 | **Playbook:** playbook-disputes.md
> **Last Updated:** 2026-06-16 | **Phase:** 24

---

## Dispute Round Rules

### Round Structure
| Round | Action | Window | Evidence Required | Escalation |
|-------|--------|--------|-------------------|------------|
| **Round 1** | Initial dispute letter to bureau | 30 days for bureau response | Standard: report + reason code + ID | Automated via Forth |
| **Round 2** | Follow-up with additional evidence | 15 days for bureau response | NEW evidence (cannot reuse Round 1) | Supervisor review required |
| **Round 3** | Final dispute / legal review | 10 days for bureau response | Legal basis + all prior evidence | Attorney review before filing |
| **Post-R3** | Only if new evidence surfaces | N/A | Materially new information | Must be approved by compliance |

### Round Timing Rules
- Round 1 MUST be filed within 30 days of credit report pull
- Round 2 MUST include NEW evidence (not a re-submission of Round 1)
- Round 3 requires attorney review AND client sign-off
- Maximum 3 rounds per negative item unless genuinely new evidence surfaces
- Bureau has 30 days to respond (45 days if report was free annual report)

---

## FCRA Case Law Reference

### Key FCRA Sections
| Section | Title | Summary | 30-Day Clock? |
|---------|-------|---------|---------------|
| FCRA 611 (15 USC 1681i) | Procedure in case of disputed accuracy | Bureau must investigate within 30 days, notify furnisher within 5 days, report results to consumer within 5 days of completion | YES — 30 days |
| FCRA 623 (15 USC 1681s-2) | Responsibilities of furnishers of information | Furnisher must investigate dispute, review all information provided, report results to bureau, correct/delete incomplete or inaccurate info | YES — 30 days |
| FCRA 605 (15 USC 1681c) | Requirements relating to information in consumer reports | Bankruptcy: 10 years. Other negative: 7 years. Tax liens: 7 years (paid) or indefinitely (unpaid). Criminal convictions: indefinitely. | N/A |
| FCRA 604 (15 USC 1681b) | Permissible purposes of consumer reports | Credit report can only be pulled for: credit transaction, employment, insurance, license, legitimate business need, court order, written consumer consent | N/A |
| FCRA 609 (15 USC 1681g) | Disclosures to consumers | Consumer has right to: all information in their file, source of information, list of who received their report (12 months for employment, 24 months otherwise) | N/A |
| FCRA 616 (15 USC 1681n) | Civil liability for willful noncompliance | Actual damages OR statutory damages ($100-$1000), punitive damages, costs + attorney fees | N/A |
| FCRA 617 (15 USC 1681o) | Civil liability for negligent noncompliance | Actual damages, costs + attorney fees | N/A |

### Critical Deadlines
1. **Bureau investigation:** 30 calendar days from receipt of dispute
2. **Furnisher investigation:** 30 calendar days from bureau notification
3. **Results to consumer:** Within 5 business days of investigation completion
4. **Free report after dispute:** Bureau must provide free report if dispute results in deletion/modification
5. **Re-insertion notice:** If deleted item is re-inserted, bureau must notify consumer within 5 days

---

## Bureau-Specific Patterns

### Equifax
- **Online dispute portal:** my.equifax.com (requires account)
- **Mail address:** Equifax Information Services LLC, P.O. Box 740256, Atlanta, GA 30374-0256
- **Average response time:** 25-30 days
- **Required info:** Dispute reason code + supporting documentation + report confirmation number
- **Common rejection:** "Previously investigated" — requires NEW evidence, not re-submission
- **Tracking:** Equifax provides a 10-digit confirmation number for each dispute

### Experian
- **Online dispute portal:** experian.com/dispute (requires report number)
- **Mail address:** Experian, P.O. Box 4500, Allen, TX 75013
- **Average response time:** 20-25 days
- **Required info:** Report number + item ID + reason code + supporting documentation
- **Common rejection:** "Verified as accurate" — must escalate to furnisher directly
- **Tracking:** Experian provides an 8-digit dispute number

### TransUnion
- **Online dispute portal:** dispute.transunion.com (requires account)
- **Mail address:** TransUnion Consumer Solutions, P.O. Box 2000, Chester, PA 19016-2000
- **Average response time:** 22-28 days
- **Required info:** File number + item identification + reason code
- **Common rejection:** "Frivolous dispute" — add specificity, attach supporting documentation
- **Tracking:** TransUnion provides a 12-digit dispute number

---

## Dispute Reason Codes

| Code | Description | Documentation Needed | Success Rate |
|------|-------------|---------------------|-------------|
| NM | Not mine / Fraud | Police report, FTC Identity Theft Report, government ID | High (with police report) |
| II | Inaccurate information | Account statements, payment records, correspondence | Medium-High |
| AC | Account closed / Paid | Paid-in-full letter, closure confirmation, statement showing $0 | High |
| BI | Balance incorrect | Account statements showing correct balance | Medium |
| DI | Date incorrect | Documentation showing correct date (statements, contracts) | Medium |
| DA | Duplicate account | Statements showing both accounts are same | High |
| OT | Other (requires explanation) | Detailed explanation + supporting documents | Variable |

---

## Evidence Requirements

### Standard Documentation (ALL disputes)
1. Valid government-issued photo ID (driver's license, passport, state ID)
2. Proof of current address (utility bill, bank statement — within 90 days)
3. Copy of credit report showing disputed item (with item circled/highlighted)
4. Dispute letter explaining reason + desired outcome

### Additional Evidence by Dispute Type
- **Not mine / Fraud:** Police report (required), FTC Identity Theft Report (required), FTC affidavit
- **Inaccurate information:** Account statements, payment history, correspondence with creditor, contract/agreement showing correct terms
- **Account closed / Paid:** Paid-in-full letter from creditor, bank statements showing final payment, account closure confirmation
- **Balance incorrect:** Full payment history, agreement showing correct terms, amortization schedule
- **Date incorrect:** Original contract showing correct date, statements showing first/last activity
- **Duplicate account:** Statements from both accounts showing same account number, correspondence acknowledging duplicate

---

## Anti-Patterns (NEVER DO)

| # | Anti-Pattern | Why Wrong | Fix |
|---|-------------|----------|-----|
| 1 | Filing a dispute without client authorization | Legal violation, client trust breach | Get written authorization before filing |
| 2 | Submitting the same evidence for Round 2 and 3 | Bureau will reject as "previously investigated" | NEW evidence required each round |
| 3 | Missing the 30-day response window | Bureau can dismiss dispute | Track deadlines, set reminders at day 25 |
| 4 | Disputing accurate information (FCRA violation) | No legal basis, wastes time/resources | Verify accuracy BEFORE filing |
| 5 | Promising specific outcomes or timelines | Impossible to guarantee, deceptive practice | Explain process, not outcomes |
| 6 | Skipping credit report pull before filing | Cannot identify items to dispute | Always pull fresh report first |
| 7 | Filing all items at once (scattershot) | Bureau may classify as frivolous | Group related items, file in batches of 5-7 |
| 8 | Using emotional language in dispute letters | Unprofessional, may weaken case | Factual, specific, evidence-based language only |
| 9 | Missing furnisher notification (FCRA 623) | Furnisher has separate obligations | Notify bureau + furnisher simultaneously |
| 10 | Ignoring bureau response deadlines | Clock starts when bureau receives dispute | Track all dates with Base44 dispute_rounds |

---

## Dispute Workflow Automation
- **Forth connector:** Generates and sends dispute letters to bureaus
- **Base44 dispute_rounds:** Tracks round number, status, dates, responses
- **Base44 negative_items:** Tracks each disputed item with current status
- **Slack notifications:** #jarvis-admin for deadline warnings (25-day mark)
- **Escalation path:** Round 1 (automated) → Round 2 (supervisor review) → Round 3 (attorney + compliance)

---

*End of disputes/custom-knowledge.md — Phase 24 Stream 1*
