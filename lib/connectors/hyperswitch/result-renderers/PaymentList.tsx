"use client";
/**
 * Hyperswitch PaymentList result renderer — renders listPayments output with NMI connector chip.
 */
import { ZapIcon } from "lucide-react";
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

interface HSPayment {
  payment_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  connector?: string;
  created?: string;
}

interface PaymentOutput {
  payments?: HSPayment[];
  count?: number;
  error?: string;
}

const statusMap: Record<string, { color: string; label: string }> = {
  succeeded: { color: "text-green-500", label: "Succeeded" },
  failed: { color: "text-red-500", label: "Failed" },
  processing: { color: "text-yellow-500", label: "Processing" },
  requires_payment_method: { color: "text-orange-500", label: "Action Needed" },
};

export default function PaymentList({ output }: { output: PaymentOutput }) {
  if (output?.error) {
    return (
      <Card className="border-red-500/20 bg-red-500/5 p-4">
        <p className="text-red-400 text-xs">{output.error}</p>
      </Card>
    );
  }
  const payments = output?.payments ?? [];
  return (
    <Card
      className="border-t-2 overflow-hidden"
      style={{ borderTopColor: "#006FEE" }}
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-[#006FEE]/5 border-b">
        <ZapIcon className="w-4 h-4 text-[#006FEE]" />
        <span className="font-medium text-sm text-[#006FEE]">
          {payments.length} payments
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[10px]">Payment ID</TableHead>
            <TableHead className="text-[10px] text-right">Amount</TableHead>
            <TableHead className="text-[10px]">Status</TableHead>
            <TableHead className="text-[10px]">Connector</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p, i) => {
            const st = statusMap[p.status ?? ""] ?? {
              color: "text-muted-foreground",
              label: p.status ?? "unknown",
            };
            return (
              <TableRow key={p.payment_id || i}>
                <TableCell className="text-[10px] font-mono">
                  {p.payment_id?.slice(0, 16) ?? "-"}
                </TableCell>
                <TableCell className="text-[10px] text-right font-medium">
                  {(p.amount ?? 0) / 100} {p.currency ?? "USD"}
                </TableCell>
                <TableCell>
                  <Badge
                    className={cn("gap-1 text-[9px]", st.color)}
                    variant="secondary"
                  >
                    {st.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className="text-[9px] gap-1" variant="outline">
                    <ZapIcon className="w-2.5 h-2.5" />
                    {p.connector ?? "nmi"}
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
