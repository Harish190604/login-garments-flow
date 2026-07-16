import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProducts } from "@/lib/pos.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: InventoryPage,
});

function InventoryPage() {
  const fn = useServerFn(listProducts);
  const { data = [] } = useQuery({ queryKey: ["inventory"], queryFn: () => fn({ data: {} }) });

  const totalValue = data.reduce((s: number, p: any) => s + Number(p.purchase_price) * Number(p.current_stock), 0);
  const outCount = data.filter((p: any) => p.current_stock === 0).length;
  const lowCount = data.filter((p: any) => p.current_stock > 0 && p.current_stock <= p.minimum_stock).length;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Inventory</h1><p className="text-sm text-muted-foreground">Stock levels across branches.</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">Total stock value</div><div className="text-2xl font-bold mt-1">{formatINR(totalValue)}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">Low stock items</div><div className="text-2xl font-bold mt-1">{lowCount}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">Out of stock</div><div className="text-2xl font-bold mt-1 text-destructive">{outCount}</div></CardContent></Card>
      </div>
      <Card><CardContent className="p-4">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Product</TableHead><TableHead>Branch</TableHead>
              <TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Min</TableHead>
              <TableHead className="text-right">Value</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((p: any) => {
                const out = p.current_stock === 0;
                const low = !out && p.current_stock <= p.minimum_stock;
                return (
                  <TableRow key={p.id}>
                    <TableCell><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground font-mono">{p.sku}</div></TableCell>
                    <TableCell>{p.branches?.code ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{p.current_stock}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{p.minimum_stock}</TableCell>
                    <TableCell className="text-right">{formatINR(Number(p.purchase_price) * Number(p.current_stock))}</TableCell>
                    <TableCell>{out ? <Badge variant="destructive">Out</Badge> : low ? <Badge variant="secondary">Low</Badge> : <Badge variant="outline">OK</Badge>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent></Card>
    </div>
  );
}