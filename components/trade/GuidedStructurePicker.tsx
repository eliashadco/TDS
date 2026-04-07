"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TradePresetOption } from "@/lib/trading/presets";
import type { TradeStructureItemType } from "@/types/structure-library";

type GuidedStructureSection = {
  key: string;
  title: string;
  description: string;
  itemType: TradeStructureItemType;
  options: TradePresetOption[];
  selectedLabels: string[];
  emptyLabel: string;
  multiSelect?: boolean;
  required?: boolean;
  onToggleLabel: (label: string) => void;
  onClear: () => void;
  onManualAdd: (label: string) => void;
  onSaveManual: (label: string) => Promise<void>;
};

type GuidedStructurePickerProps = {
  sections: GuidedStructureSection[];
  learnNotes?: React.ReactNode;
  finalCtaLabel?: string;
  onComplete?: () => void;
};

function buildFamilies(options: TradePresetOption[]): string[] {
  return ["All", ...Array.from(new Set(options.map((option) => option.family)))];
}

function matchesQuery(option: TradePresetOption, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return [option.label, option.family, option.detail, ...option.keywords].join(" ").toLowerCase().includes(needle);
}

function SelectionCloud({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="mt-2 text-sm leading-6 text-tds-dim">{emptyLabel}</p>;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-tds-blue">
          {item}
        </span>
      ))}
    </div>
  );
}

