import LearnToggle from "@/components/learn/LearnToggle";
import OnboardingRestartCard from "@/components/settings/OnboardingRestartCard";
import PortfolioResetCard from "@/components/settings/PortfolioResetCard";
import { getProtectedAppContext } from "@/lib/supabase/protected-app";

export default async function ProfileSettingsPage() {
  const { userId, profile } = await getProtectedAppContext();

  return (
    <main className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="font-mono text-xl text-tds-text">Profile Settings</h1>
        <p className="text-xs text-tds-dim">
          Mode: {profile.mode ?? "Not set"} · Equity: {profile.equity.toLocaleString("en-US")}
        </p>
      </header>

      <OnboardingRestartCard />

      <PortfolioResetCard currentMode={profile.mode} equity={profile.equity} />

      <section className="fin-panel p-6 sm:p-7">
        <p className="fin-kicker">Learning Surface</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Adjust how much guidance is shown inside the product.</h2>
        <div className="mt-6">
          <LearnToggle userId={userId} />
        </div>
      </section>
    </main>
  );
}