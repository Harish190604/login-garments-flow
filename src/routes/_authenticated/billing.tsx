import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProducts, listCustomers, listBranches, createSale, getMyProfile } from "@/lib/pos.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, Trash2, Plus, Minus, ShoppingCart, Barcode as BarcodeIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Printer } from "lucide-react";
import logoAsset from "@/assets/login-garments-logo.jpeg.asset.json";

const LOGO_URL = logoAsset.url;
const COMPANY = {
  name: "Login Garments",
  tagline: "Men's Clothing · Madurai & Thondi",
  address: "Madurai · Thondi, Tamil Nadu, India",
  phone: "+91 00000 00000",
  email: "hello@logingarments.in",
  gstin: "GSTIN: 33XXXXX0000X1Z0",
};

export const Route = createFileRoute("/_authenticated/billing")({
  validateSearch: (s: Record<string, unknown>) => ({ scan: typeof s.scan === "string" ? s.scan : undefined }),
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
  const { scan } = Route.useSearch();
  const navigate = Route.useNavigate();
  const listP = useServerFn(listProducts);
  const listC = useServerFn(listCustomers);
  const listB = useServerFn(listBranches);
  const sell = useServerFn(createSale);
  const meFn = useServerFn(getMyProfile);

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
  const searchRef = useRef<HTMLInputElement>(null);
  const scannedRef = useRef<string | null>(null);

  const { data: profile } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const isAdmin = profile?.is_admin ?? true;

  // Non-admin cashiers are locked to their assigned branch.
  useEffect(() => {
    if (profile && !profile.is_admin && profile.branch_id) setBranchId(profile.branch_id);
  }, [profile]);

  const { data: products = [] } = useQuery({
    queryKey: ["pos-products", search, branchId],
    queryFn: () => listP({ data: { search, branchId: branchId || null } }),
  });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: () => listC() });
  const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: () => listB() });

  // Scanned from the Products page: /billing?scan=<barcode> auto-adds the item.
  useEffect(() => {
    if (scan && search !== scan && scannedRef.current !== scan) setSearch(scan);
  }, [scan]);

  useEffect(() => {
    if (!scan || scannedRef.current === scan || search !== scan) return;
    const match = products.find((p: any) => p.barcode === scan || p.sku === scan);
    if (!products.length) return;
    scannedRef.current = scan;
    if (match) {
      addProduct(match);
      toast.success(`${match.name} added to cart`);
    } else {
      toast.error("No product found for that code");
    }
    setSearch("");
    navigate({ search: {}, replace: true });
    setTimeout(() => searchRef.current?.focus(), 0);
  }, [scan, products, search]);

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

  // Barcode scanner: Enter key at the search box adds the exact match.
  function handleScanKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    const exact = products.find((p: any) => p.barcode === q || p.sku === q)
      ?? (products.length === 1 ? products[0] : null);
    if (!exact) { toast.error("No product found for that code"); return; }
    addProduct(exact);
    setSearch("");
    setTimeout(() => searchRef.current?.focus(), 0);
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
            <Input
              ref={searchRef}
              autoFocus
              placeholder="Scan barcode or search products… (press Enter to add)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleScanKey}
              className="pl-9 h-11"
            />
          </div>
          {isAdmin ? (
            <Select value={branchId} onValueChange={(v) => setBranchId(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-40 h-11"><SelectValue placeholder="All branches" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All branches</SelectItem>
                {branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="secondary" className="h-11 px-3 text-sm">
              Branch: {profile?.branch?.name ?? "Unassigned"}
            </Badge>
          )}
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

type PaperSize = "A4" | "Letter" | "Thermal80" | "Thermal58";
const PAPER: Record<PaperSize, { label: string; css: string; widthPx: number }> = {
  A4:        { label: "A4 (210 × 297 mm)",         css: "210mm 297mm",  widthPx: 794 },
  Letter:    { label: "US Letter (8.5 × 11 in)",   css: "215.9mm 279.4mm", widthPx: 816 },
  Thermal80: { label: "Thermal 80 mm",             css: "80mm auto",    widthPx: 302 },
  Thermal58: { label: "Thermal 58 mm",             css: "58mm auto",    widthPx: 220 },
};
type MarginKey = "narrow" | "normal" | "wide" | "none";
const MARGIN: Record<MarginKey, { label: string; mm: number }> = {
  none:   { label: "None",   mm: 0 },
  narrow: { label: "Narrow (5 mm)", mm: 5 },
  normal: { label: "Normal (10 mm)", mm: 10 },
  wide:   { label: "Wide (15 mm)", mm: 15 },
};

function buildReceiptDoc(innerHtml: string, paper: PaperSize, marginMm: number, title: string) {
  const isThermal = paper === "Thermal80" || paper === "Thermal58";
  const bodyFont = isThermal ? 11 : 12;
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title>
    <style>
      @page { size: ${PAPER[paper].css}; margin: ${marginMm}mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: ${bodyFont}px; color: #111; }
      .wrap { padding: 0; }
      .head { display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #111; padding-bottom: 8px; }
      .head img { height: ${isThermal ? 40 : 52}px; width: auto; object-fit: contain; }
      .brand { font-weight: 800; font-size: ${isThermal ? 15 : 18}px; letter-spacing: 0.3px; }
      .muted { color: #555; font-size: 10.5px; }
      .title { text-align: center; margin: 10px 0 6px; font-weight: 700; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: 11px; margin-bottom: 8px; }
      .meta b { color: #111; }
      table { width: 100%; border-collapse: collapse; margin-top: 4px; }
      th { background: #111; color: #fff; text-align: left; padding: 6px 6px; font-size: 11px; font-weight: 600; }
      td { padding: 5px 6px; font-size: 11px; border-bottom: 1px solid #eee; }
      th:last-child, td:last-child, th.num, td.num { text-align: right; }
      .totals { margin-top: 8px; margin-left: auto; width: ${isThermal ? 100 : 55}%; font-size: 11.5px; }
      .totals .row { display: flex; justify-content: space-between; padding: 3px 0; }
      .totals .grand { border-top: 1.5px solid #111; border-bottom: 1.5px solid #111; margin-top: 4px; padding: 6px 0; font-size: 13px; font-weight: 800; }
      .pay { margin-top: 10px; padding: 8px; background: #f6f6f6; border-radius: 4px; font-size: 11px; }
      .pay .row { display: flex; justify-content: space-between; padding: 2px 0; }
      .foot { text-align: center; margin-top: 14px; padding-top: 8px; border-top: 1px dashed #999; font-size: 10.5px; color: #555; }
      .foot b { color: #111; display: block; margin-bottom: 2px; font-size: 12px; }
    </style></head><body><div class="wrap">${innerHtml}</div></body></html>`;
}

function ReceiptDialog({ open, onOpenChange, data }: { open: boolean; onOpenChange: (v: boolean) => void; data: any }) {
  const [paper, setPaper] = useState<PaperSize>("A4");
  const [margin, setMargin] = useState<MarginKey>("normal");
  if (!data) return null;
  const { sale, items, customer, branch } = data;

  function getPrintDoc() {
    const node = document.getElementById("receipt-print");
    if (!node) return "";
    const logoAbs = `${window.location.origin}${LOGO_URL}`;
    const html = node.innerHTML.split(LOGO_URL).join(logoAbs);
    return buildReceiptDoc(html, paper, MARGIN[margin].mm, `Invoice ${sale.invoice_number}`);
  }

  function printReceipt() {
    const doc = getPrintDoc();
    if (!doc) return;
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) return;
    w.document.write(doc);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 350);
  }

  const previewDoc = open ? getPrintDoc() : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Tax Invoice · {sale.invoice_number}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Paper size</Label>
            <Select value={paper} onValueChange={(v) => setPaper(v as PaperSize)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PAPER) as PaperSize[]).map((k) => (
                  <SelectItem key={k} value={k}>{PAPER[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Margins</Label>
            <Select value={margin} onValueChange={(v) => setMargin(v as MarginKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(MARGIN) as MarginKey[]).map((k) => (
                  <SelectItem key={k} value={k}>{MARGIN[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground pb-2">
            Preview below matches the paper size and margins that will be sent to your printer.
          </div>
        </div>

        <div className="rounded-md border bg-muted/40 p-3 max-h-[60vh] overflow-auto flex justify-center">
          <iframe
            title="Print preview"
            srcDoc={previewDoc}
            style={{
              width: `${PAPER[paper].widthPx}px`,
              maxWidth: "100%",
              height: paper === "Thermal58" || paper === "Thermal80" ? 520 : 900,
              background: "white",
              border: "1px solid hsl(var(--border, 0 0% 90%))",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          />
        </div>

        {/* Hidden source used to build the print document */}
        <div id="receipt-print" className="hidden">
          <div className="head">
            <img src={LOGO_URL} alt="Login Garments" />
            <div style={{ flex: 1 }}>
              <div className="brand">{COMPANY.name}</div>
              <div className="muted">{COMPANY.tagline}</div>
              <div className="muted">{branch ? `${branch.name} (${branch.code}) · ` : ""}{COMPANY.phone}</div>
              <div className="muted">{COMPANY.gstin}</div>
            </div>
          </div>
          <div className="title">Tax Invoice</div>
          <div className="meta">
            <div><b>Invoice #:</b> {sale.invoice_number}</div>
            <div style={{ textAlign: "right" }}><b>Date:</b> {new Date(sale.created_at).toLocaleString("en-IN")}</div>
            <div><b>Bill To:</b> {customer?.name || "Walk-in customer"}</div>
            <div style={{ textAlign: "right" }}>{customer?.phone || ""}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th style={{ width: "8%" }}>#</th>
                <th>Item</th>
                <th className="num">Qty</th>
                <th className="num">Rate</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: any, i: number) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{it.product_name}</td>
                  <td className="num">{it.quantity}</td>
                  <td className="num">{formatINR(Number(it.unit_price))}</td>
                  <td className="num">{formatINR(Number(it.line_total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="totals">
            <div className="row"><span>Subtotal</span><span>{formatINR(Number(sale.subtotal))}</span></div>
            <div className="row"><span>GST</span><span>{formatINR(Number(sale.tax))}</span></div>
            {Number(sale.discount) > 0 && <div className="row"><span>Discount</span><span>-{formatINR(Number(sale.discount))}</span></div>}
            <div className="row grand"><span>Grand Total</span><span>{formatINR(Number(sale.total))}</span></div>
          </div>
          <div className="pay">
            <div className="row"><span>Payment Method</span><span style={{ textTransform: "uppercase", fontWeight: 600 }}>{sale.payment_method}</span></div>
            <div className="row"><span>Amount Paid</span><span>{formatINR(Number(sale.paid))}</span></div>
            {Number(sale.balance) > 0.009 && <div className="row" style={{ color: "#b91c1c", fontWeight: 700 }}><span>Balance Due (Debt)</span><span>{formatINR(Number(sale.balance))}</span></div>}
            {Number(sale.balance) < -0.009 && <div className="row"><span>Change Returned</span><span>{formatINR(-Number(sale.balance))}</span></div>}
          </div>
          <div className="foot">
            <b>Thank you for shopping with {COMPANY.name}!</b>
            Goods once sold can be exchanged within 7 days with original invoice.
            <div style={{ marginTop: 4 }}>{COMPANY.email} · {COMPANY.phone}</div>
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