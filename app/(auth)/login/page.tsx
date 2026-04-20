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

  const proofPoints = ["Secure sign-in", "Risk-first workflow", "Metrics-aware execution"];

  const spotlightCards = [
    {
      label: "Why it feels different",
      value: "Sharper hierarchy, calmer surfaces, faster scanning.",
    },
    {
      label: "Inside the workspace",
      value: "Guided trade reviews, mode-aware metrics, and structured execution checkpoints.",
    },
  ];

  const handleEmailLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (!canUseSupabase) {
      setError("Supabase environment variables are not configured.");
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to sign in right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    if (!canUseSupabase) {
      setError("Supabase environment variables are not configured.");
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        return;
      }
    } catch {
      setError("Unable to start Google sign in right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 py-10 sm:px-10 lg:py-14 xl:px-12">
      <div className="grid w-full gap-6 md:grid-cols-[minmax(0,0.96fr)_minmax(360px,0.94fr)] xl:grid-cols-[minmax(0,1.08fr)_minmax(430px,0.92fr)] xl:gap-8">
        <section className="space-y-6">
          <div className="auth-masthead p-6 md:hidden">
            <p className="fin-chip">Secure Access</p>
            <h1 className="font-display mt-5 max-w-2xl text-[2.5rem] font-semibold leading-[0.92] text-tds-text sm:text-[3.2rem]">
              Sign in with a calmer operating surface and a sharper decision rhythm.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-tds-dim">
              Review risk, move through guided workflows, and get back to disciplined execution without the usual dashboard clutter.
            </p>
          </div>

          <section className="fin-hero hidden h-full p-7 md:block lg:p-8 xl:p-10">
            <p className="fin-chip border-white/20 bg-white/10 text-white/80">Secure Access</p>
            <h1 className="font-display mt-6 max-w-xl text-[2.9rem] font-semibold leading-[0.92] text-white lg:text-[3.5rem] xl:text-[4.2rem]">
              Return to the Intelligent Investors workspace.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/76 xl:text-[1.02rem]">
              Review active risk, move through Intelligent Trading System workflows, and keep the product centered on disciplined execution rather than dashboard clutter.
            </p>
            <div className="mt-8 grid gap-4">
              {spotlightCards.map((card) => (
                <div key={card.label} className="auth-spotlight-card">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/58">{card.label}</p>
                  <p className="mt-2 text-lg font-semibold leading-7 text-white">{card.value}</p>
                </div>
              ))}
            </div>
          </section>
        </section>

        <Card className="auth-form-card w-full max-w-[560px] justify-self-end">
          <CardHeader className="relative z-[1] pb-5">
            <div className="auth-proof-row">
              {proofPoints.map((item) => (
                <span key={item} className="auth-proof-pill">{item}</span>
              ))}
            </div>
            <p className="fin-kicker mt-6">Login</p>
            <CardTitle className="font-display mt-1 max-w-md text-[2.45rem] sm:text-[3rem]">Sign back into your workspace.</CardTitle>
            <CardDescription className="max-w-md text-[0.98rem] leading-7">
              Use your email and password, or continue with Google if OAuth is enabled for your environment.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-[1]">
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
              <Button type="submit" size="lg" className="w-full" disabled={loading || !canUseSupabase}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={handleGoogleLogin}
                disabled={loading || !canUseSupabase}
              >
                Continue with Google
              </Button>
            </div>

            <p className="auth-note pt-1">
              Google sign-in opens the provider flow in your browser. If this workspace is local-only, email and password is the most direct path back in.
            </p>

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