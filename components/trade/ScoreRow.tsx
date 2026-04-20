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
  const stateClass = value === 1 ? "is-pass" : value === 0 ? "is-fail" : "is-pending";

  return (
    <div className={cn("trade-score-row", stateClass)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="trade-score-title">{name}</p>
          <p className="trade-score-copy">{description}</p>
          {note ? <p className="trade-score-note">{note}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={value === 1 ? "default" : "secondary"}
            className={cn("trade-score-action", value === 1 && "is-pass")}
            onClick={() => onChange(1)}
          >
            ✓
          </Button>
          <Button
            type="button"
            size="sm"
            variant={value === 0 ? "default" : "secondary"}
            className={cn("trade-score-action", value === 0 && "is-fail")}
            onClick={() => onChange(0)}
          >
            ✗
          </Button>
        </div>
      </div>
    </div>
  );
}