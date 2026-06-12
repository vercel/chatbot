"use client";
/**
 * Base44 EntityTable result renderer — renders queryEntity output as a dynamic table.
 */
import { DatabaseIcon } from "lucide-react";
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

interface EntityOutput {
  entity?: string;
  count?: number;
  results?: Record<string, unknown>[];
  error?: string;
}

/** Infer columns from the first result record */
function inferColumns(results: Record<string, unknown>[]): string[] {
  if (!results.length) return [];
  const first = results[0];
  // Priority columns + fallback to all keys
  const keys = Object.keys(first);
  const priority = [
    "name",
    "email",
    "stage",
    "mrr",
    "amount",
    "status",
    "created_date",
    "id",
  ];
  const ordered = priority.filter((k) => keys.includes(k));
  const rest = keys.filter((k) => !ordered.includes(k));
  return [...ordered, ...rest].slice(0, 6);
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 60);
  return String(value).slice(0, 80);
}

export default function EntityTable({ output }: { output: EntityOutput }) {
  if (output?.error) {
    return (
      <Card className="border-red-500/20 bg-red-500/5 p-4">
        <p className="text-red-400 text-xs">{output.error}</p>
      </Card>
    );
  }
  const results = output?.results ?? [];
  const columns = inferColumns(results);
  return (
    <Card
      className="border-t-2 overflow-hidden"
      style={{ borderTopColor: "#7C3AED" }}
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-[#7C3AED]/5 border-b">
        <DatabaseIcon className="w-4 h-4 text-[#7C3AED]" />
        <span className="font-medium text-sm text-[#7C3AED]">
          {output?.entity ?? "Entity"}
        </span>
        <Badge className="ml-auto text-[10px]" variant="secondary">
          {output?.count ?? results.length} records
        </Badge>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead className="text-[10px] first:pl-4" key={col}>
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((row, i) => (
            <TableRow key={i}>
              {columns.map((col) => (
                <TableCell
                  className="text-[10px] first:pl-4 font-mono"
                  key={col}
                >
                  {formatCell(row[col])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
