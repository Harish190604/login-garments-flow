import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getReports, listSales, deleteSale, getMyProfile } from "@/lib/pos.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { formatINR } from "@/lib/format";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports")({ component: ReportsPage });

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--warning))", "hsl(var(--muted-foreground))"];

function ReportsPage() {
  const qc = useQueryClient();
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 86400000);
  const [from, setFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  const rep = useServerFn(getReports);
  const sales = useServerFn(listSales);
  const del = useServerFn(deleteSale);
  const me = useServerFn(getMyProfile);
  const range = useMemo(() => ({ from: new Date(from).toISOString(), to: new Date(to + "T23:59:59").toISOString() }), [from, to]);

  const { data: report } = useQuery({ queryKey: ["report", range], queryFn: () => rep({ data: range }) });
  const { data: profile } = useQuery({ queryKey: ["me"], queryFn: () => me() });
  const { data: salesList = [] } = useQuery({ queryKey: ["sales", range], queryFn: () => sales({ data: { from: range.from, to: range.to } }) });

  const mDel = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Invoice archived"); qc.invalidateQueries({ queryKey: ["sales"] }); qc.invalidateQueries({ queryKey: ["report"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  function exportCSV() {
    const header = ["Invoice", "Date", "Branch", "Customer", "Method", "Total", "Paid", "Balance", "Status"];
    const rows = salesList.map((s: any) => [
      s.invoice_number,
      new Date(s.created_at).toLocaleString(),
      s.branches?.name ?? "",
      s.customers?.name ?? "",
      s.payment_method,
      s.total, s.paid, s.balance, s.status,
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `sales_${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const t = report?.totals;
  const isAdmin = profile?.is_admin;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground">Sales trends, GST breakdown, branch performance, top products and invoice archive.</p>
        </div>
        <div className="flex items-end gap-2">
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> CSV</Button>
          <Button variant="outline" onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Revenue" value={formatINR(t?.revenue ?? 0)} />
        <Kpi label="Collected" value={formatINR(t?.collected ?? 0)} />
        <Kpi label="Outstanding" value={formatINR(t?.outstanding ?? 0)} tone="warn" />
        <Kpi label="GST" value={formatINR(t?.tax ?? 0)} />
        <Kpi label="Discount" value={formatINR(t?.discount ?? 0)} />
        <Kpi label="Bills" value={String(t?.bills ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardContent className="p-4">
          <div className="text-sm font-medium mb-2">Daily revenue</div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={report?.daily ?? []}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v: any) => formatINR(Number(v))} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm font-medium mb-2">Payment mix</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={report?.byMethod ?? []} dataKey="amount" nameKey="method" outerRadius={90} label>
                {(report?.byMethod ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => formatINR(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardContent className="p-4">
          <div className="text-sm font-medium mb-2">Branch revenue</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={report?.byBranch ?? []}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v: any) => formatINR(Number(v))} />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm font-medium mb-2">Top products</div>
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
            <TableBody>
              {(report?.topProducts ?? []).map((p, i) => (
                <TableRow key={i}><TableCell>{p.name}</TableCell><TableCell className="text-right">{p.qty}</TableCell><TableCell className="text-right">{formatINR(p.revenue)}</TableCell></TableRow>
              ))}
              {(report?.topProducts ?? []).length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-6 text-sm text-muted-foreground">No sales in this period.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium mb-3">Invoice archive</div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Branch</TableHead><TableHead>Customer</TableHead><TableHead>Method</TableHead>
                <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead>
                {isAdmin && <TableHead />}
              </TableRow></TableHeader>
              <TableBody>
                {salesList.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.invoice_number}</TableCell>
                    <TableCell className="text-xs">{new Date(s.created_at).toLocaleString()}</TableCell>
                    <TableCell>{s.branches?.name ?? "—"}</TableCell>
                    <TableCell>{s.customers?.name ?? "Walk-in"}</TableCell>
                    <TableCell className="capitalize">{s.payment_method}</TableCell>
                    <TableCell className="text-right">{formatINR(Number(s.total))}</TableCell>
                    <TableCell className="text-right">{Number(s.balance) > 0 ? <Badge variant="destructive">{formatINR(Number(s.balance))}</Badge> : <span className="text-xs text-muted-foreground">Paid</span>}</TableCell>
                    <TableCell><Badge variant={s.status === "completed" ? "secondary" : "outline"} className="capitalize">{s.status}</Badge></TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="text-destructive"
                          onClick={() => confirm(`Archive invoice ${s.invoice_number}? Any outstanding balance will be reversed on the customer.`) && mDel.mutate(s.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {salesList.length === 0 && <TableRow><TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-8 text-sm text-muted-foreground">No invoices in this range.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={"text-lg font-bold mt-1 " + (tone === "warn" ? "text-warning" : "")}>{value}</div>
    </CardContent></Card>
  );
}
