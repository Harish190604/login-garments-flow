import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeftRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/stock-transfer")({
  component: () => (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Stock Transfer</h1><p className="text-sm text-muted-foreground">Move stock between Madurai and Thondi.</p></div>
      <Card><CardContent className="p-10 flex flex-col items-center gap-3 text-center">
        <ArrowLeftRight className="h-8 w-8 text-muted-foreground" />
        <div className="font-medium">Coming next</div>
        <div className="text-sm text-muted-foreground max-w-md">Stock transfer workflow — select source, destination, products, quantities and post the transfer with automatic inventory adjustment.</div>
      </CardContent></Card>
    </div>
  ),
});