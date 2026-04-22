"use client";

import { useMemo, useRef, useState } from "react";
import GuidedStructurePicker from "@/components/trade/GuidedStructurePicker";
import AIProviderBadge from "@/components/ai/AIProviderBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mergeTradePresetOptions } from "@/lib/trading/structure-library";
import {
  CHART_PATTERN_OPTIONS,
  CONDITION_OPTIONS,
  filterSetupsByDirection,
} from "@/lib/trading/presets";
import PriceChart from "@/components/chart/PriceChart";
import type { Candle, CandleTimeframe } from "@/types/market";
import type { TradeStructureItemType, TradeStructureLibraryItem } from "@/types/structure-library";
import type { TradeThesis } from "@/types/trade";
import { cn } from "@/lib/utils";
import { useLearnMode } from "@/components/learn/LearnModeContext";
import { SETUP_EXPLANATIONS } from "@/lib/learn/explanations";
import type { AIResponseMeta } from "@/lib/ai/response";

type ThesisStepProps = {
  thesis: TradeThesis;
  contradictions: string[];
  draftLoading: boolean;
  draftMeta: AIResponseMeta | null;
  smartStopHint: string | null;
  sharedLibraryItems: TradeStructureLibraryItem[];
  onSaveLibraryItem: (itemType: TradeStructureItemType, label: string) => Promise<void>;
  onChange: (patch: Partial<TradeThesis>) => void;
  onGenerateDraft: () => void;
  onNext: () => void;
  candles: Candle[];
  timeframe: CandleTimeframe;
  onTimeframeChange: (tf: CandleTimeframe) => void;
};

