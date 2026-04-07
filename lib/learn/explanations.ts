import type { TradeMode } from "@/types/trade";

type DirectionText = {
  LONG: string;
  SHORT: string;
};

export type MetricExplanation = {
  whatItMeasures: string;
  whyItMatters: Record<TradeMode, string>;
  passExample: DirectionText;
  failExample: DirectionText;
};

function whyMatters(base: string): Record<TradeMode, string> {
  return {
    investment: `${base} In investment mode, this helps avoid owning businesses with weak multi-quarter quality.`,
    swing: `${base} In swing mode, it improves odds of a multi-day follow-through move.`,
    daytrade: `${base} In day trade mode, it helps you pick names with cleaner intraday behavior.`,
    scalp: `${base} In scalp mode, it acts as a quick context filter before entering short-duration trades.`,
  };
}

export const METRIC_EXPLANATIONS: Record<string, MetricExplanation> = {
  f_pe: {
    whatItMeasures: "P/E compares market price to earnings, showing how expensive current profits are.",
    whyItMatters: whyMatters("Valuation extremes often mean-revert when expectations reset."),
    passExample: {
      LONG: "A profitable industrial trades below peers despite stable margins, leaving room for re-rating.",
      SHORT: "A growth name trades at a stretched multiple while earnings momentum stalls, creating downside risk.",
    },
    failExample: {
      LONG: "The stock is already priced at a premium multiple with no fresh catalyst to justify expansion.",
      SHORT: "The stock is already de-rated and cheap versus peers, limiting downside from valuation alone.",
    },
  },
  f_peg: {
    whatItMeasures: "PEG adjusts valuation by growth rate to test whether price is fair relative to expansion.",
    whyItMatters: whyMatters("You want growth-adjusted valuation, not headline multiples in isolation."),
    passExample: {
      LONG: "Revenue and EPS are compounding while PEG remains below sector average.",
      SHORT: "Growth is decelerating but PEG remains elevated, implying optimism is overextended.",
    },
    failExample: {
      LONG: "Growth has slowed and PEG is now expensive, reducing asymmetry for upside.",
      SHORT: "PEG has normalized after a selloff, so short thesis loses valuation edge.",
    },
  },
  f_pb: {
    whatItMeasures: "P/B compares market value to balance sheet equity, useful in asset-heavy sectors.",
    whyItMatters: whyMatters("It helps identify when assets are under- or over-appreciated by the market."),
    passExample: {
      LONG: "A bank with stable credit quality trades near book while peers trade above book.",
      SHORT: "A cyclical name trades far above book value even as asset returns fade.",
    },
    failExample: {
      LONG: "Book value quality is weak due to write-down risk, so a low P/B is not true value.",
      SHORT: "P/B is already compressed and aligned with deteriorating fundamentals.",
    },
  },
  f_eveb: {
    whatItMeasures: "EV/EBITDA values enterprise cash flow before capital structure effects.",
    whyItMatters: whyMatters("It compares firms more fairly when debt and cash balances differ."),
    passExample: {
      LONG: "A company with improving operating margins still trades at a discount EV/EBITDA.",
      SHORT: "Operating leverage weakens while EV/EBITDA remains rich versus history.",
    },
    failExample: {
      LONG: "The multiple has already expanded to premium levels before earnings catch up.",
      SHORT: "The multiple has already compressed after guidance cuts, reducing short edge.",
    },
  },
  f_fcfy: {
    whatItMeasures: "Free cash flow yield compares free cash flow to market value.",
    whyItMatters: whyMatters("Cash generation quality often drives durability of trends and re-ratings."),
    passExample: {
      LONG: "FCF yield is above peers with improving conversion and declining capex pressure.",
      SHORT: "FCF yield is thin and deteriorating while the market still prices the stock richly.",
    },
    failExample: {
      LONG: "FCF is inconsistent and cash conversion is weak, lowering confidence in upside.",
      SHORT: "FCF yield is already strong and improving, making a short thesis harder to sustain.",
    },
  },
  f_roe: {
    whatItMeasures: "ROE measures profit earned on shareholder equity.",
    whyItMatters: whyMatters("Consistent high returns usually reflect stronger economics and execution quality."),
    passExample: {
      LONG: "ROE has stayed above 15% for several years while reinvestment remains disciplined.",
      SHORT: "ROE is declining quickly from prior highs while valuation still assumes quality leadership.",
    },
    failExample: {
      LONG: "ROE is low and unstable, signaling weak capital efficiency.",
      SHORT: "ROE remains resilient and peer-leading, weakening the bearish quality case.",
    },
  },
  f_roce: {
    whatItMeasures: "ROCE measures returns on all capital employed, not just equity.",
    whyItMatters: whyMatters("It reveals whether management creates value across debt and equity capital."),
    passExample: {
      LONG: "ROCE trends higher as new projects earn above cost of capital.",
      SHORT: "ROCE drops below historical norms while expansion spending remains high.",
    },
    failExample: {
      LONG: "ROCE is below cost of capital, suggesting poor value creation.",
      SHORT: "ROCE is stable and high, indicating capital discipline still intact.",
    },
  },
  f_margin: {
    whatItMeasures: "Operating margin tracks how much revenue is retained after operating costs.",
    whyItMatters: whyMatters("Margin direction often leads revisions in earnings expectations."),
    passExample: {
      LONG: "Margins expand on stable pricing and better cost control.",
      SHORT: "Margins compress from input inflation and weaker pricing power.",
    },
    failExample: {
      LONG: "Margins are shrinking quarter-over-quarter despite revenue growth.",
      SHORT: "Margins are inflecting upward, reducing probability of further de-rating.",
    },
  },
  f_fcf: {
    whatItMeasures: "Free cash flow checks whether accounting earnings convert into actual cash.",
    whyItMatters: whyMatters("Cash-backed earnings tend to support more durable price trends."),
    passExample: {
      LONG: "FCF is positive and growing while working-capital swings are controlled.",
      SHORT: "FCF turned negative due to weakening demand and inventory build.",
    },
    failExample: {
      LONG: "Earnings look good but FCF is repeatedly negative, reducing trust in the thesis.",
      SHORT: "FCF has stabilized and is improving, limiting downside momentum.",
    },
  },
  f_div: {
    whatItMeasures: "Dividend quality measures payout sustainability and consistency of distributions.",
    whyItMatters: whyMatters("Reliable payout policy can anchor valuation, while stressed payouts signal risk."),
    passExample: {
      LONG: "Dividend is covered by cash flow and raised regularly without balance-sheet strain.",
      SHORT: "Payout ratio is stretched and likely to be cut if earnings weaken further.",
    },
    failExample: {
      LONG: "Dividend appears high only because price dropped, while coverage deteriorates.",
      SHORT: "Dividend coverage is healthy and management has room to maintain distributions.",
    },
  },
  f_moat: {
    whatItMeasures: "Moat assesses defensibility: brand, scale, switching costs, data, or distribution advantage.",
    whyItMatters: whyMatters("Defensible businesses keep returns high through cycles."),
    passExample: {
      LONG: "The company keeps pricing power despite competition due to sticky customer workflows.",
      SHORT: "A former moat weakens as competitors replicate features and undercut pricing.",
    },
    failExample: {
      LONG: "Customer churn rises and pricing power fades, signaling moat erosion.",
      SHORT: "Core advantage remains intact with high retention and stable share gains.",
    },
  },
  f_eps: {
    whatItMeasures: "Earnings Per Share tracks how much profit a company generates for each share outstanding.",
    whyItMatters: {
      investment: "For long-term investing, consistent EPS growth supports compounding and usually attracts premium valuation.",
      swing: "For swing trades, beats and revisions can trigger institutional repricing over several sessions.",
      daytrade: "For day trades, EPS surprises around catalysts can drive the clean volatility needed intraday.",
      scalp: "For scalps, EPS mostly matters near event windows that alter immediate order flow.",
    },
    passExample: {
      LONG: "A company posts EPS above consensus and raises guidance, fueling a sustained upside move.",
      SHORT: "EPS misses by a wide margin and management cuts forecasts, confirming downside pressure.",
    },
    failExample: {
      LONG: "EPS has declined for multiple quarters, weakening confidence in upside continuation.",
      SHORT: "EPS just beat strongly with upgraded outlook, making a fresh short lower quality.",
    },
  },
  f_rev: {
    whatItMeasures: "Revenue trend checks demand momentum and business expansion quality.",
    whyItMatters: whyMatters("Top-line direction helps validate or challenge earnings strength."),
    passExample: {
      LONG: "Revenue growth accelerates across key segments with healthy backlog conversion.",
      SHORT: "Revenue growth stalls or turns negative while fixed costs stay high.",
    },
    failExample: {
      LONG: "Revenue is flat despite promotional spend, reducing conviction in upside.",
      SHORT: "Revenue re-accelerates unexpectedly, undermining the bearish demand thesis.",
    },
  },
  f_est: {
    whatItMeasures: "Analyst revision direction captures how expectations are changing ahead of results.",
    whyItMatters: whyMatters("Estimate trends often front-run price trends.") ,
    passExample: {
      LONG: "Consensus EPS and revenue estimates have been revised higher for several weeks.",
      SHORT: "Analysts continue cutting forward estimates after weak channel checks.",
    },
    failExample: {
      LONG: "Revisions are negative while price has already rallied, creating mismatch risk.",
      SHORT: "Revisions turned positive, reducing probability of continued downside.",
    },
  },
  f_ins: {
    whatItMeasures: "Insider activity tracks whether leadership is buying or selling meaningful size.",
    whyItMatters: whyMatters("Insiders often act with better information about near-term trajectory."),
    passExample: {
      LONG: "Multiple executives buy shares in open market after a pullback.",
      SHORT: "Clustered insider selling appears near highs with no offsetting purchases.",
    },
    failExample: {
      LONG: "Repeated insider selling suggests management sees limited upside.",
      SHORT: "Net insider buying rises, weakening confidence in bearish timing.",
    },
  },
  f_inst: {
    whatItMeasures: "Institutional flow checks whether larger funds are accumulating or distributing shares.",
    whyItMatters: whyMatters("Sustained institutional flow often supports multi-session continuation."),
    passExample: {
      LONG: "Recent filings and volume profile suggest steady institutional accumulation.",
      SHORT: "Funds are trimming positions into weak guidance and lower liquidity.",
    },
    failExample: {
      LONG: "Large holders continue reducing exposure despite bullish narrative.",
      SHORT: "Institutional demand returns and absorbs selling pressure.",
    },
  },
  f_debt: {
    whatItMeasures: "Balance-sheet leverage and coverage indicate refinancing and solvency risk.",
    whyItMatters: whyMatters("Leverage quality can accelerate both upside and downside moves."),
    passExample: {
      LONG: "Net debt trends lower while interest coverage remains comfortable.",
      SHORT: "Leverage is elevated and refinancing risk rises in a higher-rate backdrop.",
    },
    failExample: {
      LONG: "Debt burden is increasing faster than cash generation.",
      SHORT: "Leverage metrics are improving, lowering stress-driven downside.",
    },
  },
  f_si: {
    whatItMeasures: "Short interest shows how crowded bearish positioning is.",
    whyItMatters: whyMatters("Crowding can fuel squeezes or add downside pressure depending on catalyst direction."),
    passExample: {
      LONG: "High short interest plus improving fundamentals creates squeeze potential.",
      SHORT: "Short interest rises as fundamentals deteriorate, confirming bearish participation.",
    },
    failExample: {
      LONG: "Short interest is low and falling, limiting squeeze fuel.",
      SHORT: "Very high short interest against improving fundamentals raises squeeze risk.",
    },
  },
  f_beta: {
    whatItMeasures: "Beta measures historical volatility relative to the broader market.",
    whyItMatters: whyMatters("Volatility profile should match your holding period and risk budget."),
    passExample: {
      LONG: "Moderate beta aligns with controlled upside participation in current regime.",
      SHORT: "High-beta name under macro pressure offers stronger downside torque.",
    },
    failExample: {
      LONG: "Beta is too high for current conditions, increasing stop-out risk.",
      SHORT: "Low beta with defensive flows reduces expected short payoff.",
    },
  },
  f_macro: {
    whatItMeasures: "Macro fit checks whether rates, policy, cycle, and liquidity support the thesis.",
    whyItMatters: whyMatters("Macro headwinds or tailwinds can dominate stock-specific factors."),
    passExample: {
      LONG: "Falling yields support longer-duration growth multiples in your target name.",
      SHORT: "Tighter financial conditions pressure a rate-sensitive balance sheet.",
    },
    failExample: {
      LONG: "Macro regime is hostile to the sector despite positive company news.",
      SHORT: "Macro pivot turns supportive, reducing confidence in downside continuation.",
    },
  },
  f_cat: {
    whatItMeasures: "Catalyst quality evaluates upcoming events likely to reprice expectations.",
    whyItMatters: whyMatters("Strong catalysts improve timing and reduce dead-capital trades."),
    passExample: {
      LONG: "Product launch and guidance update are near-term upside catalysts.",
      SHORT: "Regulatory decision and weak pre-announcement create clear downside trigger.",
    },
    failExample: {
      LONG: "No material catalyst is visible, making upside timing uncertain.",
      SHORT: "No bearish catalyst is in sight, increasing chance of range-bound drift.",
    },
  },
  f_float: {
    whatItMeasures: "Float size and share structure influence liquidity and squeeze behavior.",
    whyItMatters: whyMatters("Tighter float can magnify directional moves and slippage."),
    passExample: {
      LONG: "Low float plus rising demand creates asymmetric breakout potential.",
      SHORT: "Expanding float with weak demand adds supply pressure.",
    },
    failExample: {
      LONG: "Heavy upcoming share unlock may cap upside momentum.",
      SHORT: "Float is constrained and borrow is tight, increasing squeeze odds.",
    },
  },
  f_val: {
    whatItMeasures: "Valuation asymmetry estimates mismatch between price and fair value range.",
    whyItMatters: whyMatters("Asymmetry improves reward-to-risk before technical confirmation."),
    passExample: {
      LONG: "DCF and peer comps indicate upside to fair value with improving execution.",
      SHORT: "Market price embeds aggressive assumptions that recent data no longer supports.",
    },
    failExample: {
      LONG: "Most valuation upside has already been captured after a sharp rerating.",
      SHORT: "Stock has already de-rated near conservative fair-value estimates.",
    },
  },
  t_trend: {
    whatItMeasures: "EMA 20/50 alignment tests whether intermediate trend structure supports direction.",
    whyItMatters: whyMatters("Trend alignment reduces fighting dominant market flow."),
    passExample: {
      LONG: "Price holds above rising 20/50 EMA with higher lows.",
      SHORT: "Price stays below falling 20/50 EMA with lower highs.",
    },
    failExample: {
      LONG: "EMA stack is flat or inverted against a long setup.",
      SHORT: "EMA stack starts reclaiming bullish alignment against the short thesis.",
    },
  },
  t_trend200: {
    whatItMeasures: "200-day moving average indicates long-term regime and trend stability.",
    whyItMatters: whyMatters("Higher-timeframe trend context filters noisy signals."),
    passExample: {
      LONG: "Price is above a rising 200DMA with pullbacks defended.",
      SHORT: "Price is below a falling 200DMA and rallies fail beneath it.",
    },
    failExample: {
      LONG: "Price repeatedly loses 200DMA support, weakening bullish structure.",
      SHORT: "Price regains and holds above 200DMA, reducing short quality.",
    },
  },
  t_mom: {
    whatItMeasures: "RSI and MACD momentum confirm whether impulse supports the intended direction.",
    whyItMatters: whyMatters("Momentum confirmation reduces probability of false breakouts and breakdowns."),
    passExample: {
      LONG: "RSI pushes above 50 and MACD histogram expands positively.",
      SHORT: "RSI remains below 50 while MACD momentum stays negative.",
    },
    failExample: {
      LONG: "Momentum diverges bearish while price attempts to break higher.",
      SHORT: "Momentum divergence turns bullish during a short setup.",
    },
  },
  t_vol: {
    whatItMeasures: "Volume confirms participation behind the move.",
    whyItMatters: whyMatters("Directional moves with strong volume are usually more reliable."),
    passExample: {
      LONG: "Breakout occurs on volume well above recent average.",
      SHORT: "Breakdown is accompanied by broad selling volume expansion.",
    },
    failExample: {
      LONG: "Upside move prints on light volume with little follow-through.",
      SHORT: "Downside push lacks participation and snaps back quickly.",
    },
  },
  t_rs: {
    whatItMeasures: "Relative strength compares performance versus benchmark or sector peers.",
    whyItMatters: whyMatters("Leaders and laggards tend to persist across short windows."),
    passExample: {
      LONG: "Stock outperforms index during both up and flat sessions.",
      SHORT: "Stock underperforms benchmark and fails to bounce with market lifts.",
    },
    failExample: {
      LONG: "Relative strength line is falling despite market support.",
      SHORT: "Relative strength improves unexpectedly, signaling sellers are losing control.",
    },
  },
  t_vix: {
    whatItMeasures: "Volatility regime uses VIX/ATR context to judge expansion vs compression risk.",
    whyItMatters: whyMatters("Regime fit matters for sizing, stop width, and holding expectations."),
    passExample: {
      LONG: "Volatility normalizes after panic, enabling trend continuation entries.",
      SHORT: "Volatility expands with risk-off tape, supporting downside continuation.",
    },
    failExample: {
      LONG: "Volatility spike creates erratic range unsuitable for clean continuation.",
      SHORT: "Volatility collapses and downside impulse fades into chop.",
    },
  },
  t_vwap: {
    whatItMeasures: "VWAP shows whether price is trading above or below session value.",
    whyItMatters: whyMatters("Institutional intraday execution often references VWAP."),
    passExample: {
      LONG: "Price reclaims VWAP and holds above it on repeated pullbacks.",
      SHORT: "Price fails retests into VWAP and rotates lower.",
    },
    failExample: {
      LONG: "Price cannot hold above VWAP and repeatedly loses intraday value.",
      SHORT: "Price keeps reclaiming VWAP, weakening short continuation setup.",
    },
  },
  t_ema: {
    whatItMeasures: "Short EMA stack (such as 9/20) tests near-term trend control.",
    whyItMatters: whyMatters("It helps align entries with intraday or short-swing structure."),
    passExample: {
      LONG: "9 EMA stays above 20 EMA while pullbacks hold the stack.",
      SHORT: "9 EMA remains below 20 EMA and bounces fail at resistance.",
    },
    failExample: {
      LONG: "EMA cross turns bearish during a long attempt.",
      SHORT: "Bullish EMA reclaim invalidates short timing edge.",
    },
  },
  t_rsi: {
    whatItMeasures: "Short-horizon RSI estimates momentum pressure and exhaustion points.",
    whyItMatters: whyMatters("RSI context helps avoid chasing stretched entries."),
    passExample: {
      LONG: "RSI rises from neutral into strength without extreme exhaustion.",
      SHORT: "RSI breaks down from midline and remains weak.",
    },
    failExample: {
      LONG: "RSI diverges lower while price pushes marginal highs.",
      SHORT: "RSI forms bullish divergence during a short setup.",
    },
  },
  t_atr: {
    whatItMeasures: "ATR checks whether expected range is sufficient for your R targets.",
    whyItMatters: whyMatters("Range compression can make good ideas untradeable for your plan."),
    passExample: {
      LONG: "ATR supports reaching 2R before major resistance.",
      SHORT: "ATR expansion allows downside targets without overly wide stops.",
    },
    failExample: {
      LONG: "ATR is too compressed to justify target distance.",
      SHORT: "ATR contraction makes short payoff insufficient relative to risk.",
    },
  },
  t_level: {
    whatItMeasures: "Support/resistance structure identifies inflection zones and invalidation quality.",
    whyItMatters: whyMatters("Clean levels improve entry precision and stop placement."),
    passExample: {
      LONG: "Break and hold above resistance flips level into support.",
      SHORT: "Support breaks and fails on retest, confirming role reversal.",
    },
    failExample: {
      LONG: "Entry is directly into major resistance with no clearance.",
      SHORT: "Price sits above layered support with no breakdown confirmation.",
    },
  },
  t_ema5: {
    whatItMeasures: "Fast EMA ribbon tracks micro-trend control for very short holding periods.",
    whyItMatters: whyMatters("Scalps need immediate trend alignment and fast invalidation."),
    passExample: {
      LONG: "5/8/13 EMA ribbon fans upward and holds on pullbacks.",
      SHORT: "Ribbon stays stacked bearish with failed rebound attempts.",
    },
    failExample: {
      LONG: "Ribbon compresses and flips repeatedly, signaling chop.",
      SHORT: "Ribbon starts crossing bullishly against the short.",
    },
  },
  t_stoch: {
    whatItMeasures: "Stochastic oscillator highlights short-cycle momentum turns in fast markets.",
    whyItMatters: whyMatters("Useful for timing entries when trend and liquidity already align."),
    passExample: {
      LONG: "Stochastic crosses up from a reset zone while price holds structure.",
      SHORT: "Stochastic crosses down from elevated zone into resistance.",
    },
    failExample: {
      LONG: "Bearish stochastic crossover occurs near entry zone.",
      SHORT: "Bullish crossover appears as downside momentum fades.",
    },
  },
  t_bb: {
    whatItMeasures: "Bollinger Bands visualize volatility compression and expansion phases.",
    whyItMatters: whyMatters("Band behavior helps frame breakout odds vs mean-reversion risk."),
    passExample: {
      LONG: "Price breaks above upper band after squeeze with rising volume.",
      SHORT: "Price rejects upper band and rotates lower from failed expansion.",
    },
    failExample: {
      LONG: "Repeated upper-band rejections suggest exhaustion, not expansion.",
      SHORT: "Lower-band extensions fail to continue and snap back.",
    },
  },
  t_rsi5: {
    whatItMeasures: "RSI(5) captures very short momentum pulses for scalp timing.",
    whyItMatters: whyMatters("It helps avoid entries after impulse already spent."),
    passExample: {
      LONG: "RSI(5) reclaims midline after shallow pullback within up-move.",
      SHORT: "RSI(5) fails at midline and rolls lower in down-move.",
    },
    failExample: {
      LONG: "RSI(5) remains weak while attempting long continuation.",
      SHORT: "RSI(5) forms strong bullish divergence against short thesis.",
    },
  },
  t_obv: {
    whatItMeasures: "OBV tracks whether volume is confirming accumulation or distribution.",
    whyItMatters: whyMatters("Volume flow divergence can warn early of trend fatigue."),
    passExample: {
      LONG: "OBV makes higher highs with price, confirming accumulation.",
      SHORT: "OBV trends down while price weakens, confirming distribution.",
    },
    failExample: {
      LONG: "Price rises but OBV stalls, hinting weak participation.",
      SHORT: "Price dips but OBV improves, warning of hidden buying.",
    },
  },
  t_adx: {
    whatItMeasures: "ADX measures trend strength regardless of direction.",
    whyItMatters: whyMatters("Higher ADX supports continuation setups over choppy mean reversion."),
    passExample: {
      LONG: "ADX rises above trend threshold while bullish structure is intact.",
      SHORT: "ADX rises as price trends lower, confirming persistent trend pressure.",
    },
    failExample: {
      LONG: "ADX is low and falling, raising chop risk for long continuation.",
      SHORT: "ADX weakens as downside stalls, reducing short follow-through odds.",
    },
  },
  t_psar: {
    whatItMeasures: "Parabolic SAR dots mark trailing trend direction and reversal risk.",
    whyItMatters: whyMatters("It provides a consistent structure for trailing risk and exits."),
    passExample: {
      LONG: "SAR dots remain below price and trail upward cleanly.",
      SHORT: "SAR dots stay above price during lower-low sequence.",
    },
    failExample: {
      LONG: "SAR flips above price soon after entry, signaling trend weakness.",
      SHORT: "SAR flips below price as short setup loses control.",
    },
  },
  t_fib: {
    whatItMeasures: "Fibonacci levels frame pullback and extension zones within a directional move.",
    whyItMatters: whyMatters("They help pre-plan entries and targets around common reaction areas."),
    passExample: {
      LONG: "Pullback holds near 38.2%-50% retracement before trend resumes.",
      SHORT: "Bearish rebound fails near 50%-61.8% retracement resistance.",
    },
    failExample: {
      LONG: "Price breaks deeply through key retracement support without reaction.",
      SHORT: "Price reclaims major retracement levels and invalidates bearish structure.",
    },
  },
  t_macdh: {
    whatItMeasures: "MACD histogram tracks acceleration or deceleration of directional momentum.",
    whyItMatters: whyMatters("Momentum acceleration often confirms better continuation probability."),
    passExample: {
      LONG: "Histogram bars expand positively as price breaks higher.",
      SHORT: "Histogram turns more negative as support fails.",
    },
    failExample: {
      LONG: "Histogram weakens despite price uptick, signaling fading thrust.",
      SHORT: "Histogram contracts and turns up against downside thesis.",
    },
  },
};

