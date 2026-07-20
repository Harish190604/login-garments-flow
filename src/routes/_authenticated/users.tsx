import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListUsers, adminCreateUser, adminUpdateUser, adminResetPassword, adminDeleteUser } from "@/lib/admin.functions";
import { getMyProfile, listBranches } from "@/lib/pos.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, KeyRound, Trash2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/users")({ component: UsersPage });

function UsersPage() {
  const qc = useQueryClient();
  const me = useServerFn(getMyProfile);
  const list = useServerFn(adminListUsers);
  const brs = useServerFn(listBranches);
  const create = useServerFn(adminCreateUser);
  const update = useServerFn(adminUpdateUser);
  const resetPw = useServerFn(adminResetPassword);
  const del = useServerFn(adminDeleteUser);

  const { data: meData } = useQuery({ queryKey: ["me"], queryFn: () => me() });
  const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: () => brs() });
  const { data: users = [], error } = useQuery({ queryKey: ["users"], queryFn: () => list(), retry: false, enabled: !!meData?.is_admin });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [pwUser, setPwUser] = useState<any>(null);

  const mCreate = useMutation({
    mutationFn: (d: any) => create({ data: d }),
    onSuccess: () => { toast.success("User created"); qc.invalidateQueries({ queryKey: ["users"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const mUpdate = useMutation({
    mutationFn: (d: any) => update({ data: d }),
    onSuccess: () => { toast.success("User updated"); qc.invalidateQueries({ queryKey: ["users"] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const mPw = useMutation({
    mutationFn: (d: any) => resetPw({ data: d }),
    onSuccess: () => { toast.success("Password reset"); setPwUser(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => del({ data: { user_id: id } }),
    onSuccess: () => { toast.success("User removed"); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (meData && !meData.is_admin) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-warning mx-auto" />
        <h1 className="text-xl font-bold">Admin only</h1>
        <p className="text-sm text-muted-foreground">Only admins can manage staff accounts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">Create staff accounts with individual email/password and assign them to a branch.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add user</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New staff account</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const branch_id = String(f.get("branch_id") ?? "");
              mCreate.mutate({
                full_name: String(f.get("full_name") ?? ""),
                email: String(f.get("email") ?? ""),
                password: String(f.get("password") ?? ""),
                role: String(f.get("role") ?? "cashier"),
                branch_id: branch_id === "__none__" ? null : branch_id,
              });
            }} className="space-y-3">
              <div className="space-y-1.5"><Label>Full name *</Label><Input name="full_name" required /></div>
              <div className="space-y-1.5"><Label>Email *</Label><Input name="email" type="email" required /></div>
              <div className="space-y-1.5"><Label>Password * (min 8)</Label><Input name="password" type="password" minLength={8} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Role *</Label>
                  <Select name="role" defaultValue="cashier">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin (full remote access)</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="cashier">Cashier (single branch)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Branch</Label>
                  <Select name="branch_id" defaultValue="__none__">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None (admin) —</SelectItem>
                      {branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button type="submit" disabled={mCreate.isPending}>Create account</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && <Card><CardContent className="p-4 text-sm text-destructive">{(error as Error).message}</CardContent></Card>}

      <Card>
        <CardContent className="p-4">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Branch</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {users.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>{u.roles.map((r: string) => <Badge key={r} className="capitalize mr-1">{r}</Badge>)}</TableCell>
                    <TableCell>{u.branch ? `${u.branch.name} (${u.branch.code})` : <span className="text-muted-foreground text-xs">All branches</span>}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => setEditing(u)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => setPwUser(u)}><KeyRound className="h-3.5 w-3.5" /></Button>
                      {u.id !== meData?.id && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => confirm(`Remove ${u.email}?`) && mDel.mutate(u.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">No users yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit {editing?.email}</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const branch_id = String(f.get("branch_id") ?? "");
              mUpdate.mutate({
                user_id: editing.id,
                full_name: String(f.get("full_name") ?? ""),
                role: String(f.get("role") ?? "cashier"),
                branch_id: branch_id === "__none__" ? null : branch_id,
              });
            }} className="space-y-3">
              <div className="space-y-1.5"><Label>Full name</Label><Input name="full_name" defaultValue={editing.full_name ?? ""} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select name="role" defaultValue={editing.roles[0] ?? "cashier"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="cashier">Cashier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Branch</Label>
                  <Select name="branch_id" defaultValue={editing.branch_id ?? "__none__"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button type="submit" disabled={mUpdate.isPending}>Save</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Password reset */}
      <Dialog open={!!pwUser} onOpenChange={(v) => !v && setPwUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset password · {pwUser?.email}</DialogTitle></DialogHeader>
          {pwUser && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              mPw.mutate({ user_id: pwUser.id, password: String(f.get("password") ?? "") });
            }} className="space-y-3">
              <div className="space-y-1.5"><Label>New password (min 8)</Label><Input name="password" type="password" minLength={8} required /></div>
              <DialogFooter><Button type="submit" disabled={mPw.isPending}>Reset</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
