import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: () => (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Reports</h1><p className="text-sm text-muted-foreground">Daily, monthly, GST, profit and branch reports.</p></div>
      <Card><CardContent className="p-10 flex flex-col items-center gap-3 text-center">
        <BarChart3 className="h-8 w-8 text-muted-foreground" />
        <div className="font-medium">Reports coming next</div>
        <div className="text-sm text-muted-foreground max-w-md">PDF export for daily/monthly sales, GST breakdown, branch-wise revenue, profit trends and inventory valuation.</div>
      </CardContent></Card>
    </div>
  ),
});