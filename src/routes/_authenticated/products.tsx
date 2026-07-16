import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProducts, listCategories, listBranches, createProduct } from "@/lib/pos.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Package } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/products")({
  component: ProductsPage,
});

function ProductsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listProducts);
  const cats = useServerFn(listCategories);
  const brs = useServerFn(listBranches);
  const create = useServerFn(createProduct);

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", search],
    queryFn: () => list({ data: { search } }),
  });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: () => cats() });
  const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: () => brs() });

  const mutation = useMutation({
    mutationFn: (data: any) => create({ data }),
    onSuccess: () => {
      toast.success("Product added");
      qc.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    mutation.mutate({
      sku: String(f.get("sku")),
      barcode: String(f.get("barcode") || "") || null,
      name: String(f.get("name")),
      category_id: String(f.get("category_id") || "") || null,
      brand: String(f.get("brand") || "") || null,
      color: String(f.get("color") || "") || null,
      size: String(f.get("size") || "") || null,
      purchase_price: Number(f.get("purchase_price") || 0),
      selling_price: Number(f.get("selling_price") || 0),
      gst_percent: Number(f.get("gst_percent") || 5),
      discount_percent: Number(f.get("discount_percent") || 0),
      current_stock: Number(f.get("current_stock") || 0),
      minimum_stock: Number(f.get("minimum_stock") || 5),
      branch_id: String(f.get("branch_id") || "") || null,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">Manage catalog, pricing, GST and stock.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Add product</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New product</DialogTitle></DialogHeader>
            <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>SKU *</Label><Input name="sku" required /></div>
              <div className="space-y-1.5"><Label>Barcode</Label><Input name="barcode" /></div>
              <div className="space-y-1.5 col-span-2"><Label>Name *</Label><Input name="name" required /></div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select name="category_id"><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <Select name="branch_id"><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Brand</Label><Input name="brand" /></div>
              <div className="space-y-1.5"><Label>Color</Label><Input name="color" /></div>
              <div className="space-y-1.5"><Label>Size</Label><Input name="size" placeholder="S / M / L / 32" /></div>
              <div className="space-y-1.5"><Label>Purchase ₹</Label><Input name="purchase_price" type="number" step="0.01" defaultValue={0} /></div>
              <div className="space-y-1.5"><Label>Selling ₹ *</Label><Input name="selling_price" type="number" step="0.01" required /></div>
              <div className="space-y-1.5"><Label>GST %</Label><Input name="gst_percent" type="number" step="0.01" defaultValue={5} /></div>
              <div className="space-y-1.5"><Label>Discount %</Label><Input name="discount_percent" type="number" step="0.01" defaultValue={0} /></div>
              <div className="space-y-1.5"><Label>Current stock</Label><Input name="current_stock" type="number" defaultValue={0} /></div>
              <div className="space-y-1.5"><Label>Minimum stock</Label><Input name="minimum_stock" type="number" defaultValue={5} /></div>
              <DialogFooter className="col-span-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={mutation.isPending}>Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, SKU or barcode" className="pl-9" />
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Stock</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && products.length === 0 && (
                  <TableRow><TableCell colSpan={6}>
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                      <Package className="h-8 w-8 text-muted-foreground" />
                      <div className="text-sm font-medium">No products yet</div>
                      <div className="text-xs text-muted-foreground">Click "Add product" to create your first item.</div>
                    </div>
                  </TableCell></TableRow>
                )}
                {products.map((p: any) => {
                  const low = p.current_stock <= p.minimum_stock;
                  const out = p.current_stock === 0;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{[p.brand, p.color, p.size].filter(Boolean).join(" · ")}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                      <TableCell>{p.categories?.name ?? "—"}</TableCell>
                      <TableCell>{p.branches?.code ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">{formatINR(Number(p.selling_price))}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={out ? "destructive" : low ? "secondary" : "outline"}>{p.current_stock}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}