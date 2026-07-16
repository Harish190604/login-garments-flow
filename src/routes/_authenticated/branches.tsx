import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBranches } from "@/lib/pos.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Store } from "lucide-react";

export const Route = createFileRoute("/_authenticated/branches")({
  component: BranchesPage,
});

function BranchesPage() {
  const fn = useServerFn(listBranches);
  const { data = [] } = useQuery({ queryKey: ["branches"], queryFn: () => fn() });
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Branches</h1><p className="text-sm text-muted-foreground">Your retail locations.</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.map((b: any) => (
          <Card key={b.id}><CardContent className="p-5 flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl grid place-items-center text-white" style={{ background: "var(--gradient-primary)" }}><Store className="h-6 w-6" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{b.name} <span className="text-xs text-muted-foreground font-mono">({b.code})</span></div>
              <div className="text-sm text-muted-foreground">{b.address ?? "—"}</div>
              {b.phone && <div className="text-xs text-muted-foreground mt-1">{b.phone}</div>}
            </div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}