export const SETUP_EXPLANATIONS: Record<string, string> = {
  Breakout: "Price clears a well-defined resistance zone with participation, signaling potential trend expansion.",
  Breakdown: "Price loses key support and fails recovery attempts, often starting a downside continuation leg.",
  Continuation: "Trend pauses in a controlled consolidation, then resumes in the same direction.",
  Reversal: "Exhaustion and structure shift indicate likely direction change after an established move.",
  "Mean Reversion": "Price stretches from fair value and tends to snap back toward its average range.",
  Pullback: "Countertrend retrace into support/resistance offers an entry in direction of larger trend.",
  "Trend Resumption": "The dominant trend regains control after a shallow reset, often offering a cleaner continuation entry than the initial impulse.",
  "Base Break": "A long consolidation resolves through the edge of the base, signaling fresh range expansion from stored energy.",
  "Failed Breakdown": "Price loses support but quickly reclaims it, trapping late sellers and often fueling an upside squeeze.",
  "Failed Breakout": "Price clears resistance but cannot hold above it, trapping late buyers and often reversing lower.",
  "Gap and Go": "A catalyst gap holds its opening auction and continues in the direction of the gap instead of fading it.",
  "Gap Fill Fade": "An opening gap exhausts and rotates back toward the prior close as momentum fails to hold.",
  "Earnings Momentum": "Post-earnings repricing drives sustained directional flows as expectations reset.",
  "Post-Earnings Drift": "The first earnings reaction keeps extending over the following sessions as institutions continue repositioning.",
  "News Catalyst": "A fresh event changes narrative and liquidity enough to create a tradeable move.",
  "Relative Strength Leader": "The name is outperforming peers and the benchmark, which often keeps attracting capital on shallow pullbacks.",
  "Relative Weakness Laggard": "The name keeps lagging peers and the benchmark, which often leads to cleaner downside continuation on weak bounces.",
  "IPO Expansion": "A recent IPO moves through discovery levels and can accelerate quickly because long-term supply and resistance are not well formed yet.",
};

export const ANALYTICS_GUIDE = {
  winRate: "Good if stable above 50% with controlled losses. Weak if falling while average loss grows.",
  expectancy: "Good if positive over large samples. Weak if negative or degrading over recent trades.",
  profitFactor: "Good above 1.3. Weak below 1.0 where losses outweigh gains.",
  rolling: "Compare rolling expectancy to full-sample expectancy to detect drift in edge quality.",
};

export function getMetricExplanation(metricId: string): MetricExplanation | null {
  return METRIC_EXPLANATIONS[metricId] ?? null;
}
export const LEARN_EXPLANATIONS = {
  placeholder: "TODO: add metric explanations",
} as const;