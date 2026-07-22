import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listExpenses, createExpense, deleteExpense, getExpenseStats, listBranches, getMyProfile } from "@/lib/pos.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Receipt, TrendingDown, Calendar, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const CATEGORIES = ["Electricity", "Rent", "Employee Salary", "Tea & Coffee", "Water", "Internet", "Phone", "Transport", "Maintenance", "Cleaning", "Stationery", "Marketing", "Miscellaneous"];
const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#14b8a6"];

export const Route = createFileRoute("/_authenticated/expenses")({
  component: ExpensesPage,
});

function ExpensesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listExpenses);
  const createFn = useServerFn(createExpense);
  const delFn = useServerFn(deleteExpense);
  const statsFn = useServerFn(getExpenseStats);
  const brFn = useServerFn(listBranches);
  const meFn = useServerFn(getMyProfile);

  const [open, setOpen] = useState(false);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const { data: expenses = [] } = useQuery({ queryKey: ["expenses"], queryFn: () => listFn() });
  const { data: stats } = useQuery({ queryKey: ["expense-stats"], queryFn: () => statsFn() });
  const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: () => brFn() });

  const create = useMutation({
    mutationFn: (d: any) => createFn({ data: d }),
    onSuccess: () => {
      toast.success("Expense recorded");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expense-stats"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expense-stats"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    create.mutate({
      category: String(f.get("category")),
      description: String(f.get("description") || "") || null,
      amount: Number(f.get("amount") || 0),
      spent_on: String(f.get("spent_on")),
      branch_id: String(f.get("branch_id") || "") || null,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">Track daily, weekly and monthly spending across your branches.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Add expense</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record expense</DialogTitle></DialogHeader>
            <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Category *</Label>
                <Select name="category" defaultValue="Electricity">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Amount ₹ *</Label><Input name="amount" type="number" step="0.01" required /></div>
              <div className="space-y-1.5"><Label>Date *</Label><Input name="spent_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
              {me?.is_admin && (
                <div className="space-y-1.5 col-span-2">
                  <Label>Branch</Label>
                  <Select name="branch_id"><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5 col-span-2"><Label>Notes</Label><Input name="description" placeholder="e.g. April electricity bill" /></div>
              <DialogFooter className="col-span-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={create.isPending}>Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={<Calendar className="h-5 w-5" />} label="Today" value={formatINR(stats?.today ?? 0)} />
        <KpiCard icon={<TrendingDown className="h-5 w-5" />} label="Last 7 days" value={formatINR(stats?.week ?? 0)} />
        <KpiCard icon={<Wallet className="h-5 w-5" />} label="This month" value={formatINR(stats?.month ?? 0)} />
        <KpiCard icon={<Receipt className="h-5 w-5" />} label="Entries" value={String(expenses.length)} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Monthly trend (last 6 months)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.byMonth ?? []}>
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: any) => formatINR(Number(v))} />
                <Bar dataKey="amount" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">This month by category</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats?.byCategory ?? []} dataKey="amount" nameKey="category" outerRadius={90} label>
                  {(stats?.byCategory ?? []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => formatINR(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent expenses</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead />
              </TableRow></TableHeader>
              <TableBody>
                {expenses.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">No expenses recorded yet.</TableCell></TableRow>
                )}
                {expenses.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.spent_on}</TableCell>
                    <TableCell><span className="text-sm font-medium">{e.category}</span></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.description || "—"}</TableCell>
                    <TableCell className="text-xs">{e.branches?.name ?? "—"}</TableCell>
                    <TableCell className="text-right font-semibold">{formatINR(Number(e.amount))}</TableCell>
                    <TableCell className="text-right">
                      {me?.is_admin && (
                        <Button size="icon" variant="ghost" onClick={() => del.mutate(e.id)}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">{icon}</div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}