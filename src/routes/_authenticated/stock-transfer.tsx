import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBranches, listBranchProducts, transferStock } from "@/lib/pos.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeftRight, Trash2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/stock-transfer")({
  component: StockTransferPage,
});

type Line = { product_id: string; name: string; sku: string; available: number; quantity: number };

function StockTransferPage() {
  const qc = useQueryClient();
  const listB = useServerFn(listBranches);
  const listBP = useServerFn(listBranchProducts);
  const transfer = useServerFn(transferStock);

  const [sourceId, setSourceId] = useState<string>("");
  const [destId, setDestId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");

  const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: () => listB() });
  const { data: srcProducts = [] } = useQuery({
    queryKey: ["branch-products", sourceId],
    queryFn: () => listBP({ data: { branchId: sourceId } }),
    enabled: !!sourceId,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (srcProducts as any[]).filter((p) => !lines.find((l) => l.product_id === p.id));
    if (!q) return list.slice(0, 30);
    return list.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 30);
  }, [srcProducts, search, lines]);

  function addLine(p: any) {
    setLines((prev) => [...prev, { product_id: p.id, name: p.name, sku: p.sku, available: p.current_stock, quantity: 1 }]);
    setSearch("");
  }
  function setQty(id: string, qty: number) {
    setLines((prev) => prev.map((l) => l.product_id === id ? { ...l, quantity: Math.max(1, Math.min(qty || 1, l.available)) } : l));
  }
  function removeLine(id: string) { setLines((prev) => prev.filter((l) => l.product_id !== id)); }

  const mutation = useMutation({
    mutationFn: (payload: any) => transfer({ data: payload }),
    onSuccess: (res: any) => {
      toast.success(`Transferred ${res.transferred} item(s) successfully`);
      setLines([]); setNotes("");
      qc.invalidateQueries({ queryKey: ["branch-products"] });
      qc.invalidateQueries({ queryKey: ["pos-products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message || "Transfer failed"),
  });

  function post() {
    if (!sourceId || !destId) return toast.error("Choose source and destination branches");
    if (sourceId === destId) return toast.error("Source and destination must be different");
    if (lines.length === 0) return toast.error("Add at least one product to transfer");
    mutation.mutate({
      source_branch_id: sourceId,
      dest_branch_id: destId,
      notes: notes || null,
      items: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
    });
  }

  const totalUnits = lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stock Transfer</h1>
        <p className="text-sm text-muted-foreground">Move stock between Madurai and Thondi.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowLeftRight className="h-4 w-4" />Transfer details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">From (source)</Label>
                <Select value={sourceId} onValueChange={(v) => { setSourceId(v); setLines([]); }}>
                  <SelectTrigger><SelectValue placeholder="Choose source branch" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To (destination)</Label>
                <Select value={destId} onValueChange={setDestId}>
                  <SelectTrigger><SelectValue placeholder="Choose destination branch" /></SelectTrigger>
                  <SelectContent>
                    {branches.filter((b: any) => b.id !== sourceId).map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {sourceId && (
              <div className="space-y-2">
                <Label className="text-xs">Add products</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search product by name or SKU…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                {filtered.length > 0 && (
                  <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
                    {filtered.map((p: any) => (
                      <button key={p.id} onClick={() => addLine(p)}
                        className="w-full flex items-center justify-between text-left px-3 py-2 hover:bg-accent">
                        <div>
                          <div className="text-sm font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.sku}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">Stk {p.current_stock}</Badge>
                          <Plus className="h-4 w-4 text-primary" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {srcProducts.length === 0 && (
                  <div className="text-xs text-muted-foreground">No in-stock products at this branch.</div>
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Notes (optional)</Label>
              <Input placeholder="Reason for transfer, vehicle, etc." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Items · {lines.length}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {lines.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">No items yet. Choose a source branch and add products.</div>}
            {lines.map((l) => (
              <div key={l.product_id} className="flex items-center gap-2 p-2 rounded-md border">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{l.name}</div>
                  <div className="text-xs text-muted-foreground">{l.sku} · Available {l.available}</div>
                </div>
                <Input type="number" min={1} max={l.available} value={l.quantity}
                  onChange={(e) => setQty(l.product_id, Number(e.target.value))}
                  className="w-20 h-8" />
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeLine(l.product_id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {lines.length > 0 && (
              <>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total units</span>
                  <span className="font-semibold">{totalUnits}</span>
                </div>
              </>
            )}
            <Button className="w-full" disabled={mutation.isPending || lines.length === 0} onClick={post}>
              {mutation.isPending ? "Transferring…" : "Post transfer"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}