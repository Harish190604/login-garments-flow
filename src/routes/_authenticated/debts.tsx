import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCustomers, recordDebtPayment, updateCustomerDebt, getMyProfile } from "@/lib/pos.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/debts")({
  component: DebtsPage,
});

function DebtsPage() {
  const qc = useQueryClient();
  const fn = useServerFn(listCustomers);
  const pay = useServerFn(recordDebtPayment);
  const clearFn = useServerFn(updateCustomerDebt);
  const me = useServerFn(getMyProfile);
  const { data = [] } = useQuery({ queryKey: ["customers"], queryFn: () => fn() });
  const { data: profile } = useQuery({ queryKey: ["me"], queryFn: () => me() });
  const [payRow, setPayRow] = useState<any>(null);

  const mPay = useMutation({
    mutationFn: (d: any) => pay({ data: d }),
    onSuccess: (res: any) => {
      toast.success(`Payment recorded (${res.method.toUpperCase()}) · Remaining ${formatINR(res.remaining)}`);
      qc.invalidateQueries({ queryKey: ["customers"] });
      setPayRow(null);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const mClear = useMutation({
    mutationFn: (id: string) => clearFn({ data: { id, outstanding_debt: 0 } }),
    onSuccess: () => { toast.success("Debt cleared"); qc.invalidateQueries({ queryKey: ["customers"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const owing = data.filter((c: any) => Number(c.outstanding_debt) > 0);
  const total = owing.reduce((s: number, c: any) => s + Number(c.outstanding_debt), 0);
  const isAdmin = profile?.is_admin;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold tracking-tight">Debts</h1><p className="text-sm text-muted-foreground">Customers with outstanding balances.</p></div>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Total outstanding</div><div className="text-xl font-bold">{formatINR(total)}</div></CardContent></Card>
      </div>
      <Card><CardContent className="p-4">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="text-right">Debt</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {owing.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-sm text-muted-foreground">No pending debts — nice!</TableCell></TableRow>}
            {owing.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.phone ?? "—"}</TableCell>
                <TableCell className="text-right"><Badge variant="destructive">{formatINR(Number(c.outstanding_debt))}</Badge></TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="outline" onClick={() => setPayRow(c)}>
                    <Wallet className="h-3.5 w-3.5 mr-1" /> Record payment
                  </Button>
                  {isAdmin && (
                    <Button size="sm" variant="ghost" className="text-success"
                      onClick={() => confirm(`Mark ${c.name}'s debt of ${formatINR(Number(c.outstanding_debt))} as fully cleared?`) && mClear.mutate(c.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark cleared
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={!!payRow} onOpenChange={(v) => !v && setPayRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment · {payRow?.name}</DialogTitle>
          </DialogHeader>
          {payRow && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const amount = Number(f.get("amount") ?? 0);
              const method = String(f.get("method") ?? "cash");
              if (amount <= 0) return toast.error("Enter a valid amount");
              mPay.mutate({ id: payRow.id, amount, method, note: null });
            }} className="space-y-3">
              <div className="rounded-md bg-muted/40 p-3 text-sm flex justify-between">
                <span className="text-muted-foreground">Outstanding</span>
                <span className="font-semibold">{formatINR(Number(payRow.outstanding_debt))}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Amount received (₹) *</Label>
                  <Input name="amount" type="number" step="0.01" min="0.01" max={Number(payRow.outstanding_debt)} defaultValue={Number(payRow.outstanding_debt)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Method *</Label>
                  <Select name="method" defaultValue="cash">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={mPay.isPending}>Confirm payment</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}