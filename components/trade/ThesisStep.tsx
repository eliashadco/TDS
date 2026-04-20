"use client";

import { useMemo, useRef, useState } from "react";
import GuidedStructurePicker from "@/components/trade/GuidedStructurePicker";
import PriceChart from "@/components/chart/PriceChart";
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
import type { TradeStructureItemType, TradeStructureLibraryItem } from "@/types/structure-library";
import type { TradeThesis } from "@/types/trade";
import type { Candle, CandleTimeframe } from "@/types/market";
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
  candles: Candle[];
  timeframe: CandleTimeframe;
  onSaveLibraryItem: (itemType: TradeStructureItemType, label: string) => Promise<void>;
  onChange: (patch: Partial<TradeThesis>) => void;
  onGenerateDraft: () => void;
  onTimeframeChange: (tf: CandleTimeframe) => void;
  onNext: () => void;
};

const TIMEFRAMES: CandleTimeframe[] = ["hour", "day", "week"];

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
  candles,
  timeframe,
  onSaveLibraryItem,
  onChange,
  onGenerateDraft,
  onTimeframeChange,
  onNext,
}: ThesisStepProps) {
  const { learnMode } = useLearnMode();
  const isLong = thesis.direction === "LONG";
  const tradeStoryRef = useRef<HTMLDivElement | null>(null);
  const selectedPatterns = parseChartPatterns(thesis.chartPattern);
  const [chartExpanded, setChartExpanded] = useState(false);
  const [setupOpen, setSetupOpen] = useState(true);
  const [extraOpen, setExtraOpen] = useState(false);

  const canContinue =
    Boolean(thesis.ticker.trim()) &&
    Boolean(thesis.thesis.trim()) &&
    Boolean(thesis.invalidation.trim()) &&
    thesis.setupTypes.length > 0;

  const setupOptions = useMemo(
    () =>
      mergeTradePresetOptions({
        baseOptions: filterSetupsByDirection(thesis.direction),
        sharedItems: sharedLibraryItems,
        itemType: "setup_type",
        selectedLabels: thesis.setupTypes,
      }),
    [thesis.direction, sharedLibraryItems, thesis.setupTypes],
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
      {/* Step Header */}
      <div className="trade-step-hero trade-thesis-hero">
        <div className="trade-step-hero-copy">
          <p className="meta-label">Step 1</p>
          <h2>Identify the trade</h2>
        </div>
        <div className={cn("trade-direction-banner", isLong ? "is-long" : "is-short")}>
          {isLong
            ? "▲ Bullish — showing long-aligned setups."
            : "▼ Bearish — showing short-aligned setups."}
        </div>
      </div>

      {/* Ticker + Direction Row */}
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
        <div className="trade-field-shell space-y-2">
          <Label>Direction</Label>
          <div className="flex gap-3">
            <Button
              type="button"
              className={cn("flex-1", isLong ? "bg-tds-green text-white hover:bg-emerald-700" : "")}
              variant={isLong ? "default" : "secondary"}
              onClick={() => onChange({ direction: "LONG" })}
            >
              ▲ Long
            </Button>
            <Button
              type="button"
              className={cn("flex-1", !isLong ? "bg-tds-red text-white hover:bg-red-700" : "")}
              variant={!isLong ? "default" : "secondary"}
              onClick={() => onChange({ direction: "SHORT" })}
            >
              ▼ Short
            </Button>
          </div>
        </div>
      </div>

      {/* Mini Chart — appears once candles are loaded */}
      {candles.length > 0 && (
        <div className="trade-thesis-chart-panel">
          <div className="trade-thesis-chart-bar">
            <p className="meta-label">{thesis.ticker} · Price Chart</p>
            <div className="flex items-center gap-2">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  type="button"
                  className={cn("trade-tf-btn", timeframe === tf && "is-active")}
                  onClick={() => onTimeframeChange(tf)}
                >
                  {tf}
                </button>
              ))}
              <button
                type="button"
                className="trade-tf-btn"
                onClick={() => setChartExpanded((prev) => !prev)}
              >
                {chartExpanded ? "↙ Collapse" : "↗ Expand"}
              </button>
            </div>
          </div>
          <PriceChart
            candles={candles}
            direction={thesis.direction}
            timeframe={timeframe}
            height={chartExpanded ? 300 : 140}
          />
        </div>
      )}

      {/* Thesis Editor */}
      <div
        ref={tradeStoryRef}
        className="trade-review-card trade-story-card trade-story-editor sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="meta-label">Trade Story</p>
            <h3>Write the case in plain language</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {draftMeta ? <AIProviderBadge meta={draftMeta} /> : null}
            <Button
              type="button"
              variant="secondary"
              className="secondary-button"
              onClick={onGenerateDraft}
              disabled={draftLoading || !thesis.ticker.trim()}
            >
              {draftLoading ? "Generating..." : "AI Draft"}
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
              placeholder={
                isLong
                  ? "Why does this ticker fit your edge right now?"
                  : "Why does this ticker fit your short edge right now?"
              }
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
                placeholder={
                  isLong
                    ? "What price action proves the long wrong?"
                    : "What price action proves the short wrong?"
                }
              />
            </div>
          </div>
        </div>

        {smartStopHint ? (
          <p className="mt-4 text-xs uppercase tracking-[0.14em] text-tds-dim">
            Smart stop: {smartStopHint}
          </p>
        ) : null}
      </div>

      {/* Contradictions */}
      {contradictions.length > 0 && (
        <div className="trade-warning-panel trade-thesis-warning-panel">
          <p className="meta-label">Potential Contradictions</p>
          <ul className="list-disc space-y-1 pl-4 text-xs text-tds-dim">
            {contradictions.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Setup Types — direction-filtered, collapsible */}
      <div className="trade-thesis-accordion">
        <button
          type="button"
          className="trade-thesis-accordion-trigger"
          onClick={() => setSetupOpen((prev) => !prev)}
          aria-expanded={setupOpen}
        >
          <span className="trade-thesis-accordion-title">
            Setup Types
            {thesis.setupTypes.length > 0 && (
              <span className="trade-summary-pill">{thesis.setupTypes.length} selected</span>
            )}
          </span>
          <span className="text-xs text-tds-dim">
            {isLong ? "Long-aligned" : "Short-aligned"} · {setupOpen ? "▲" : "▼"}
          </span>
        </button>
        {setupOpen && (
          <div className="trade-thesis-accordion-body">
            <GuidedStructurePicker
              sections={[
                {
                  key: "setup",
                  title: "Setup Types",
                  description: "What type of opportunity are you trading?",
                  itemType: "setup_type",
                  options: setupOptions,
                  selectedLabels: thesis.setupTypes,
                  emptyLabel: "No setup types match this direction.",
                  required: true,
                  onToggleLabel: (label) =>
                    onChange({ setupTypes: toggleInArray(thesis.setupTypes, label) }),
                  onClear: () => onChange({ setupTypes: [] }),
                  onManualAdd: (label) =>
                    onChange({ setupTypes: toggleInArray(thesis.setupTypes, label) }),
                  onSaveManual: (label) => onSaveLibraryItem("setup_type", label),
                },
              ]}
              finalCtaLabel="Done"
              onComplete={() => setSetupOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Conditions + Patterns — optional, collapsed */}
      <div className="trade-thesis-accordion">
        <button
          type="button"
          className="trade-thesis-accordion-trigger"
          onClick={() => setExtraOpen((prev) => !prev)}
          aria-expanded={extraOpen}
        >
          <span className="trade-thesis-accordion-title">
            Conditions &amp; Patterns
            {(thesis.conditions.length > 0 || selectedPatterns.length > 0) && (
              <span className="trade-summary-pill">
                {thesis.conditions.length + selectedPatterns.length} selected
              </span>
            )}
          </span>
          <span className="text-xs text-tds-dim">Optional · {extraOpen ? "▲" : "▼"}</span>
        </button>
        {extraOpen && (
          <div className="trade-thesis-accordion-body">
            <GuidedStructurePicker
              sections={[
                {
                  key: "conditions",
                  title: "Conditions",
                  description: "What must the tape or structure be doing for this idea to stay valid?",
                  itemType: "condition",
                  options: conditionOptions,
                  selectedLabels: thesis.conditions,
                  emptyLabel: "No conditions match the current filter.",
                  onToggleLabel: (label) =>
                    onChange({ conditions: toggleInArray(thesis.conditions, label) }),
                  onClear: () => onChange({ conditions: [] }),
                  onManualAdd: (label) =>
                    onChange({ conditions: toggleInArray(thesis.conditions, label) }),
                  onSaveManual: (label) => onSaveLibraryItem("condition", label),
                },
                {
                  key: "pattern",
                  title: "Chart Pattern",
                  description: "Optional. Add chart patterns that materially support the thesis.",
                  itemType: "chart_pattern",
                  options: patternOptions,
                  selectedLabels: selectedPatterns,
                  emptyLabel: "No chart patterns match the current filter.",
                  multiSelect: true,
                  onToggleLabel: togglePattern,
                  onClear: () => onChange({ chartPattern: "None" }),
                  onManualAdd: addManualPattern,
                  onSaveManual: (label) => onSaveLibraryItem("chart_pattern", label),
                },
              ]}
              finalCtaLabel="Done"
              onComplete={() => setExtraOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Learn Notes */}
      {learnMode && thesis.setupTypes.length > 0 && (
        <div className="trade-review-card trade-compact-card text-sm text-tds-dim">
          <p className="meta-label">Learn Notes</p>
          <div className="mt-3 space-y-2">
            {thesis.setupTypes.map((setup) => (
              <p key={setup}>
                <span className="font-semibold text-tds-text">{setup}:</span>{" "}
                {SETUP_EXPLANATIONS[setup] ?? "Directional structure setup."}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="button" className="primary-button" disabled={!canContinue} onClick={onNext}>
          Next →
        </Button>
      </div>
    </div>
  );
}