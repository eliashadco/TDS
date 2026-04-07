"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ScoreRowProps = {
  name: string;
  description: string;
  note?: string;
  value: 0 | 1 | null;
  onChange: (value: 0 | 1) => void;
};

export default function ScoreRow({ name, description, note, value, onChange }: ScoreRowProps) {
  const bgClass =
    value === 1
      ? "border-tds-green/20 bg-tds-green/10"
      : value === 0
        ? "border-tds-red/20 bg-tds-red/10"
        : "border-white/75 bg-white/82";

  return (
    <div className={cn("rounded-[24px] border p-4", bgClass)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-tds-text">{name}</p>
          <p className="text-xs text-tds-dim">{description}</p>
          {note ? <p className="text-xs italic text-tds-dim">{note}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={value === 1 ? "default" : "secondary"}
            className={cn(value === 1 ? "bg-tds-green text-white hover:bg-emerald-700" : "")}
            onClick={() => onChange(1)}
          >
            ✓
          </Button>
          <Button
            type="button"
            size="sm"
            variant={value === 0 ? "default" : "secondary"}
            className={cn(value === 0 ? "bg-tds-red text-white hover:bg-red-700" : "")}
            onClick={() => onChange(0)}
          >
            ✗
          </Button>
        </div>
      </div>
    </div>
  );
}