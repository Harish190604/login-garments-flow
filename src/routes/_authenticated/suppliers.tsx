import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier, listBranches, getMyProfile } from "@/lib/pos.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Truck, Pencil, Trash2, Phone, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/suppliers")({
  component: SuppliersPage,
  head: () => ({
    meta: [
      { title: "Suppliers · Login Garments POS" },
      { name: "description", content: "Manage garment suppliers, contact people, phone, email and GSTIN for Madurai and Thondi branches." },
      { property: "og:title", content: "Suppliers · Login Garments POS" },
      { property: "og:description", content: "Supplier directory with contact details for Login Garments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SuppliersPage() {
  const qc = useQueryClient();
  const list = useServerFn(listSuppliers);
  const create = useServerFn(createSupplier);
  const update = useServerFn(updateSupplier);
  const del = useServerFn(deleteSupplier);
  const brs = useServerFn(listBranches);
  const meFn = useServerFn(getMyProfile);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [branchId, setBranchId] = useState<string>("");

  const { data: rows = [], isLoading } = useQuery({ queryKey: ["suppliers"], queryFn: () => list() });
  const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: () => brs() });
  const { data: profile } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });

  const done = (msg: string) => {
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["suppliers"] });
    setOpen(false);
    setEditing(null);
    setBranchId("");
  };
  const mCreate = useMutation({ mutationFn: (d: any) => create({ data: d }), onSuccess: () => done("Supplier added"), onError: (e: any) => toast.error(e.message) });
  const mUpdate = useMutation({ mutationFn: (d: any) => update({ data: d }), onSuccess: () => done("Supplier updated"), onError: (e: any) => toast.error(e.message) });
  const mDel = useMutation({ mutationFn: (id: string) => del({ data: { id } }), onSuccess: () => done("Supplier removed"), onError: (e: any) => toast.error(e.message) });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload = {
      name: String(f.get("name")),
      contact_person: String(f.get("contact_person") || "") || null,
      phone: String(f.get("phone") || "") || null,
      email: String(f.get("email") || "") || null,
      address: String(f.get("address") || "") || null,
      gstin: String(f.get("gstin") || "") || null,
      notes: String(f.get("notes") || "") || null,
      branch_id: branchId || null,
    };
    if (editing) mUpdate.mutate({ id: editing.id, ...payload });
    else mCreate.mutate(payload);
  }

  const canManage = profile?.is_admin || profile?.roles?.includes("manager");

  function openNew() { setEditing(null); setBranchId(""); setOpen(true); }
  function openEdit(s: any) { setEditing(s); setBranchId(s.branch_id ?? ""); setOpen(true); }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Vendor directory with contact details and GSTIN.</p>
        </div>
        {canManage && <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add supplier</Button>}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Contact person</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={7}>
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                      <Truck className="h-8 w-8 text-muted-foreground" />
                      <div className="text-sm font-medium">No suppliers yet</div>
                      <div className="text-xs text-muted-foreground">Add your fabric and garment vendors here.</div>
                    </div>
                  </TableCell></TableRow>
                )}
                {rows.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.name}</div>
                      {s.address && <div className="text-xs text-muted-foreground">{s.address}</div>}
                    </TableCell>
                    <TableCell>{s.contact_person ?? "—"}</TableCell>
                    <TableCell>
                      {s.phone ? <a className="inline-flex items-center gap-1 hover:underline" href={`tel:${s.phone}`}><Phone className="h-3.5 w-3.5" />{s.phone}</a> : "—"}
                    </TableCell>
                    <TableCell>
                      {s.email ? <a className="inline-flex items-center gap-1 hover:underline" href={`mailto:${s.email}`}><Mail className="h-3.5 w-3.5" />{s.email}</a> : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.gstin ?? "—"}</TableCell>
                    <TableCell>{s.branches?.code ?? "All"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {canManage && <Button size="sm" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>}
                      {profile?.is_admin && (
                        <Button size="sm" variant="ghost" className="text-destructive"
                          onClick={() => confirm(`Delete ${s.name}?`) && mDel.mutate(s.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Edit supplier" : "New supplier"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2"><Label>Supplier name *</Label><Input name="name" required defaultValue={editing?.name ?? ""} /></div>
            <div className="space-y-1.5"><Label>Contact person</Label><Input name="contact_person" defaultValue={editing?.contact_person ?? ""} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input name="phone" defaultValue={editing?.phone ?? ""} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input name="email" type="email" defaultValue={editing?.email ?? ""} /></div>
            <div className="space-y-1.5"><Label>GSTIN</Label><Input name="gstin" defaultValue={editing?.gstin ?? ""} /></div>
            <div className="space-y-1.5 col-span-2"><Label>Address</Label><Input name="address" defaultValue={editing?.address ?? ""} /></div>
            <div className="space-y-1.5 col-span-2"><Label>Notes</Label><Input name="notes" defaultValue={editing?.notes ?? ""} /></div>
            <div className="space-y-1.5 col-span-2">
              <Label>Branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue placeholder="All branches" /></SelectTrigger>
                <SelectContent>{branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter className="col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={mCreate.isPending || mUpdate.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
