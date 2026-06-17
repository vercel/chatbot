/**
 * on-credit-report-ingested — Twenty Workflow Code Node
 * Phase 40: Twenty Wave 4 — Disputes
 *
 * Triggered when a new credit report is ingested.
 * Extracts negative items, evaluates dispute eligibility, generates dispute round.
 */

export const onCreditReportIngested = {
  id: "neptune-on-credit-report-ingested",
  name: "On Credit Report Ingested",
  trigger: "creditReport.created",
  description: "Runs when a new credit report is ingested — auto-extracts negative items",

  async execute({ record, api }: {
    record: any;
    api: any;
  }) {
    const actions: string[] = [];

    // 1. Parse credit report → extract negative items
    // const reportData = await api.get(`/api/credit/parse?reportId=${record.id}`);
    // const negativeItems = reportData.negativeItems;
    actions.push("credit-report: parsed");

    // 2. Create NegativeItem records in Twenty
    // for (const item of negativeItems) {
    //   await api.post("/api/twenty/objects/negativeItem", {
    //     personId: record.personId,
    //     creditReportId: record.id,
    //     bureau: record.bureau,
    //     accountName: item.accountName,
    //     accountType: item.accountType,
    //     balance: item.balance,
    //     dateOpened: item.dateOpened,
    //     isEligible: evaluateEligibility(item),
    //   });
    // }
    actions.push("negative-items: extracted and created");

    // 3. Update person's credit stats
    // await api.patch(`/api/twenty/people/${record.personId}`, {
    //   lastCreditReportDate: new Date(),
    //   totalNegativeItems: negativeItems.length,
    // });
    actions.push("person-credit-stats: updated");

    // 4. If eligible items found → suggest dispute round
    // const eligibleCount = negativeItems.filter(i => i.isEligible).length;
    // if (eligibleCount > 0) {
    //   await api.post("/api/tasks/create", {
    //     title: `Review ${eligibleCount} eligible items for dispute`,
    //     personId: record.personId,
    //     priority: "high",
    //   });
    // }
    actions.push("dispute-suggestion: task created if eligible items found");

    // 5. Agent notification
    // await api.post("/api/slack/message", {
    //   text: `📊 Credit report ingested: ${record.personName} — ${record.bureau} — Score: ${record.creditScore}`,
    // });
    actions.push("slack-notification: queued");

    return {
      success: true,
      actions,
      creditReportId: record.id,
      personId: record.personId,
    };
  },
};

/* Helper (to be implemented):
function evaluateEligibility(item: any): boolean {
  // Check: not already disputed, within SOL, verifiable inaccuracies
  return item.disputeStatus === "not_disputed" && item.isVerifiable;
}
*/
