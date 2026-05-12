import { describe, it, expect } from "vitest";
import { calculateAnalytics, calculateRealizedAnalytics } from "../analytics";
import type { Trade } from "@/types/trade";

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    user_id: "00000000-0000-0000-0000-000000000002",
    ticker: "AAPL",
    direction: "LONG",
    state: "closed",
    closed: true,
    entry_price: 100,
    stop_loss: 95,
    exit_price: 110,
    shares: 10,
    created_at: new Date().toISOString(),
    ...overrides,
  } as unknown as Trade;
}

describe("calculateAnalytics — R5 closed-trade guard", () => {
  it("accepts an empty array", () => {
    expect(() => calculateAnalytics([])).not.toThrow();
  });

  it("accepts a dataset of closed trades (closed=true)", () => {
    const trades = [makeTrade(), makeTrade({ id: "00000000-0000-0000-0000-000000000003" })];
    expect(() => calculateAnalytics(trades)).not.toThrow();
  });

  it("accepts a closed trade identified by state='closed'", () => {
    const t = makeTrade({ closed: false, state: "closed" });
    expect(() => calculateAnalytics([t])).not.toThrow();
  });

  it("throws when any trade is open (closed=false, state≠'closed')", () => {
    const open = makeTrade({ closed: false, state: "deployed" });
    expect(() => calculateAnalytics([open])).toThrow(/not closed/);
  });

  it("throws when a mixed dataset contains one open trade", () => {
    const closed = makeTrade();
    const open = makeTrade({ id: "00000000-0000-0000-0000-000000000004", closed: false, state: "deployed" });
    expect(() => calculateAnalytics([closed, open])).toThrow(/not closed/);
  });
});

describe("calculateRealizedAnalytics — R5 closed-trade guard", () => {
  it("accepts a dataset of closed trades", () => {
    const trades = [makeTrade()];
    expect(() => calculateRealizedAnalytics(trades)).not.toThrow();
  });

  it("throws when any trade is open", () => {
    const open = makeTrade({ closed: false, state: "deployed" });
    expect(() => calculateRealizedAnalytics([open])).toThrow(/not closed/);
  });
});
