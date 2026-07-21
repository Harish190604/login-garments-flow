import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardStats } from "@/lib/pos.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, IndianRupee, Receipt, AlertTriangle, Wallet, ShoppingBag, MessageCircle } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatINR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function KpiCard({ label, value, hint, icon: Icon, tone }: { label: string; value: string; hint?: string; icon: any; tone?: "primary" | "success" | "warning" | "destructive" }) {
  const toneBg =
    tone === "success" ? "bg-success/10 text-success"
    : tone === "warning" ? "bg-warning/20 text-warning-foreground"
    : tone === "destructive" ? "bg-destructive/10 text-destructive"
    : "bg-primary/10 text-primary";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
            {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
          </div>
          <div className={`h-10 w-10 rounded-lg grid place-items-center ${toneBg}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const fn = useServerFn(getDashboardStats);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fn() });
  const [waNumber, setWaNumber] = useState("");
  useEffect(() => {
    setWaNumber(localStorage.getItem("admin_wa_number") ?? "");
  }, []);
  const saveWa = (v: string) => { setWaNumber(v); localStorage.setItem("admin_wa_number", v); };

  const buildSummary = () => {
    const today = new Date().toLocaleDateString("en-IN");
    const lines = [
      `*Login Garments — Daily Summary*`,
      `Date: ${today}`,
      ``,
      `Today's Sales: ${formatINR(data?.todaySales ?? 0)}`,
      `Bills: ${data?.todayCount ?? 0}`,
      `This Week: ${formatINR(data?.weekSales ?? 0)}`,
      `This Month: ${formatINR(data?.monthSales ?? 0)}`,
      `Pending Debts: ${formatINR(data?.pendingDebts ?? 0)}`,
    ];
    const low = data?.lowStock ?? [];
    if (low.length > 0) {
      lines.push(``, `⚠️ Low stock (${low.length}):`);
      low.slice(0, 8).forEach((p: any) => lines.push(`• ${p.name} — ${p.current_stock} left`));
    }
    return lines.join("\n");
  };
  const sendWhatsApp = () => {
    const num = waNumber.replace(/[^\d]/g, "");
    const text = encodeURIComponent(buildSummary());
    const url = num ? `https://wa.me/${num}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview across Madurai & Thondi branches.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={waNumber}
            onChange={(e) => saveWa(e.target.value)}
            placeholder="Admin WhatsApp (e.g. 919876543210)"
            className="w-56"
          />
          <Button onClick={sendWhatsApp} className="bg-success hover:bg-success/90 text-success-foreground">
            <MessageCircle className="h-4 w-4 mr-1" /> Send summary
          </Button>
        </div>
      </div>

      {(data?.lowStock ?? []).length > 0 && (
        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="p-3 flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning-foreground" />
            <span className="font-medium">Low stock reminder:</span>
            <span className="text-muted-foreground">
              {(data?.lowStock ?? []).length} product{(data?.lowStock ?? []).length === 1 ? "" : "s"} at or below minimum.
            </span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Today's Sales" value={formatINR(data?.todaySales ?? 0)} hint={`${data?.todayCount ?? 0} bills`} icon={IndianRupee} tone="primary" />
        <KpiCard label="This Week" value={formatINR(data?.weekSales ?? 0)} icon={TrendingUp} tone="success" />
        <KpiCard label="This Month" value={formatINR(data?.monthSales ?? 0)} icon={Receipt} tone="primary" />
        <KpiCard label="Pending Debts" value={formatINR(data?.pendingDebts ?? 0)} icon={Wallet} tone="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Sales — last 7 days</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.chart ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: any) => formatINR(Number(v))} />
                  <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Low stock</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
            {!isLoading && (data?.lowStock ?? []).length === 0 && <div className="text-sm text-muted-foreground">All good. No low stock.</div>}
            {(data?.lowStock ?? []).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                <div className="min-w-0"><div className="text-sm font-medium truncate">{p.name}</div><div className="text-xs text-muted-foreground">Min {p.minimum_stock}</div></div>
                <Badge variant={p.current_stock === 0 ? "destructive" : "secondary"}>{p.current_stock} left</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> Recent transactions</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead>Method</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(data?.recent ?? []).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.invoice_number}</TableCell>
                  <TableCell>{s.customers?.name ?? "Walk-in"}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{s.payment_method}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-xs">{new Date(s.created_at).toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right font-medium">{formatINR(Number(s.total))}</TableCell>
                </TableRow>
              ))}
              {(data?.recent ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No transactions yet — start selling from Billing.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}