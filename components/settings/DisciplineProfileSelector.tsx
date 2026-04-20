"use client";

import { useEffect, useMemo, useState } from "react";
import { Shield, ShieldAlert, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DisciplineProfile } from "@/types/trade";

type DisciplineProfileSelectorProps = {
  userId: string;
  initialProfile: DisciplineProfile;
};

const PROFILES: Array<{
  key: DisciplineProfile;
  label: string;
  icon: React.ReactNode;
  description: string;
  details: string[];
}> = [
  {
    key: "strict",
    label: "Strict",
    icon: <Shield className="h-5 w-5" />,
    description: "Maximum discipline enforcement",
    details: [
      "Hard rules block execution",
      "Full 30s friction on override",
      "Circuit breaker: 3 losses / 5% drawdown",
    ],
  },
  {
    key: "balanced",
    label: "Balanced",
    icon: <ShieldAlert className="h-5 w-5" />,
    description: "Guided flexibility with accountability",
    details: [
      "Hard rules degrade to warnings",
      "Reduced 15s friction on override",
      "Circuit breaker: 5 losses / 8% drawdown",
    ],
  },
  {
    key: "expert",
    label: "Expert",
    icon: <Zap className="h-5 w-5" />,
    description: "Fast execution, all overrides logged",
    details: [
      "No blocking — failures logged only",
      "No friction timer on override",
      "Circuit breaker: 8 losses / 12% drawdown",
    ],
  },
];

export default function DisciplineProfileSelector({ userId, initialProfile }: DisciplineProfileSelectorProps) {
  const [selected, setSelected] = useState<DisciplineProfile>(initialProfile);
  const [saving, setSaving] = useState(false);
  const [schemaUnsupported, setSchemaUnsupported] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("discipline_profile")
      .eq("id", userId)
      .maybeSingle()
      .then(({ error }) => {
        if (error?.code === "42703" && (error.message ?? "").includes("discipline_profile")) {
          setSchemaUnsupported(true);
        }
      });
  }, [supabase, userId]);

  async function handleSelect(profile: DisciplineProfile) {
    if (schemaUnsupported || profile === selected) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ discipline_profile: profile })
      .eq("id", userId);
    if (error?.code === "42703" && (error.message ?? "").includes("discipline_profile")) {
      setSchemaUnsupported(true);
    } else if (!error) {
      setSelected(profile);
    }
    setSaving(false);
  }

  return (
    <div className="discipline-profile-selector">
      {schemaUnsupported ? (
        <p className="text-sm text-amber-700">
          Discipline profile controls are unavailable until the live database applies the discipline profile migration.
        </p>
      ) : null}
      <div className="discipline-profile-cards">
        {PROFILES.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`discipline-profile-card ${selected === p.key ? "discipline-profile-active" : ""}`}
            data-profile={p.key}
            onClick={() => void handleSelect(p.key)}
            disabled={saving || schemaUnsupported}
          >
            <div className="discipline-profile-icon">{p.icon}</div>
            <h4 className="discipline-profile-label">{p.label}</h4>
            <p className="discipline-profile-desc">{p.description}</p>
            <ul className="discipline-profile-details">
              {p.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>
    </div>
  );
}
