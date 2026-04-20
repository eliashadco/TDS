import DisciplineProfileSelector from "@/components/settings/DisciplineProfileSelector";
import LearnToggle from "@/components/learn/LearnToggle";
import OnboardingRestartCard from "@/components/settings/OnboardingRestartCard";
import PortfolioResetCard from "@/components/settings/PortfolioResetCard";
import { getProtectedAppContext } from "@/lib/supabase/protected-app";
import type { DisciplineProfile } from "@/types/trade";

export default async function ProfileSettingsPage() {
  const { userId, profile } = await getProtectedAppContext();
  const workspaceHandle = `WS-${userId.slice(0, 8).toUpperCase()}`;

  return (
    <main className="settings-terminal">
      <div className="page-header">
        <div>
          <p className="meta-label">Settings</p>
          <h2>Quiet workspace controls and profile management</h2>
          <p className="page-intro">Manage onboarding, learning overlays, and reset boundaries without leaving the active operating shell.</p>
        </div>
      </div>

      <section className="settings-grid">
        <section className="surface-panel">
          <div className="surface-header">
            <div>
              <p className="meta-label">Profile</p>
              <h3>Identity and capital</h3>
            </div>
            <span className="tag">Primary Workspace</span>
          </div>

          <div className="settings-detail-grid">
            <article className="settings-info-card">
              <p className="meta-label">Account</p>
              <strong>{workspaceHandle}</strong>
              <p>Secure workspace identity linked to your authenticated session.</p>
            </article>
            <article className="settings-info-card">
              <p className="meta-label">Capital Base</p>
              <strong>${profile.equity.toLocaleString("en-US")}</strong>
              <p>Current equity reference used for sizing and risk math.</p>
            </article>
            <article className="settings-info-card">
              <p className="meta-label">Default Lane</p>
              <strong>{profile.mode ? (profile.mode === "daytrade" ? "Day Trade" : profile.mode.charAt(0).toUpperCase() + profile.mode.slice(1)) : "Not set"}</strong>
              <p>Lane selection controls chart context, cadence, and presets.</p>
            </article>
            <article className="settings-info-card">
              <p className="meta-label">Discipline Profile</p>
              <strong>{(profile.disciplineProfile ?? "balanced").charAt(0).toUpperCase() + (profile.disciplineProfile ?? "balanced").slice(1)}</strong>
              <p>Controls how hard rule failures are enforced during trade execution.</p>
            </article>
            <article className="settings-info-card">
              <p className="meta-label">Learn Mode</p>
              <strong>{profile.learnMode ? "Enabled" : "Disabled"}</strong>
              <p>Guidance overlays and explainers adjust in real time.</p>
            </article>
          </div>
        </section>

        <aside className="surface-panel settings-side-panel">
          <p className="meta-label">Workspace Modes</p>
          <div className="priority-stack">
            <article className="priority-card calm">
              <strong>{profile.learnMode ? "Learn Mode is enabled" : "Learn Mode is disabled"}</strong>
              <p>{profile.learnMode ? "Explanations are visible in sizing, metrics, and archive context." : "Mode pills switch instantly without gating through guided explanations."}</p>
            </article>
            <article className="priority-card calm">
              <strong>Operational lane: {profile.mode ?? "Not set"}</strong>
              <p>Use shell lane pills to change mode quickly unless Learn Mode gating is active.</p>
            </article>
          </div>
        </aside>
      </section>

      <section className="settings-grid">
        <OnboardingRestartCard />

        <section className="surface-panel settings-side-panel">
          <p className="meta-label">Learning Surface</p>
          <h3>Guidance depth controls</h3>
          <p className="text-sm leading-7 text-tds-dim">Adjust instructional overlays and explanation density across the app. Changes apply immediately for the current workspace.</p>
          <LearnToggle userId={userId} />
        </section>
      </section>

      <section className="settings-grid">
        <section className="surface-panel">
          <div className="surface-header">
            <div>
              <p className="meta-label">Discipline</p>
              <h3>Execution profile</h3>
            </div>
            <span className="tag">Rule Enforcement</span>
          </div>
          <p className="text-sm leading-7 text-tds-dim" style={{ padding: "0 1.5rem" }}>
            Choose how strictly the system enforces hard rules during trade execution. This affects gate blocking, override friction, and circuit breaker thresholds.
          </p>
          <div style={{ padding: "1rem 1.5rem 1.5rem" }}>
            <DisciplineProfileSelector userId={userId} initialProfile={(profile.disciplineProfile ?? "balanced") as DisciplineProfile} />
          </div>
        </section>
      </section>

      <section className="settings-grid">
        <section className="surface-panel">
          <div className="surface-header">
            <div>
              <p className="meta-label">Data</p>
              <h3>API Export</h3>
            </div>
            <span className="tag">Power User</span>
          </div>
          <div style={{ padding: "0 1.5rem 1.5rem" }}>
            <p className="text-sm leading-7 text-tds-dim">
              Download your complete trade journal, override history, discipline metrics, and strategy definitions as a single JSON file.
            </p>
            <a
              href="/api/export"
              download
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-tds-border bg-tds-input px-4 py-2 text-sm font-medium text-tds-text transition hover:bg-tds-hover"
            >
              Export All Data
            </a>
          </div>
        </section>
      </section>

      <section className="settings-grid">
        <PortfolioResetCard currentMode={profile.mode} equity={profile.equity} />

        <aside className="surface-panel danger-panel settings-side-panel">
          <p className="meta-label">Danger Zone</p>
          <h3>Reset controls remain isolated</h3>
          <p className="text-sm leading-7 text-tds-dim">Use destructive actions only when onboarding, watchlists, or paper-trade history needs a deliberate reset. All resets are explicit and require confirmation.</p>
          <div className="priority-stack">
            <article className="priority-card warn">
              <strong>Activity reset</strong>
              <p>Clears trades and watchlists while preserving strategy definitions and structure assets.</p>
            </article>
            <article className="priority-card warn">
              <strong>Full workspace reset</strong>
              <p>Removes strategy and structure workspace data, then reseeds for the active lane.</p>
            </article>
          </div>
        </aside>
      </section>
    </main>
  );
}