export type Direction = "LONG" | "SHORT";

type DirectionCopy = {
  L: string;
  S: string;
};

const DIRECTION_DESCRIPTIONS: Record<string, DirectionCopy> = {
  f_pe: { L: "P/E below sector median with upside rerating room", S: "P/E stretched versus sector with downside rerating risk" },
  f_peg: { L: "PEG supports growth-adjusted undervaluation", S: "PEG implies growth premium is too expensive" },
  f_pb: { L: "P/B attractive relative to asset quality and peers", S: "P/B elevated versus asset quality and peers" },
  f_eveb: { L: "EV/EBITDA below peers with improving operations", S: "EV/EBITDA rich versus peers with weakening operations" },
  f_fcfy: { L: "FCF yield attractive and supportive for upside", S: "FCF yield weak, implying downside valuation pressure" },
  f_roe: { L: "ROE high and improving versus peers", S: "ROE weak or deteriorating versus peers" },
  f_roce: { L: "ROCE confirms efficient capital compounding", S: "ROCE deterioration signals capital inefficiency" },
  f_margin: { L: "Margins expanding with operating leverage", S: "Margins compressing from cost pressure" },
  f_fcf: { L: "Free cash flow expanding and supporting reinvestment", S: "Free cash flow compressing or negative" },
  f_div: { L: "Dividend profile sustainable with support from cash flows", S: "Dividend pressure/risk from weaker cash coverage" },
  f_moat: { L: "Competitive advantages strengthening", S: "Moat eroding: competition, disruption" },
  f_eps: { L: "EPS growing >=10% or beating estimates", S: "EPS declining, missing, or decelerating" },
  f_rev: { L: "Revenue accelerating >=10% YoY", S: "Revenue decelerating or declining YoY" },
  f_est: { L: "Upward EPS/revenue revisions", S: "Downward EPS/revenue revisions" },
  f_ins: { L: "Net insider buying, cluster buys last 90d", S: "Net insider selling, executives reducing exposure" },
  f_inst: { L: "Institutional accumulation", S: "Institutional distribution" },
  f_debt: { L: "Healthy: coverage >3x, +FCF, manageable debt", S: "Deteriorating: leverage rising, weak FCF" },
  f_si: { L: "High short interest can fuel squeeze upside", S: "Short interest unwind can accelerate downside after failed squeezes" },
  f_beta: { L: "Beta profile supports targeted upside volatility", S: "Beta profile amplifies downside and drawdown risk" },
  f_macro: { L: "Policy/cyclical tailwind supporting upside", S: "Headwind: policy reversal, downturn, disruption" },
  f_cat: { L: "Positive catalyst: beat, upgrade, good news", S: "Negative catalyst: miss, downgrade, bad news" },
  f_float: { L: "Low float for momentum / high SI for squeeze", S: "High float limits squeeze; SI declining" },
  f_val: { L: "Undervalued vs sector; upside to fair value", S: "Overvalued vs sector; downside to fair value" },

  t_trend: { L: "Price > 20 EMA > 50 EMA weekly, uptrending", S: "Price < 20 EMA < 50 EMA weekly, downtrending" },
  t_trend200: { L: "Above 200 DMA, monthly uptrend", S: "Below 200 DMA, monthly downtrend" },
  t_mom: { L: "RSI(14) 50-70, MACD above signal", S: "RSI(14) 30-50, MACD below signal" },
  t_vol: { L: "Volume expanding on up-moves", S: "Volume expanding on down-moves" },
  t_rs: { L: "Outperforming SPY/sector 1m+3m", S: "Underperforming SPY/sector 1m+3m" },
  t_vix: { L: "BB squeeze resolving up, ATR expanding", S: "BB squeeze resolving down, ATR expanding" },
  t_vwap: { L: "Price holding above VWAP with supportive retests", S: "Price rejected below VWAP with weak retests" },
  t_ema: { L: "9 EMA > 20 EMA on 5-min", S: "9 EMA < 20 EMA on 5-min" },
  t_rsi: { L: "RSI(7) 40-65, momentum building", S: "RSI(7) 35-55, momentum fading" },
  t_atr: { L: "ATR supports target reach and trend continuation", S: "ATR supports downside continuation and volatility expansion" },
  t_level: { L: "Break and hold above key resistance", S: "Break and hold below key support" },
  t_ema5: { L: "5/8/13 ribbon fanning up on 1-min", S: "5/8/13 ribbon fanning down on 1-min" },
  t_stoch: { L: "Stoch(5-3-3) crossing up from <20", S: "Stoch(5-3-3) crossing down from >80" },
  t_bb: { L: "Squeeze breakout up or lower band bounce", S: "Squeeze breakout down or upper band rejection" },
  t_rsi5: { L: "RSI(5) 40-60, upward momentum", S: "RSI(5) 40-60, downward momentum" },
  t_obv: { L: "OBV rising confirms accumulation", S: "OBV falling confirms distribution" },
  t_adx: { L: "ADX >25 with trend strengthening up", S: "ADX >25 with trend strengthening down" },
  t_psar: { L: "Parabolic SAR below price in trend", S: "Parabolic SAR above price in downtrend" },
  t_fib: { L: "Bullish reaction from Fib support/retracement", S: "Bearish rejection from Fib resistance/retracement" },
  t_macdh: { L: "MACD histogram rising above baseline", S: "MACD histogram falling below baseline" },
};

export function getDirectionDescription(metricId: string, direction: Direction): string {
  const copy = DIRECTION_DESCRIPTIONS[metricId];
  if (!copy) {
    return direction === "LONG"
      ? "Supports LONG thesis based on current evidence"
      : "Supports SHORT thesis based on current evidence";
  }
  return direction === "LONG" ? copy.L : copy.S;
}