"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const router = useRouter();
  const canUseSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!canUseSupabase) {
      setError("Supabase environment variables are not configured.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError("Account created. Please check your inbox to confirm your email before signing in.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-12 sm:px-10 lg:py-16">
      <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <section className="fin-panel hidden p-8 lg:block">
          <p className="fin-kicker">Create Account</p>
          <h1 className="mt-3 max-w-xl text-5xl font-semibold tracking-[-0.06em] text-tds-text">Start with a cleaner trading workflow from day one.</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-tds-dim">
            The Intelligent Trading System is built to enforce evidence, sizing discipline, and execution checkpoints before a trade reaches your book.
          </p>
          <div className="mt-8 space-y-4">
            <div className="fin-card p-5">
              <p className="fin-kicker">Includes</p>
              <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-tds-text">Mode-based metrics, AI-assisted assessment, and structured journaling.</p>
            </div>
            <div className="fin-card p-5">
              <p className="fin-kicker">Designed For</p>
              <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-tds-text">Investors, swing traders, day traders, and scalpers who want process before impulse.</p>
            </div>
          </div>
        </section>

        <Card className="w-full">
          <CardHeader>
            <p className="fin-kicker">Sign Up</p>
            <CardTitle>Create your Intelligent Investors account.</CardTitle>
            <CardDescription>Register with email and password to enter the Intelligent Investors workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-5">
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
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            {error ? (
              <div className="rounded-[20px] border border-tds-red/25 bg-tds-red/10 px-4 py-3 text-sm text-tds-red">{error}</div>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading || !canUseSupabase}>
              {loading ? "Creating account..." : "Create account"}
            </Button>

            <p className="text-center text-sm text-tds-dim">
              Already have an account? <Link className="font-semibold text-tds-blue hover:underline" href="/login">Sign in</Link>
            </p>
          </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}