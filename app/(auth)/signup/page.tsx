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

  const proofPoints = ["Secure workspace", "Mode-based setup", "Structured onboarding"];

  const spotlightCards = [
    {
      label: "Designed for",
      value: "Investors, swing traders, day traders, and scalpers who want process before impulse.",
    },
    {
      label: "From day one",
      value: "Evidence, sizing discipline, and execution checkpoints before a trade reaches your book.",
    },
  ];

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
    <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 py-10 sm:px-10 lg:py-14 xl:px-12">
      <div className="grid w-full gap-6 md:grid-cols-[minmax(0,0.96fr)_minmax(360px,0.94fr)] xl:grid-cols-[minmax(0,1.08fr)_minmax(430px,0.92fr)] xl:gap-8">
        <section className="space-y-6">
          <div className="auth-masthead p-6 md:hidden">
            <p className="fin-chip">Create Account</p>
            <h1 className="font-display mt-5 max-w-2xl text-[2.5rem] font-semibold leading-[0.92] text-tds-text sm:text-[3.2rem]">
              Start with a sharper workflow and a calmer investment surface.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-tds-dim">
              Build your workspace around evidence, sizing discipline, and execution checkpoints from the very first session.
            </p>
          </div>

          <section className="fin-hero hidden h-full p-7 md:block lg:p-8 xl:p-10">
            <p className="fin-chip border-white/20 bg-white/10 text-white/80">Create Account</p>
            <h1 className="font-display mt-6 max-w-xl text-[2.9rem] font-semibold leading-[0.92] text-white lg:text-[3.5rem] xl:text-[4.2rem]">
              Start with a cleaner trading workflow from day one.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/76 xl:text-[1.02rem]">
              The Intelligent Trading System is built to enforce evidence, sizing discipline, and execution checkpoints before a trade reaches your book.
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
            <p className="fin-kicker mt-6">Sign Up</p>
            <CardTitle className="font-display mt-1 max-w-md text-[2.45rem] sm:text-[3rem]">Create your Intelligent Investors account.</CardTitle>
            <CardDescription className="max-w-md text-[0.98rem] leading-7">
              Register with email and password to enter a workspace built around process, not noise.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-[1]">
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

            <Button type="submit" size="lg" className="w-full" disabled={loading || !canUseSupabase}>
              {loading ? "Creating account..." : "Create account"}
            </Button>

            <p className="auth-note">
              After account creation, the app attempts to sign you in immediately. If your project requires email confirmation, you&apos;ll continue once the address is verified.
            </p>

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