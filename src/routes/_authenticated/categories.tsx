import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCategories, createCategory } from "@/lib/pos.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/categories")({
  component: CategoriesPage,
});

function CategoriesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listCategories);
  const create = useServerFn(createCategory);
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({ queryKey: ["categories"], queryFn: () => list() });
  const m = useMutation({
    mutationFn: (d: any) => create({ data: d }),
    onSuccess: () => { toast.success("Category added"); qc.invalidateQueries({ queryKey: ["categories"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="text-sm text-muted-foreground">Organize your product catalog.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add category</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New category</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); m.mutate({ name: f.get("name"), description: f.get("description") || null }); }} className="space-y-3">
              <div className="space-y-1.5"><Label>Name *</Label><Input name="name" required /></div>
              <div className="space-y-1.5"><Label>Description</Label><Input name="description" /></div>
              <DialogFooter><Button type="submit" disabled={m.isPending}>Save</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-4">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.map((c: any) => (<TableRow key={c.id}><TableCell className="font-medium">{c.name}</TableCell><TableCell className="text-muted-foreground">{c.description ?? "—"}</TableCell></TableRow>))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}