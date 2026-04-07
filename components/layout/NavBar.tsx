"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BarChart3, LayoutDashboard, Menu, Plus, Radar, Settings, Sparkles } from "lucide-react";
import type { TradeMode } from "@/types/trade";
import { cn } from "@/lib/utils";

type NavBarProps = {
  mode: TradeMode | null;
  currentPath: string;
  onModeToggle: () => void;
  onDrawerToggle: () => void;
};

const MODE_META: Record<TradeMode, { label: string; description: string }> = {
  investment: { label: "Investment", description: "Long-horizon capital" },
  swing: { label: "Swing", description: "Daily follow-through" },
  daytrade: { label: "Day Trade", description: "Intraday momentum" },
  scalp: { label: "Scalp", description: "Fast tactical flow" },
};

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portfolio-analytics", label: "Portfolio Analytics", icon: BarChart3 },
  { href: "/portfolio-analytics?tab=marketwatch", label: "MarketWatch", icon: Radar },
  { href: "/settings/profile", label: "Settings", icon: Settings },
];

export default function NavBar({ mode, currentPath, onModeToggle, onDrawerToggle }: NavBarProps) {
  const searchParams = useSearchParams();
  const modeMeta = mode ? MODE_META[mode] : { label: "Set Mode", description: "Configure your workflow" };

  const renderNavItem = (item: (typeof NAV_ITEMS)[number], compact = false) => {
    const Icon = item.icon;
    const isMarketWatchItem = item.label === "MarketWatch";
    const isPortfolioAnalyticsItem = item.label === "Portfolio Analytics";
    const activeTab = searchParams.get("tab");
    const isActive = isMarketWatchItem
      ? currentPath === "/portfolio-analytics" && activeTab === "marketwatch"
      : isPortfolioAnalyticsItem
        ? currentPath === "/portfolio-analytics" && activeTab !== "marketwatch"
        : currentPath === item.href || currentPath.startsWith(`${item.href}/`);

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          compact
            ? "inline-flex h-10 items-center gap-2 rounded-full border px-3 text-xs font-semibold"
            : "flex items-center gap-3 rounded-[22px] border px-4 py-3 text-sm font-semibold",
          isActive
            ? compact
              ? "border-white/18 bg-white/16 text-white shadow-[0_18px_35px_-26px_rgba(8,15,28,0.4)]"
              : "border-white/12 bg-white/10 text-white shadow-[0_18px_35px_-26px_rgba(8,15,28,0.42)]"
            : compact
              ? "border-transparent bg-white/6 text-white/75 hover:bg-white/12 hover:text-white"
              : "border-transparent bg-transparent text-white/70 hover:border-white/10 hover:bg-white/8 hover:text-white",
        )}
      >
        <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      <div className="fixed inset-x-4 top-4 z-50 md:hidden">
        <div className="fin-sidebar px-4 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <Link href="/dashboard" className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">Intelligent Trading System</p>
              <div className="flex items-center gap-2 text-lg font-semibold tracking-[-0.04em] text-white">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-tds-slate font-serif text-base font-semibold tracking-[0.24em] text-white shadow-[0_18px_34px_-22px_rgba(13,21,40,0.75)]">
                  II
                </span>
                Intelligent Investors
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onModeToggle}
                className="rounded-full border border-white/12 bg-white/8 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm"
              >
                {modeMeta.label}
              </button>
              <Link
                href="/trade/new"
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-tds-slate shadow-[0_20px_45px_-24px_rgba(13,21,40,0.4)]"
              >
                <Plus className="h-4 w-4" />
                New
              </Link>
              <button
                type="button"
                onClick={onDrawerToggle}
                aria-label="Open trade drawer"
                title="Open trade drawer"
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/8 text-white shadow-sm"
              >
                <Menu className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV_ITEMS.map((item) => renderNavItem(item, true))}
          </div>
        </div>
      </div>

      <aside className="fixed left-6 top-6 z-40 hidden h-[calc(100vh-3rem)] w-[248px] md:block">
        <div className="fin-sidebar flex h-full flex-col px-4 py-5 text-white">
          <Link href="/dashboard" className="rounded-[26px] p-3 hover:bg-white/6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">Intelligent Trading System</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-tds-slate font-serif text-lg font-semibold tracking-[0.24em] text-white shadow-[0_20px_40px_-24px_rgba(13,21,40,0.72)]">
                II
              </span>
              <div>
                <p className="text-lg font-semibold tracking-[-0.04em] text-white">Intelligent Investors</p>
                <p className="text-sm text-white/60">Cleaner decisions, tighter execution.</p>
              </div>
            </div>
          </Link>

          <button
            type="button"
            onClick={onModeToggle}
            className="fin-sidebar-card mt-5 flex items-center justify-between rounded-[26px] px-4 py-4 text-left hover:-translate-y-0.5"
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">Active Mode</p>
              <p className="mt-1 text-base font-semibold text-white">{modeMeta.label}</p>
              <p className="mt-1 text-sm text-white/60">{modeMeta.description}</p>
            </div>
            <Sparkles className="h-5 w-5 text-teal-200" />
          </button>

          <nav className="mt-5 space-y-2">
            {NAV_ITEMS.map((item) => renderNavItem(item))}
          </nav>

          <div className="mt-auto space-y-3 pt-6">
            <button
              type="button"
              onClick={onDrawerToggle}
              className="flex w-full items-center justify-between rounded-[22px] border border-white/12 bg-white/8 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-white/12"
            >
              <span className="flex items-center gap-3">
                <Menu className="h-5 w-5 text-white/70" />
                Trade drawer
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-white/50">Open</span>
            </button>

            <Link
              href="/trade/new"
              className="flex items-center justify-between rounded-[22px] bg-white px-4 py-3 text-sm font-semibold text-tds-slate shadow-[0_22px_45px_-24px_rgba(13,21,40,0.38)] hover:-translate-y-0.5 hover:bg-[#f4f8fc]"
            >
              <span className="flex items-center gap-3">
                <Plus className="h-5 w-5" />
                New thesis trade
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-tds-dim">Go</span>
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