function toggleInArray(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function parseChartPatterns(value: string): string[] {
  if (!value || value === "None") {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function serializeChartPatterns(patterns: string[]): string {
  return patterns.length > 0 ? patterns.join(", ") : "None";
}

export default function ThesisStep({
  thesis,
  contradictions,
  draftLoading,
  draftMeta,
  smartStopHint,
  sharedLibraryItems,
  onSaveLibraryItem,
  onChange,
  onGenerateDraft,
  onNext,
  candles,
  timeframe,
  onTimeframeChange,
}: ThesisStepProps) {
  const { learnMode } = useLearnMode();
  const isLong = thesis.direction === "LONG";
  const [chartExpanded, setChartExpanded] = useState(false);
  const [setupOpen, setSetupOpen] = useState(true);
  const tradeStoryRef = useRef<HTMLDivElement | null>(null);
  const selectedPatterns = parseChartPatterns(thesis.chartPattern);

  const canContinue =
    Boolean(thesis.ticker.trim()) &&
    Boolean(thesis.thesis.trim()) &&
    Boolean(thesis.invalidation.trim()) &&
    thesis.setupTypes.length > 0;

  const setupOptions = useMemo(
    () => mergeTradePresetOptions({
      baseOptions: filterSetupsByDirection(thesis.direction),
      sharedItems: sharedLibraryItems,
      itemType: "setup_type",
      selectedLabels: thesis.setupTypes,
    }),
    [sharedLibraryItems, thesis.setupTypes, thesis.direction],
  );

  const conditionOptions = useMemo(
    () => mergeTradePresetOptions({
      baseOptions: CONDITION_OPTIONS,
      sharedItems: sharedLibraryItems,
      itemType: "condition",
      selectedLabels: thesis.conditions,
    }),
    [sharedLibraryItems, thesis.conditions],
  );

  const patternOptions = useMemo(
    () => mergeTradePresetOptions({
      baseOptions: CHART_PATTERN_OPTIONS,
      sharedItems: sharedLibraryItems,
      itemType: "chart_pattern",
      selectedLabels: selectedPatterns,
    }),
    [selectedPatterns, sharedLibraryItems],
  );

  function togglePattern(pattern: string) {
    onChange({ chartPattern: serializeChartPatterns(toggleInArray(selectedPatterns, pattern)) });
  }

  function addManualPattern(pattern: string) {
    onChange({ chartPattern: serializeChartPatterns(toggleInArray(selectedPatterns, pattern)) });
  }

  return (
    <div className="space-y-6">
      <div className="trade-step-hero trade-thesis-hero">
        <div className="trade-step-hero-copy">
          <p className="meta-label">Step 1</p>
          <h2>Build the trade thesis</h2>
          <p>Start with a ticker, set direction, and write a concise thesis. Select at least one setup to continue.</p>
        </div>

        <div className={cn("trade-direction-banner", isLong ? "is-long" : "is-short")}>
          {isLong ? "▲ Bullish thesis selected. Assessment will look for upside support." : "▼ Bearish thesis selected. Assessment will look for downside support."}
        </div>
      </div>
      <div className="trade-thesis-id-row">
        <div className="trade-field-shell space-y-2">
          <Label htmlFor="ticker">Ticker</Label>
          <Input
            id="ticker"
            value={thesis.ticker}
            onChange={(event) => onChange({ ticker: event.target.value.toUpperCase() })}
            placeholder="AAPL"
            maxLength={12}
          />
        </div>

        <div className="trade-thesis-chart-panel">
          <div className="trade-thesis-chart-bar">
            <div className="flex items-center gap-2">
              <span className="text-sm">{thesis.ticker || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={cn("trade-tf-btn", timeframe === "hour" ? "is-active" : "")}
                onClick={() => onTimeframeChange("hour")}
              >
                1H
              </button>
              <button
                type="button"
                className={cn("trade-tf-btn", timeframe === "day" ? "is-active" : "")}
                onClick={() => onTimeframeChange("day")}
              >
                1D
              </button>
              <button
                type="button"
                className={cn("trade-tf-btn", timeframe === "week" ? "is-active" : "")}
                onClick={() => onTimeframeChange("week")}
              >
                1W
              </button>
              <Button type="button" variant="ghost" onClick={() => setChartExpanded((p) => !p)}>
                {chartExpanded ? "↙ Collapse" : "↗ Expand"}
              </Button>
            </div>
          </div>
          <div style={{ padding: "1rem" }}>
            <PriceChart candles={candles} timeframe={timeframe} height={chartExpanded ? 300 : 140} />
          </div>
        </div>
      </div>

      <div ref={tradeStoryRef} className="trade-review-card trade-story-card trade-story-editor sm:p-6 mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3>Thesis & Invalidation</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {draftMeta ? <AIProviderBadge meta={draftMeta} /> : null}
            <Button type="button" variant="secondary" className="secondary-button" onClick={onGenerateDraft} disabled={draftLoading || !thesis.ticker.trim()}>
              {draftLoading ? "Generating..." : "Generate AI Insight"}
            </Button>
          </div>
        </div>

        <div className="trade-thesis-editor-grid mt-4">
          <div className="space-y-2">
            <Label htmlFor="thesis">Thesis</Label>
            <textarea
              id="thesis"
              value={thesis.thesis}
              onChange={(event) => onChange({ thesis: event.target.value })}
              className="trade-textarea trade-thesis-textarea"
              placeholder={isLong ? "Why does this ticker fit your edge right now?" : "Why does this ticker fit your short edge right now?"}
            />
          </div>

          <div className="trade-thesis-support-grid">
            <div className="space-y-2">
              <Label htmlFor="catalyst">Catalyst Window</Label>
              <Input
                id="catalyst"
                value={thesis.catalystWindow}
                onChange={(event) => onChange({ catalystWindow: event.target.value })}
                placeholder="What catalyst or timing window matters here?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invalidation">Invalidation</Label>
              <Input
                id="invalidation"
                value={thesis.invalidation}
                onChange={(event) => onChange({ invalidation: event.target.value })}
                placeholder={isLong ? "What price action proves this long thesis wrong?" : "What price action proves this short thesis wrong?"}
              />
            </div>
          </div>
        </div>

        {smartStopHint ? <p className="mt-4 text-xs uppercase tracking-[0.14em] text-tds-dim">Smart stop note: {smartStopHint}</p> : null}
      </div>

      {contradictions.length > 0 && (
        <div className="trade-warning-panel trade-thesis-warning-panel mt-4">
          <p className="meta-label">Potential Contradictions</p>
          <ul className="list-disc space-y-1 pl-4 text-xs text-tds-dim">
            {contradictions.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {learnMode && thesis.setupTypes.length > 0 ? (
        <div className="trade-review-card trade-compact-card text-sm text-tds-dim mt-4">
          <p className="meta-label">Learn Notes</p>
          <div className="mt-3 space-y-2">
            {thesis.setupTypes.map((setup) => (
              <p key={setup}>
                <span className="font-semibold text-tds-text">{setup}:</span> {SETUP_EXPLANATIONS[setup] ?? "Directional structure setup."}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 border border-[var(--fin-border)] rounded-[18px] overflow-hidden bg-[var(--fin-surface)]">
        <button
          type="button"
          className="trade-thesis-accordion-trigger"
          onClick={() => setSetupOpen((prev) => !prev)}
          aria-expanded={setupOpen}
        >
          <div className="trade-thesis-accordion-title">
            <span className="text-tds-text">Structure & Setups</span>
            <span className="text-tds-dim font-normal text-xs px-2 py-0.5 bg-[var(--fin-muted)] rounded-md">
              {isLong ? "Long-aligned filter" : "Short-aligned filter"}
            </span>
          </div>
          <span className="text-tds-dim">{setupOpen ? "▲" : "▼"}</span>
        </button>
        
        {setupOpen && (
          <div className="trade-thesis-accordion-body p-0">
            <GuidedStructurePicker
              sections={[
                {
                  key: "setup",
                  title: "Setup Types",
                  description: "What type of opportunity are you actually trading?",
                  itemType: "setup_type",
                  options: setupOptions,
                  selectedLabels: thesis.setupTypes,
                  emptyLabel: "No setup types match the current filter. Broaden the search or save a custom entry.",
                  required: true,
                  onToggleLabel: (label) => onChange({ setupTypes: toggleInArray(thesis.setupTypes, label) }),
                  onClear: () => onChange({ setupTypes: [] }),
                  onManualAdd: (label) => onChange({ setupTypes: toggleInArray(thesis.setupTypes, label) }),
                  onSaveManual: (label) => onSaveLibraryItem("setup_type", label),
                },
                {
                  key: "conditions",
                  title: "Conditions",
                  description: "What must the tape or structure be doing for this idea to stay valid?",
                  itemType: "condition",
                  options: conditionOptions,
                  selectedLabels: thesis.conditions,
                  emptyLabel: "No conditions match the current filter. Broaden the search or save a custom entry.",
                  onToggleLabel: (label) => onChange({ conditions: toggleInArray(thesis.conditions, label) }),
                  onClear: () => onChange({ conditions: [] }),
                  onManualAdd: (label) => onChange({ conditions: toggleInArray(thesis.conditions, label) }),
                  onSaveManual: (label) => onSaveLibraryItem("condition", label),
                },
                {
                  key: "pattern",
                  title: "Chart Pattern",
                  description: "Optional. Add one or more chart patterns when they materially support the thesis.",
                  itemType: "chart_pattern",
                  options: patternOptions,
                  selectedLabels: selectedPatterns,
                  emptyLabel: "No chart patterns match the current filter. Broaden the search or save a custom entry.",
                  multiSelect: true,
                  onToggleLabel: togglePattern,
                  onClear: () => onChange({ chartPattern: "None" }),
                  onManualAdd: addManualPattern,
                  onSaveManual: (label) => onSaveLibraryItem("chart_pattern", label),
                },
              ]}
              finalCtaLabel="Lock Structure"
              onComplete={() => setSetupOpen(false)}
            />
          </div>
        )}
      </div>

      <div className="flex justify-end mt-6">
        <Button type="button" className="primary-button" disabled={!canContinue} onClick={onNext}>
          Next →
        </Button>
      </div>
    </div>
  );
}