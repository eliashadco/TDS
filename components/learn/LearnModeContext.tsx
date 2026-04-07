"use client";

import { createContext, useContext, useMemo, useState } from "react";

type LearnModeContextValue = {
  learnMode: boolean;
  setLearnMode: (value: boolean) => void;
};

const LearnModeContext = createContext<LearnModeContextValue | null>(null);

type LearnModeProviderProps = {
  initialLearnMode: boolean;
  children: React.ReactNode;
};

export function LearnModeProvider({ initialLearnMode, children }: LearnModeProviderProps) {
  const [learnMode, setLearnMode] = useState(initialLearnMode);

  const value = useMemo(
    () => ({
      learnMode,
      setLearnMode,
    }),
    [learnMode],
  );

  return <LearnModeContext.Provider value={value}>{children}</LearnModeContext.Provider>;
}

export function useLearnMode() {
  const context = useContext(LearnModeContext);
  if (!context) {
    throw new Error("useLearnMode must be used within LearnModeProvider");
  }
  return context;
}
