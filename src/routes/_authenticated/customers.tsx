import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCustomers, createCustomer, updateCustomerDebt, deleteCustomer, getMyProfile } from "@/lib/pos.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/customers")({ component: CustomersPage });

function CustomersPage() {
  const qc = useQueryClient();
  const list = useServerFn(listCustomers);
  const create = useServerFn(createCustomer);
  const editDebt = useServerFn(updateCustomerDebt);
  const del = useServerFn(deleteCustomer);
  const me = useServerFn(getMyProfile);
  const [open, setOpen] = useState(false);
  const [debtRow, setDebtRow] = useState<any>(null);
  const { data = [] } = useQuery({ queryKey: ["customers"], queryFn: () => list() });
  const { data: profile } = useQuery({ queryKey: ["me"], queryFn: () => me() });

  const m = useMutation({
    mutationFn: (d: any) => create({ data: d }),
    onSuccess: () => { toast.success("Customer added"); qc.invalidateQueries({ queryKey: ["customers"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const mDebt = useMutation({
    mutationFn: (d: any) => editDebt({ data: d }),
    onSuccess: () => { toast.success("Debt updated"); qc.invalidateQueries({ queryKey: ["customers"] }); setDebtRow(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Customer archived"); qc.invalidateQueries({ queryKey: ["customers"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const isAdmin = profile?.is_admin;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">Profiles, loyalty points and outstanding debt.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add customer</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New customer</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              m.mutate({ name: f.get("name"), phone: f.get("phone") || null, email: f.get("email") || null, address: f.get("address") || null });
            }} className="space-y-3">
              <div className="space-y-1.5"><Label>Name *</Label><Input name="name" required /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input name="phone" /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input name="email" type="email" /></div>
              <div className="space-y-1.5"><Label>Address</Label><Input name="address" /></div>
              <DialogFooter><Button type="submit" disabled={m.isPending}>Save</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Loyalty</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.length === 0 && (
                  <TableRow><TableCell colSpan={6}>
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                      <Users className="h-8 w-8 text-muted-foreground" />
                      <div className="text-sm">No customers yet.</div>
                    </div>
                  </TableCell></TableRow>
                )}
                {data.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.phone ?? "—"}</TableCell>
                    <TableCell>{c.email ?? "—"}</TableCell>
                    <TableCell className="text-right"><Badge variant="secondary">{c.loyalty_points} pts</Badge></TableCell>
                    <TableCell className="text-right">
                      {Number(c.outstanding_debt) > 0
                        ? <Badge variant="destructive">{formatINR(Number(c.outstanding_debt))}</Badge>
                        : <span className="text-xs text-muted-foreground">Clear</span>}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => setDebtRow(c)} title="Edit debt"><Pencil className="h-3.5 w-3.5" /></Button>
                      {isAdmin && (
                        <Button size="sm" variant="ghost" className="text-destructive" title="Archive"
                          onClick={() => confirm(`Archive ${c.name}?`) && mDel.mutate(c.id)}>
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

      <Dialog open={!!debtRow} onOpenChange={(v) => !v && setDebtRow(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit outstanding debt · {debtRow?.name}</DialogTitle></DialogHeader>
          {debtRow && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              mDebt.mutate({ id: debtRow.id, outstanding_debt: Number(f.get("amount") ?? 0) });
            }} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Outstanding debt (₹)</Label>
                <Input name="amount" type="number" step="0.01" min="0" defaultValue={Number(debtRow.outstanding_debt ?? 0)} required />
                <p className="text-xs text-muted-foreground">Set to 0 to mark the customer as fully paid.</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => mDebt.mutate({ id: debtRow.id, outstanding_debt: 0 })}>Mark paid</Button>
                <Button type="submit" disabled={mDebt.isPending}>Save</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
