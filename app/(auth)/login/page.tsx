"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const canUseSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (!canUseSupabase) {
      setError("Supabase environment variables are not configured.");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    if (!canUseSupabase) {
      setError("Supabase environment variables are not configured.");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-12 sm:px-10 lg:py-16">
      <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <section className="fin-hero hidden p-8 lg:block">
          <p className="fin-chip fin-chip-strong">Secure Access</p>
          <h1 className="mt-6 max-w-xl text-5xl font-semibold tracking-[-0.06em] text-white">Return to the Intelligent Investors workspace.</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/76">
            Review active risk, move through Intelligent Trading System workflows, and keep the product centered on disciplined execution rather than dashboard clutter.
          </p>
          <div className="mt-8 grid gap-4">
            <div className="rounded-[26px] border border-white/14 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Why it feels different</p>
              <p className="mt-2 text-lg font-semibold text-white">Cleaner hierarchy, lower friction, faster scanning.</p>
            </div>
            <div className="rounded-[26px] border border-white/14 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Core stack</p>
              <p className="mt-2 text-lg font-semibold text-white">Supabase auth, guided workflows, metrics-aware risk control.</p>
            </div>
          </div>
        </section>

        <Card className="w-full">
          <CardHeader>
            <p className="fin-kicker">Login</p>
            <CardTitle>Sign in to Intelligent Investors.</CardTitle>
            <CardDescription>Use your email password or continue with Google if OAuth is enabled.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error ? (
              <div className="rounded-[20px] border border-tds-red/25 bg-tds-red/10 px-4 py-3 text-sm text-tds-red">{error}</div>
            ) : null}

            <div className="space-y-3 pt-2">
              <Button type="submit" className="w-full" disabled={loading || !canUseSupabase}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={handleGoogleLogin}
                disabled={loading || !canUseSupabase}
              >
                Continue with Google
              </Button>
            </div>

            <p className="text-center text-sm text-tds-dim">
              No account yet? <Link className="font-semibold text-tds-blue hover:underline" href="/signup">Create one</Link>
            </p>
          </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}