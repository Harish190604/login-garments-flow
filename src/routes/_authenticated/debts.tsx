import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCustomers } from "@/lib/pos.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/debts")({
  component: DebtsPage,
});

function DebtsPage() {
  const fn = useServerFn(listCustomers);
  const { data = [] } = useQuery({ queryKey: ["customers"], queryFn: () => fn() });
  const owing = data.filter((c: any) => Number(c.outstanding_debt) > 0);
  const total = owing.reduce((s: number, c: any) => s + Number(c.outstanding_debt), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold tracking-tight">Debts</h1><p className="text-sm text-muted-foreground">Customers with outstanding balances.</p></div>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Total outstanding</div><div className="text-xl font-bold">{formatINR(total)}</div></CardContent></Card>
      </div>
      <Card><CardContent className="p-4">
        <Table>
          <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Phone</TableHead><TableHead className="text-right">Debt</TableHead></TableRow></TableHeader>
          <TableBody>
            {owing.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-8 text-sm text-muted-foreground">No pending debts — nice!</TableCell></TableRow>}
            {owing.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.phone ?? "—"}</TableCell>
                <TableCell className="text-right"><Badge variant="destructive">{formatINR(Number(c.outstanding_debt))}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}