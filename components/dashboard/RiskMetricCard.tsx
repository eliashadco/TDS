"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const PORTFOLIO_HEAT_CAP = 12;
const GAUGE_RADIUS = 46;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

type RiskMetricCardProps = {
  heat: number;
  totalDeployed: number;
  unrealizedPnL: number;
  pnlPercent: number;
  equity: number;
  activeTradeCount: number;
  heatStateLabel: string;
};

type MetricShellProps = {
  label: string;
  value: string;
  detail: string;
  micro: string;
  className?: string;
  valueClassName?: string;
  microClassName?: string;
};

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function MetricShell({ label, value, detail, micro, className, valueClassName, microClassName }: MetricShellProps) {
  return (
    <article className={cn("metric-card terminal-metric-card dashboard-kpi-panel dashboard-metric-card", className)}>
      <div className="dashboard-metric-copy">
        <p className="meta-label">{label}</p>
        <strong className={cn("dashboard-metric-value", valueClassName)}>{value}</strong>
      </div>
      <div className="dashboard-metric-foot">
        <span className="dashboard-metric-detail">{detail}</span>
        <span className={cn("dashboard-metric-micro", microClassName)}>{micro}</span>
      </div>
    </article>
  );
}

export default function RiskMetricCard({
  heat,
  totalDeployed,
  unrealizedPnL,
  pnlPercent,
  equity,
  activeTradeCount,
  heatStateLabel,
}: RiskMetricCardProps) {
  const isHot = heat > 6;
  const isPnLPositive = unrealizedPnL >= 0;
  const deployedPct = equity > 0 ? (totalDeployed / equity) * 100 : 0;
  const gaugeProgress = Math.min(Math.max(heat / PORTFOLIO_HEAT_CAP, 0), 1);
  const strokeDashoffset = GAUGE_CIRCUMFERENCE * (1 - gaugeProgress);
  const gradientId = isHot ? "dashboard-heat-gradient-hot" : "dashboard-heat-gradient-safe";

  return (
    <div className="dashboard-kpi-deck risk-metric-deck">
      <MetricShell
        label="Total Deployed"
        value={money(totalDeployed)}
        detail="Capital actively in market"
        micro={`${deployedPct.toFixed(1)}% of equity deployed`}
        className="risk-metric-card-deployed"
      />

      <MetricShell
        label="Unrealized P&L"
        value={`${unrealizedPnL >= 0 ? "+" : "-"}${money(Math.abs(unrealizedPnL))}`}
        detail="Mark-to-market move across open positions"
        micro={`${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(2)}% on deployed capital`}
        className="risk-metric-card-pnl"
        valueClassName={isPnLPositive ? "positive" : "negative"}
        microClassName={isPnLPositive ? "positive" : "negative"}
      />

      <article className={cn("metric-card terminal-metric-card dashboard-kpi-panel dashboard-metric-card dashboard-heat-card", isHot ? "is-hot" : "is-safe")}>
        <div className="dashboard-heat-card-copy">
          <div className="dashboard-metric-copy">
            <div className="dashboard-heat-header">
              <p className="meta-label">Portfolio Heat</p>
              <span className={cn("dashboard-heat-status", isHot ? "is-hot" : "is-safe")}>{heatStateLabel}</span>
            </div>
            <strong className="dashboard-metric-value">{heat.toFixed(1)}%</strong>
          </div>

          <div className="dashboard-metric-foot">
            <span className="dashboard-metric-detail">{isHot ? "Risk is elevated. Compress exposure before adding size." : "Risk is controlled and inside the operating lane."}</span>
            <div className="dashboard-heat-meta">
              <span>Cap {PORTFOLIO_HEAT_CAP}%</span>
              <span>{activeTradeCount} active trade{activeTradeCount === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>

        <div className="dashboard-heat-gauge-shell" aria-label={`Portfolio heat ${heat.toFixed(1)} percent of ${PORTFOLIO_HEAT_CAP} percent max`}>
          <svg className="dashboard-heat-gauge" viewBox="0 0 120 120" role="img" aria-hidden="true">
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={isHot ? "#fb7185" : "#10b981"} />
                <stop offset="100%" stopColor={isHot ? "#e11d48" : "#0f766e"} />
              </linearGradient>
            </defs>

            <circle
              className="dashboard-heat-gauge-track"
              cx="60"
              cy="60"
              r={GAUGE_RADIUS}
              fill="none"
              strokeWidth="10"
            />
            <motion.circle
              className="dashboard-heat-gauge-progress"
              cx="60"
              cy="60"
              r={GAUGE_RADIUS}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={GAUGE_CIRCUMFERENCE}
              initial={false}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              transform="rotate(-90 60 60)"
            />
          </svg>

          <div className="dashboard-heat-gauge-center">
            <span className="dashboard-heat-gauge-value">{Math.round(heat)}%</span>
            <span className="dashboard-heat-gauge-caption">of {PORTFOLIO_HEAT_CAP}% max</span>
          </div>
        </div>
      </article>
    </div>
  );
}