export default function GuidedStructurePicker({ sections, learnNotes, finalCtaLabel = "Continue", onComplete }: GuidedStructurePickerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [queries, setQueries] = useState<Record<string, string>>({});
  const [families, setFamilies] = useState<Record<string, string>>({});
  const [selectedOnly, setSelectedOnly] = useState<Record<string, boolean>>({});
  const [manualDrafts, setManualDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const currentSection = sections[activeIndex] ?? sections[0] ?? null;

  const currentFamilies = useMemo(
    () => (currentSection ? buildFamilies(currentSection.options) : ["All"]),
    [currentSection],
  );

  const currentFamily = currentSection ? (families[currentSection.key] ?? "All") : "All";
  const currentQuery = currentSection ? (queries[currentSection.key] ?? "") : "";
  const currentSelectedOnly = currentSection ? (selectedOnly[currentSection.key] ?? false) : false;
  const currentManualDraft = currentSection ? (manualDrafts[currentSection.key] ?? "") : "";

  const visibleOptions = useMemo(() => {
    if (!currentSection) {
      return [];
    }

    return currentSection.options.filter((option) => {
      if (currentFamily !== "All" && option.family !== currentFamily) {
        return false;
      }

      if (currentSelectedOnly && !currentSection.selectedLabels.includes(option.label)) {
        return false;
      }

      return matchesQuery(option, currentQuery);
    });
  }, [currentFamily, currentQuery, currentSection, currentSelectedOnly]);

  if (!currentSection) {
    return null;
  }

  const isLastStep = activeIndex === sections.length - 1;
  const canMoveNext = currentSection.required !== true || currentSection.selectedLabels.length > 0;

  async function saveManualEntry() {
    const trimmed = currentManualDraft.trim();
    if (!trimmed) {
      return;
    }

    currentSection.onManualAdd(trimmed);
    setSavingKey(currentSection.key);

    try {
      await currentSection.onSaveManual(trimmed);
      setManualDrafts((previous) => ({
        ...previous,
        [currentSection.key]: "",
      }));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-slate-50/80 p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.28)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="fin-kicker">Guided Structure Flow</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Capture structure in sequence</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-tds-dim">Move through setup types, conditions, and chart pattern one stage at a time. Each stage has its own filter and manual-add lane.</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-tds-dim">
          Step {activeIndex + 1} of {sections.length}
        </span>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {sections.map((section, index) => {
          const active = index === activeIndex;

          return (
            <button
              key={section.key}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                "rounded-[22px] border px-4 py-4 text-left transition-colors",
                active ? "border-blue-200 bg-blue-50/85" : "border-white/80 bg-white/88 hover:border-slate-200 hover:bg-white",
              )}
            >
              <p className="fin-kicker">Stage {index + 1}</p>
              <p className="mt-2 text-sm font-semibold text-tds-text">{section.title}</p>
              <SelectionCloud items={section.selectedLabels} emptyLabel={section.emptyLabel} />
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="fin-kicker">Current Stage</p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-tds-text">{currentSection.title}</h3>
            <p className="mt-2 text-sm leading-6 text-tds-dim">{currentSection.description}</p>
          </div>
          <button type="button" className="text-xs font-semibold uppercase tracking-[0.16em] text-tds-dim hover:text-tds-text" onClick={currentSection.onClear}>
            Clear stage
          </button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-tds-dim" />
            <Input
              value={currentQuery}
              onChange={(event) =>
                setQueries((previous) => ({
                  ...previous,
                  [currentSection.key]: event.target.value,
                }))
              }
              placeholder={`Filter ${currentSection.title.toLowerCase()}`}
              className="pl-10"
            />
          </div>
          <button
            type="button"
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold shadow-sm transition-colors",
              currentSelectedOnly ? "border-blue-200 bg-blue-50 text-tds-blue" : "border-white/80 bg-white text-tds-dim hover:text-tds-text",
            )}
            onClick={() =>
              setSelectedOnly((previous) => ({
                ...previous,
                [currentSection.key]: !(previous[currentSection.key] ?? false),
              }))
            }
          >
            <SlidersHorizontal className="h-4 w-4" />
            {currentSelectedOnly ? "Showing selected only" : "Show selected only"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {currentFamilies.map((family) => {
            const active = family === currentFamily;
            return (
              <button
                key={family}
                type="button"
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors",
                  active ? "border-blue-200 bg-blue-50 text-tds-blue" : "border-white/80 bg-white text-tds-dim hover:border-slate-200 hover:text-tds-text",
                )}
                onClick={() =>
                  setFamilies((previous) => ({
                    ...previous,
                    [currentSection.key]: family,
                  }))
                }
              >
                {family}
              </button>
            );
          })}
        </div>

        {visibleOptions.length === 0 ? (
          <div className="mt-4 rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-tds-dim">
            {currentSection.emptyLabel}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {visibleOptions.map((option) => {
              const active = currentSection.selectedLabels.includes(option.label);

              return (
                <button
                  key={option.label}
                  type="button"
                  className={cn(
                    "rounded-[22px] border px-4 py-4 text-left transition-all",
                    active
                      ? "border-blue-200 bg-blue-50/85 shadow-[0_14px_32px_-24px_rgba(59,130,246,0.45)]"
                      : "border-white/80 bg-white/88 hover:border-slate-200 hover:bg-white",
                  )}
                  onClick={() => currentSection.onToggleLabel(option.label)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-tds-text">{option.label}</p>
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-tds-dim">{option.family}</p>
                    </div>
                    {active ? (
                      <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-tds-blue">
                        Selected
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-tds-dim">{option.detail}</p>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50/75 p-4">
          <p className="fin-kicker">Manual Entry</p>
          <p className="mt-2 text-sm leading-6 text-tds-dim">Type a custom entry for this trade. You can use it once or save it into the shared library for every strategy later.</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <Input
              value={currentManualDraft}
              onChange={(event) =>
                setManualDrafts((previous) => ({
                  ...previous,
                  [currentSection.key]: event.target.value,
                }))
              }
              placeholder={`Custom ${currentSection.title.toLowerCase()}`}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => currentManualDraft.trim() && currentSection.onManualAdd(currentManualDraft.trim())}
              disabled={!currentManualDraft.trim()}
            >
              Use This Trade
            </Button>
            <Button
              type="button"
              onClick={() => void saveManualEntry()}
              disabled={!currentManualDraft.trim() || savingKey === currentSection.key}
            >
              {savingKey === currentSection.key ? "Saving..." : "Save Shared"}
            </Button>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <Button type="button" variant="secondary" onClick={() => setActiveIndex((previous) => Math.max(0, previous - 1))} disabled={activeIndex === 0}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous stage
          </Button>

          {isLastStep ? (
            <Button type="button" onClick={() => onComplete?.()} disabled={!canMoveNext}>
              {finalCtaLabel}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setActiveIndex((previous) => Math.min(sections.length - 1, previous + 1))}
              disabled={!canMoveNext}
            >
              Next stage
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {learnNotes ? <div className="mt-5">{learnNotes}</div> : null}
    </section>
  );
}