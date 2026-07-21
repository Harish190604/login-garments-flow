import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Users, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [store, setStore] = useState({ name: "Login Garments", address: "", gstin: "", phone: "" });
  const [waNumber, setWaNumber] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? "");
      if (data.user) {
        const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
        setRoles((r ?? []).map((x: any) => x.role));
      }
    })();
    try {
      const s = JSON.parse(localStorage.getItem("store_info") ?? "{}");
      setStore((prev) => ({ ...prev, ...s }));
    } catch {}
    setWaNumber(localStorage.getItem("admin_wa_number") ?? "");
  }, []);

  const isAdmin = roles.includes("admin");
  const saveStore = () => { localStorage.setItem("store_info", JSON.stringify(store)); toast.success("Store info saved"); };
  const saveWa = () => { localStorage.setItem("admin_wa_number", waNumber); toast.success("WhatsApp number saved"); };

  return (
    <div className="space-y-6 max-w-3xl">
      <div><h1 className="text-2xl font-bold tracking-tight">Settings</h1><p className="text-sm text-muted-foreground">Your profile, store info and admin tools.</p></div>

      <Card>
        <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><div className="text-xs uppercase text-muted-foreground">Email</div><div className="font-medium">{email}</div></div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Roles</div>
            <div className="flex gap-2 flex-wrap mt-1">
              {roles.map((r) => <Badge key={r} className="capitalize">{r}</Badge>)}
              {roles.length === 0 && <span className="text-sm text-muted-foreground">None assigned</span>}
            </div>
          </div>
          <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground flex gap-2 items-start">
            <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Passwords, roles and branch assignments are managed by an admin. Contact your admin to change your password.</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Daily WhatsApp summary</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Used by the dashboard's <em>Send summary</em> button. Include country code, digits only (e.g. <code>919876543210</code>).</p>
          <div className="flex gap-2">
            <Input value={waNumber} onChange={(e) => setWaNumber(e.target.value)} placeholder="919876543210" />
            <Button onClick={saveWa}>Save</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Store info</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Store name</Label><Input value={store.name} onChange={(e) => setStore({ ...store, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={store.phone} onChange={(e) => setStore({ ...store, phone: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Address</Label><Input value={store.address} onChange={(e) => setStore({ ...store, address: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>GSTIN</Label><Input value={store.gstin} onChange={(e) => setStore({ ...store, gstin: e.target.value })} /></div>
          <div className="sm:col-span-2"><Button onClick={saveStore}>Save store info</Button></div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Admin controls</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Create staff accounts, assign branches (Madurai / Thondi), reset passwords, or remove users.</p>
            <Button asChild><Link to="/users">Manage users</Link></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}