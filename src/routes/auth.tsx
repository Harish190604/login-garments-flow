import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import logoAsset from "@/assets/login-garments-logo.jpeg.asset.json";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(false);
      return toast.error("Google sign-in failed");
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 text-white" style={{ background: "var(--gradient-primary)" }}>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-black/60 backdrop-blur grid place-items-center overflow-hidden">
            <img src={logoAsset.url} alt="Login Garments" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight">Login Garments</div>
            <div className="text-xs opacity-80">Madurai · Thondi</div>
          </div>
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="text-4xl font-bold leading-tight">Sell faster.<br/>Track everything.</h1>
          <p className="text-white/85">A modern POS & inventory system built for men's clothing retail — barcode billing, branch stock, GST, debts, all in one place.</p>
        </div>
        <div className="text-xs opacity-70">© {new Date().getFullYear()} Login Garments</div>
      </div>
      <div className="flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md border-0 shadow-none lg:border lg:shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl">Staff sign in</CardTitle>
            <CardDescription>Individual staff credentials. New accounts are created by the Admin from the Users page.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </Button>
            </form>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div>
            </div>
            <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
              Continue with Google
            </Button>
            <div className="text-center mt-4 text-xs text-muted-foreground">
              <Link to="/dashboard" className="hover:underline">Back home</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}