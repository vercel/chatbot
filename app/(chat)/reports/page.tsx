/**
 * Reports Page — Operational reporting dashboard.
 */
import { auth } from "@/app/(auth)/auth";

const REPORT_LINKS = [
  {
    name: "Billing Overview",
    description: "Billing queue status, recovery rates, revenue summary",
  },
  {
    name: "Enrollment Pipeline",
    description: "Lead flow, conversion rates, enrollment status",
  },
  {
    name: "Agent Performance",
    description: "Call outcomes, response times, resolution rates",
  },
  {
    name: "System Health",
    description: "Service uptime, error rates, latency p50/p95/p99",
  },
  {
    name: "Communications",
    description: "Slack messages, emails, SMS, call logs",
  },
];

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="p-8 text-muted-foreground">Sign in to view reports.</div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <h1 className="text-lg font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Operational reporting from Base44 reporting hub.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-3">
          {REPORT_LINKS.map((report) => (
            <div
              className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors cursor-pointer"
              key={report.name}
            >
              <p className="font-medium text-sm">{report.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {report.description}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-2">
                Available via Base44 VPS bridge — use{" "}
                <code className="bg-muted px-1 rounded">reportingHub</code> tool
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
