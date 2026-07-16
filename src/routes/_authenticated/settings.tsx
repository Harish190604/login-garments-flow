import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? "");
      if (data.user) {
        const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
        setRoles((r ?? []).map((x: any) => x.role));
      }
    })();
  }, []);

  return (
    <div className="space-y-6 max-w-2xl">
      <div><h1 className="text-2xl font-bold tracking-tight">Settings</h1><p className="text-sm text-muted-foreground">Your profile and access.</p></div>
      <Card>
        <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><div className="text-xs uppercase text-muted-foreground">Email</div><div className="font-medium">{email}</div></div>
          <div><div className="text-xs uppercase text-muted-foreground">Roles</div>
            <div className="flex gap-2 flex-wrap mt-1">{roles.map((r) => <Badge key={r} className="capitalize">{r}</Badge>)}{roles.length === 0 && <span className="text-sm text-muted-foreground">None assigned</span>}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}