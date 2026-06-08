"use client";
/**
 * NMI TransactionList result renderer — renders queryTransactions output as a table.
 */
import {
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  XCircleIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface NmiTransaction {
  transaction_id?: string;
  amount?: string;
  condition?: string;
  cc_number?: string;
  date?: string;
  response_code?: string;
  response_text?: string;
}

interface TransactionOutput {
  transactions?: NmiTransaction[];
  count?: number;
  error?: string;
}

const statusConfig: Record<
  string,
  { icon: typeof CheckCircleIcon; label: string; color: string }
> = {
  complete: {
    icon: CheckCircleIcon,
    label: "Complete",
    color: "text-green-500",
  },
  pending: { icon: ClockIcon, label: "Pending", color: "text-yellow-500" },
  failed: { icon: XCircleIcon, label: "Failed", color: "text-red-500" },
};

export default function TransactionList({
  output,
}: {
  output: TransactionOutput;
}) {
  if (output?.error) {
    return (
      <Card className="border-red-500/20 bg-red-500/5 p-4">
        <p className="text-red-400 text-xs">{output.error}</p>
      </Card>
    );
  }
  const txns = output?.transactions ?? [];
  return (
    <Card
      className="border-t-2 overflow-hidden"
      style={{ borderTopColor: "#003B5C" }}
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-[#003B5C]/5 border-b">
        <CreditCardIcon className="w-4 h-4 text-[#003B5C]" />
        <span className="font-medium text-sm text-[#003B5C]">
          {txns.length} transactions
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[10px]">Date</TableHead>
            <TableHead className="text-[10px]">Txn ID</TableHead>
            <TableHead className="text-[10px]">Card</TableHead>
            <TableHead className="text-[10px] text-right">Amount</TableHead>
            <TableHead className="text-[10px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {txns.map((txn, i) => {
            const cfg = statusConfig[txn.condition ?? ""] ?? {
              icon: ClockIcon,
              label: txn.condition ?? "unknown",
              color: "text-muted-foreground",
            };
            const Icon = cfg.icon;
            const last4 = txn.cc_number?.slice(-4) || "----";
            return (
              <TableRow key={txn.transaction_id || i}>
                <TableCell className="text-[10px] text-muted-foreground">
                  {txn.date ?? "-"}
                </TableCell>
                <TableCell className="text-[10px] font-mono">
                  {txn.transaction_id?.slice(0, 12) ?? "-"}
                </TableCell>
                <TableCell className="text-[10px]">••{last4}</TableCell>
                <TableCell className="text-[10px] text-right font-medium">
                  ${txn.amount ?? "0.00"}
                </TableCell>
                <TableCell>
                  <Badge
                    className={cn("gap-1 text-[9px]", cfg.color)}
                    variant="secondary"
                  >
                    <Icon className="w-2.5 h-2.5" />
                    {cfg.label}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
