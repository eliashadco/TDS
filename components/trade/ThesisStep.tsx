"use client";

import { useMemo, useRef } from "react";
import GuidedStructurePicker from "@/components/trade/GuidedStructurePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mergeTradePresetOptions } from "@/lib/trading/structure-library";
import {
  CHART_PATTERN_OPTIONS,
  CONDITION_OPTIONS,
  SETUP_TYPE_OPTIONS,
} from "@/lib/trading/presets";
import type { TradeStructureItemType, TradeStructureLibraryItem } from "@/types/structure-library";
import type { TradeThesis } from "@/types/trade";
import { cn } from "@/lib/utils";
import { useLearnMode } from "@/components/learn/LearnModeContext";
import { SETUP_EXPLANATIONS } from "@/lib/learn/explanations";

type ThesisStepProps = {
  thesis: TradeThesis;
  contradictions: string[];
  sharedLibraryItems: TradeStructureLibraryItem[];
  onSaveLibraryItem: (itemType: TradeStructureItemType, label: string) => Promise<void>;
  onChange: (patch: Partial<TradeThesis>) => void;
  onNext: () => void;
};

const ASSETS = ["Equity", "ETF", "Forex", "Commodity", "Crypto"];

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
  sharedLibraryItems,
  onSaveLibraryItem,
  onChange,
  onNext,
}: ThesisStepProps) {
  const { learnMode } = useLearnMode();
  const isLong = thesis.direction === "LONG";
  const tradeStoryRef = useRef<HTMLDivElement | null>(null);

  const canContinue =
    Boolean(thesis.ticker.trim()) &&
    Boolean(thesis.thesis.trim()) &&
    Boolean(thesis.invalidation.trim()) &&
    thesis.setupTypes.length > 0;

  const setupOptions = useMemo(
    () => mergeTradePresetOptions({
      baseOptions: SETUP_TYPE_OPTIONS,
      sharedItems: sharedLibraryItems,
      itemType: "setup_type",
      selectedLabels: thesis.setupTypes,
    }),
    [sharedLibraryItems, thesis.setupTypes],
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
      selectedLabels: parseChartPatterns(thesis.chartPattern),
    }),
    [sharedLibraryItems, thesis.chartPattern],
  );

  function togglePattern(pattern: string) {
    onChange({ chartPattern: serializeChartPatterns(toggleInArray(parseChartPatterns(thesis.chartPattern), pattern)) });
  }

  function addManualPattern(pattern: string) {
    onChange({ chartPattern: serializeChartPatterns(toggleInArray(parseChartPatterns(thesis.chartPattern), pattern)) });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="fin-kicker">Step 1</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-tds-text">Build the trade thesis</h1>
      </div>

      <div className={cn("rounded-[24px] border px-4 py-4 text-sm font-semibold", isLong ? "border-tds-green/20 bg-tds-green/10 text-tds-green" : "border-tds-red/20 bg-tds-red/10 text-tds-red")}>
        {isLong ? "▲ Bullish thesis selected. Assessment will look for upside support." : "▼ Bearish thesis selected. Assessment will look for downside support."}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ticker">Ticker</Label>
          <Input
            id="ticker"
            value={thesis.ticker}
            onChange={(event) => onChange({ ticker: event.target.value.toUpperCase() })}
            placeholder="AAPL"
            maxLength={12}
          />
        </div>

        <div className="space-y-2">
          <Label>Direction</Label>
          <div className="flex gap-3">
            <Button
              type="button"
              className={cn("flex-1", isLong ? "bg-tds-green text-white hover:bg-emerald-700" : "")}
              variant={isLong ? "default" : "secondary"}
              onClick={() => onChange({ direction: "LONG" })}
            >
              ▲ LONG
            </Button>
            <Button
              type="button"
              className={cn("flex-1", !isLong ? "bg-tds-red text-white hover:bg-red-700" : "")}
              variant={!isLong ? "default" : "secondary"}
              onClick={() => onChange({ direction: "SHORT" })}
            >
              ▼ SHORT
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="asset">Asset Class</Label>
        <select
          id="asset"
          aria-label="Asset class"
          title="Asset class"
          value={thesis.assetClass}
          onChange={(event) => onChange({ assetClass: event.target.value })}
          className="flex h-11 w-full rounded-2xl border border-white/80 bg-white/88 px-4 py-2.5 text-sm text-tds-text shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_10px_24px_-18px_rgba(15,23,42,0.35)]"
        >
          {ASSETS.map((asset) => (
            <option key={asset} value={asset}>
              {asset}
            </option>
          ))}
        </select>
      </div>

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
            selectedLabels: parseChartPatterns(thesis.chartPattern),
            emptyLabel: "No chart patterns match the current filter. Broaden the search or save a custom entry.",
            multiSelect: true,
            onToggleLabel: togglePattern,
            onClear: () => onChange({ chartPattern: "None" }),
            onManualAdd: addManualPattern,
            onSaveManual: (label) => onSaveLibraryItem("chart_pattern", label),
          },
        ]}
        finalCtaLabel="Continue to trade story"
        onComplete={() => tradeStoryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        learnNotes={
          learnMode && thesis.setupTypes.length > 0 ? (
            <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 text-sm text-tds-dim">
              <p className="fin-kicker">Learn Notes</p>
              <div className="mt-3 space-y-2">
                {thesis.setupTypes.map((setup) => (
                  <p key={setup}>
                    <span className="font-semibold text-tds-text">{setup}:</span> {SETUP_EXPLANATIONS[setup] ?? "Directional structure setup."}
                  </p>
                ))}
              </div>
            </div>
          ) : null
        }
      />

      <div ref={tradeStoryRef} className="rounded-[28px] border border-white/80 bg-white/88 p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.28)] sm:p-6">
        <div>
          <p className="fin-kicker">Trade Story</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Write the case in plain language</h2>
          <p className="mt-3 text-sm leading-6 text-tds-dim">Keep it short: what is happening now, what confirms it, and what breaks the idea.</p>
        </div>

        <div className="mt-5 space-y-2">
          <Label htmlFor="thesis">Thesis</Label>
          <textarea
            id="thesis"
            value={thesis.thesis}
            onChange={(event) => onChange({ thesis: event.target.value })}
            className="min-h-[140px] w-full rounded-[24px] border border-white/80 bg-white/88 px-4 py-3 text-sm text-tds-text shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_10px_24px_-18px_rgba(15,23,42,0.35)] placeholder:text-tds-dim"
            placeholder={isLong ? "Why this should move higher now" : "Why this should move lower now"}
          />
          <p className="text-xs uppercase tracking-[0.14em] text-tds-dim">Focus on why now, what should confirm, and where the thesis fails.</p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="catalyst">Catalyst Window</Label>
            <Input
              id="catalyst"
              value={thesis.catalystWindow}
              onChange={(event) => onChange({ catalystWindow: event.target.value })}
              placeholder="1-2 weeks"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invalidation">Invalidation</Label>
            <Input
              id="invalidation"
              value={thesis.invalidation}
              onChange={(event) => onChange({ invalidation: event.target.value })}
              placeholder={isLong ? "Break below support / thesis breach" : "Break above resistance / thesis breach"}
            />
          </div>
        </div>
      </div>

      {contradictions.length > 0 ? (
        <div className="rounded-[24px] border border-tds-amber/20 bg-tds-amber/10 p-4 text-sm text-tds-text">
          <p className="mb-1 font-semibold">Potential Contradictions</p>
          <ul className="list-disc space-y-1 pl-4 text-xs text-tds-dim">
            {contradictions.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" disabled={!canContinue} onClick={onNext}>
          Next →
        </Button>
      </div>
    </div>
  );
}