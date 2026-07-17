import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProducts, listCustomers, listBranches, createSale } from "@/lib/pos.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, Trash2, Plus, Minus, ShoppingCart, Barcode as BarcodeIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/billing")({
  component: BillingPage,
});

type CartItem = {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  gst_percent: number;
  discount_percent: number;
};

function BillingPage() {
  const qc = useQueryClient();
  const listP = useServerFn(listProducts);
  const listC = useServerFn(listCustomers);
  const listB = useServerFn(listBranches);
  const sell = useServerFn(createSale);

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paid, setPaid] = useState<string>("");
  const [discount, setDiscount] = useState<string>("0");
  const [cashAmt, setCashAmt] = useState<string>("");
  const [upiAmt, setUpiAmt] = useState<string>("");
  const [cardAmt, setCardAmt] = useState<string>("");
  const [lastSale, setLastSale] = useState<any>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["pos-products", search, branchId],
    queryFn: () => listP({ data: { search, branchId: branchId || null } }),
  });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: () => listC() });
  const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: () => listB() });

  const isSplit = paymentMethod.includes("+");
  const splitParts = isSplit ? paymentMethod.split("+") : [];
  const splitPaid = isSplit
    ? splitParts.reduce((s, p) => s + (Number(p === "cash" ? cashAmt : p === "upi" ? upiAmt : cardAmt) || 0), 0)
    : Number(paid) || 0;

  const totals = useMemo(() => {
    let sub = 0, tax = 0;
    cart.forEach((it) => {
      const gross = it.unit_price * it.quantity;
      const afterDisc = gross * (1 - it.discount_percent / 100);
      const gstAmt = afterDisc * (it.gst_percent / 100);
      sub += afterDisc;
      tax += gstAmt;
    });
    const disc = Number(discount) || 0;
    const total = sub + tax - disc;
    const paidNow = isSplit
      ? splitParts.reduce((s, p) => s + (Number(p === "cash" ? cashAmt : p === "upi" ? upiAmt : cardAmt) || 0), 0)
      : Number(paid) || 0;
    const balance = total - paidNow;
    return { sub, tax, disc, total, balance };
  }, [cart, discount, paid, cashAmt, upiAmt, cardAmt, paymentMethod]);

  function addProduct(p: any) {
    if (p.current_stock <= 0) return toast.error("Out of stock");
    setCart((prev) => {
      const existing = prev.find((c) => c.product_id === p.id);
      if (existing) {
        return prev.map((c) => c.product_id === p.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, {
        product_id: p.id,
        product_name: p.name,
        sku: p.sku,
        quantity: 1,
        unit_price: Number(p.selling_price),
        gst_percent: Number(p.gst_percent),
        discount_percent: Number(p.discount_percent || 0),
      }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart((p) => p.flatMap((c) => c.product_id === id ? (c.quantity + delta <= 0 ? [] : [{ ...c, quantity: c.quantity + delta }]) : [c]));
  }
  function removeItem(id: string) { setCart((p) => p.filter((c) => c.product_id !== id)); }

  const mutation = useMutation({
    mutationFn: (data: any) => sell({ data }),
    onSuccess: (res: any) => {
      toast.success(`Sale complete — ${res.sale.invoice_number}`);
      const cust = customers.find((c: any) => c.id === customerId);
      const branch = branches.find((b: any) => b.id === branchId);
      setLastSale({ sale: res.sale, items: res.items, customer: cust, branch });
      setReceiptOpen(true);
      setCart([]); setPaid(""); setCashAmt(""); setUpiAmt(""); setCardAmt(""); setDiscount("0"); setCustomerId("");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["pos-products"] });
    },
    onError: (e: any) => toast.error(e.message || "Sale failed"),
  });

  function checkout() {
    if (cart.length === 0) return toast.error("Cart is empty");
    const paidNum = isSplit ? splitPaid : Number(paid) || 0;
    if (isSplit && paidNum <= 0) return toast.error("Enter split payment amounts");
    mutation.mutate({
      branch_id: branchId || null,
      customer_id: customerId || null,
      payment_method: paymentMethod,
      paid: paidNum,
      discount: Number(discount) || 0,
      items: cart.map((it) => ({ ...it })),
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[calc(100vh-8rem)]">
      {/* Products */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input autoFocus placeholder="Scan barcode or search products…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-11" />
          </div>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-40 h-11"><SelectValue placeholder="All branches" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All branches</SelectItem>
              {branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {products.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center gap-2 text-center text-muted-foreground">
              <BarcodeIcon className="h-8 w-8" />
              <div className="text-sm">No products match — add some in Products, then scan or search here.</div>
            </div>
          )}
          {products.map((p: any) => {
            const out = p.current_stock <= 0;
            return (
              <button
                key={p.id}
                onClick={() => addProduct(p)}
                disabled={out}
                className="text-left rounded-xl border bg-card p-3 hover:border-primary hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="aspect-square rounded-lg mb-2 grid place-items-center text-3xl font-bold text-primary/40" style={{ background: "var(--gradient-subtle)" }}>
                  {p.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground truncate">{p.sku}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-bold text-sm">{formatINR(Number(p.selling_price))}</span>
                  <Badge variant={out ? "destructive" : "outline"} className="text-[10px]">Stk {p.current_stock}</Badge>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cart */}
      <Card className="lg:sticky lg:top-20 self-start">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Cart · {cart.length}</CardTitle>
          {cart.length > 0 && <Button size="sm" variant="ghost" onClick={() => setCart([])}>Clear</Button>}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-h-64 overflow-y-auto space-y-2 -mx-1 px-1">
            {cart.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Empty cart — tap a product to add.</div>}
            {cart.map((it) => (
              <div key={it.product_id} className="flex items-center gap-2 p-2 rounded-md border">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{it.product_name}</div>
                  <div className="text-xs text-muted-foreground">{formatINR(it.unit_price)} · GST {it.gst_percent}%</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(it.product_id, -1)}><Minus className="h-3 w-3" /></Button>
                  <span className="w-6 text-center text-sm font-medium">{it.quantity}</span>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(it.product_id, 1)}><Plus className="h-3 w-3" /></Button>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeItem(it.product_id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Walk-in customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} {c.phone && `· ${c.phone}`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Payment</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="cash+upi">Cash + UPI</SelectItem>
                  <SelectItem value="cash+card">Cash + Card</SelectItem>
                  <SelectItem value="upi+card">UPI + Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Discount ₹</Label>
              <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
          </div>

          {isSplit && (
            <div className="grid grid-cols-3 gap-2">
              {splitParts.map((p) => (
                <div key={p} className="space-y-1">
                  <Label className="text-xs capitalize">{p} ₹</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={p === "cash" ? cashAmt : p === "upi" ? upiAmt : cardAmt}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (p === "cash") setCashAmt(v);
                      else if (p === "upi") setUpiAmt(v);
                      else setCardAmt(v);
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          <Separator />

          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINR(totals.sub)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>{formatINR(totals.tax)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>-{formatINR(totals.disc)}</span></div>
            <div className="flex justify-between text-lg font-bold pt-1 border-t"><span>Total</span><span>{formatINR(totals.total)}</span></div>
          </div>

          {!isSplit && (
            <div className="space-y-1">
              <Label className="text-xs">Paid ₹</Label>
              <Input type="number" step="0.01" placeholder={formatINR(totals.total)} value={paid} onChange={(e) => setPaid(e.target.value)} />
            </div>
          )}
          {totals.balance > 0.009 && (
            <div className="text-xs text-warning-foreground bg-warning/15 px-2 py-1 rounded">
              Remaining {formatINR(totals.balance)} will be recorded as debt{customerId ? "" : " — select a customer to track it"}.
            </div>
          )}
          {totals.balance < -0.009 && (
            <div className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">Change to return: {formatINR(-totals.balance)}</div>
          )}

          <Button className="w-full h-11 text-base" disabled={cart.length === 0 || mutation.isPending} onClick={checkout}>
            {mutation.isPending ? "Processing…" : `Charge ${formatINR(totals.total)}`}
          </Button>
        </CardContent>
      </Card>

      <ReceiptDialog open={receiptOpen} onOpenChange={setReceiptOpen} data={lastSale} />
    </div>
  );
}

function ReceiptDialog({ open, onOpenChange, data }: { open: boolean; onOpenChange: (v: boolean) => void; data: any }) {
  if (!data) return null;
  const { sale, items, customer, branch } = data;

  function printReceipt() {
    const node = document.getElementById("receipt-print");
    if (!node) return;
    const w = window.open("", "_blank", "width=380,height=640");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${sale.invoice_number}</title>
      <style>
        @page { margin: 8mm; }
        body { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: #000; }
        h1,h2,h3,p { margin: 0; }
        .center { text-align: center; }
        .row { display: flex; justify-content: space-between; gap: 8px; }
        .sep { border-top: 1px dashed #000; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 2px 0; font-size: 11px; }
        th:last-child, td:last-child { text-align: right; }
        .total { font-size: 14px; font-weight: 700; }
      </style></head><body>${node.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 250);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Receipt · {sale.invoice_number}</DialogTitle>
        </DialogHeader>
        <div id="receipt-print" className="text-xs font-mono">
          <div className="center" style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Login Garments</h2>
            {branch && <p>{branch.name} ({branch.code})</p>}
            <p>GST Invoice</p>
          </div>
          <div className="sep" />
          <div className="row"><span>Invoice</span><span>{sale.invoice_number}</span></div>
          <div className="row"><span>Date</span><span>{new Date(sale.created_at).toLocaleString("en-IN")}</span></div>
          {customer && <div className="row"><span>Customer</span><span>{customer.name}</span></div>}
          <div className="sep" />
          <table>
            <thead><tr><th>Item</th><th>Qty</th><th>Amt</th></tr></thead>
            <tbody>
              {items.map((it: any, i: number) => (
                <tr key={i}>
                  <td>{it.product_name}</td>
                  <td>{it.quantity}</td>
                  <td>{formatINR(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="sep" />
          <div className="row"><span>Subtotal</span><span>{formatINR(Number(sale.subtotal))}</span></div>
          <div className="row"><span>GST</span><span>{formatINR(Number(sale.tax))}</span></div>
          {Number(sale.discount) > 0 && <div className="row"><span>Discount</span><span>-{formatINR(Number(sale.discount))}</span></div>}
          <div className="row total"><span>Total</span><span>{formatINR(Number(sale.total))}</span></div>
          <div className="sep" />
          <div className="row"><span>Payment</span><span style={{ textTransform: "uppercase" }}>{sale.payment_method}</span></div>
          <div className="row"><span>Paid</span><span>{formatINR(Number(sale.paid))}</span></div>
          {Number(sale.balance) > 0 && <div className="row"><span>Balance (Debt)</span><span>{formatINR(Number(sale.balance))}</span></div>}
          <div className="sep" />
          <div className="center" style={{ textAlign: "center" }}>
            <p>Thank you for shopping!</p>
            <p>Visit again</p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={printReceipt}><Printer className="h-4 w-4 mr-2" />Print Bill</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}