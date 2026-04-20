"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Archive, BarChart3, BookOpen, LayoutDashboard, LogOut, Menu, Plus, Radar, Settings } from "lucide-react";
import type { TradeMode } from "@/types/trade";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

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
  { href: "/portfolio-analytics", label: "Analytics", icon: BarChart3 },
  { href: "/portfolio-analytics?tab=marketwatch", label: "MarketWatch", icon: Radar },
  { href: "/trade/new", label: "New Trade", icon: Plus },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/archive", label: "Archive", icon: Archive },
  { href: "/settings/profile", label: "Settings", icon: Settings },
];

export default function NavBar({ mode, currentPath, onModeToggle, onDrawerToggle }: NavBarProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const modeMeta = mode ? MODE_META[mode] : { label: "Set Mode", description: "Configure your workflow" };

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const renderNavItem = (item: (typeof NAV_ITEMS)[number], compact = false) => {
    const Icon = item.icon;
    const isMarketWatchItem = item.href.includes("tab=marketwatch");
    const isPortfolioAnalyticsItem = item.href === "/portfolio-analytics";
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
              ? "app-nav-rail-link-active"
              : "app-nav-rail-link-active"
            : compact
              ? "app-nav-rail-link-idle border-transparent bg-white/8"
              : "app-nav-rail-link-idle border-transparent bg-transparent",
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
        <div className="nav-rail-shell fin-sidebar app-nav-rail px-4 py-4">
          <div className="rail-top app-nav-rail-divider flex items-start justify-between gap-3 border-b pb-4">
            <Link href="/dashboard" className="brand-block space-y-1">
              <p className="app-nav-rail-muted text-[11px] font-semibold uppercase tracking-[0.22em]">Intelligent Trading System</p>
              <div className="app-nav-rail-ink flex items-center gap-2 text-lg font-semibold tracking-[-0.04em]">
                <span className="app-nav-brand-mark brand-mark flex h-10 w-10 items-center justify-center rounded-2xl font-serif text-base font-semibold tracking-[0.24em] text-white">
                  II
                </span>
                Intelligent Investors
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onModeToggle}
                className="app-nav-rail-control rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em]"
              >
                {modeMeta.label}
              </button>
              <button
                type="button"
                onClick={onDrawerToggle}
                aria-label="Open trade drawer"
                title="Open trade drawer"
                className="app-nav-rail-control inline-flex h-11 w-11 items-center justify-center rounded-2xl"
              >
                <Menu className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="rail-main mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV_ITEMS.map((item) => renderNavItem(item, true))}
          </div>

          <div className="rail-footer app-nav-rail-divider mt-4 border-t pt-4">
            <button
              type="button"
              onClick={() => void signOut()}
              className="app-nav-signout action-link flex w-full items-center gap-3 rounded-[16px] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
            >
              <LogOut className="h-4 w-4 text-[#d97706]" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <aside className="fixed left-6 top-6 z-40 hidden h-[calc(100vh-3rem)] w-[248px] md:block">
        <div className="nav-rail-shell fin-sidebar app-nav-rail flex h-full flex-col px-4 py-5">
          <div className="rail-top app-nav-rail-divider border-b pb-5">
            <Link href="/dashboard" className="brand-block rounded-[26px] p-3 hover:bg-white/5">
              <p className="app-nav-rail-muted text-[11px] font-semibold uppercase tracking-[0.22em]">Intelligent Trading System</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="app-nav-brand-mark brand-mark flex h-12 w-12 items-center justify-center rounded-[18px] font-serif text-lg font-semibold tracking-[0.24em] text-white">
                  II
                </span>
                <div>
                  <p className="app-nav-rail-ink text-lg font-semibold tracking-[-0.04em]">Intelligent Investors</p>
                  <p className="app-nav-rail-muted text-sm">Balanced guided terminal</p>
                </div>
              </div>
            </Link>
          </div>

          <div className="rail-main mt-5 flex flex-1 flex-col">
            <p className="app-nav-rail-muted rail-section-label px-2 text-[11px] font-semibold uppercase tracking-[0.22em]">Main Menu</p>
            <nav className="nav-stack mt-3 space-y-2">
              {NAV_ITEMS.map((item) => renderNavItem(item))}
            </nav>
          </div>

          <div className="rail-footer app-nav-rail-divider mt-auto border-t pt-6">
            <button
              type="button"
              onClick={() => void signOut()}
              className="app-nav-signout action-link flex w-full items-center gap-3 rounded-[18px] px-2 py-2 text-sm font-semibold"
            >
              <LogOut className="h-5 w-5 text-[#d97706]" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
