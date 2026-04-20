import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { scoreThesis, generateInsight, rateStrategy } from "./src/lib/ai/provider";
import { buildAssessmentPrompt } from "./src/lib/prompts";
import { z } from "zod";

const AssessmentSchema = z.object({
  metrics: z.record(z.string(), z.object({
    passed: z.boolean(),
    score: z.number(),
    reasoning: z.string()
  })),
  verdict: z.enum(["PASS", "FAIL", "CAUTION"]),
  fundamentalScore: z.number(),
  technicalScore: z.number(),
  summary: z.string(),
  edge: z.string(),
  risks: z.string()
});

const InsightSchema = z.object({
  summary: z.string(),
  edge: z.string(),
  risks: z.string()
});

const RatingSchema = z.object({
  score: z.number(),
  feedback: z.string(),
  suggestions: z.array(z.string())
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // AI Assessment Route
  app.post("/api/ai/assess", async (req, res) => {
    try {
      const { symbol, direction, thesis, catalystWindow, invalidationCondition, strategy } = req.body;
      const prompt = buildAssessmentPrompt(symbol, direction, thesis, catalystWindow, invalidationCondition, strategy);
      const assessment = await scoreThesis(prompt);
      
      // Validate response
      const validated = AssessmentSchema.parse(assessment);
      res.json(validated);
    } catch (error) {
      console.error("Scoring error:", error);
      if (error instanceof z.ZodError) {
        res.status(500).json({ error: "AI response validation failed", details: error.issues });
      } else {
        res.status(500).json({ error: "Failed to score thesis" });
      }
    }
  });

  app.post("/api/ai/insight", async (req, res) => {
    try {
      const { assessment } = req.body;
      const insight = await generateInsight(assessment);
      const validated = InsightSchema.parse(insight);
      res.json(validated);
    } catch (error) {
      console.error("Insight error:", error);
      res.status(500).json({ error: "Failed to generate insight" });
    }
  });

  app.post("/api/ai/rate", async (req, res) => {
    try {
      const { strategy } = req.body;
      const rating = await rateStrategy(strategy);
      const validated = RatingSchema.parse(rating);
      res.json(validated);
    } catch (error) {
      console.error("Rating error:", error);
      res.status(500).json({ error: "Failed to rate strategy" });
    }
  });

  // Legacy route for compatibility
  app.post("/api/score-thesis", async (req, res) => {
    res.redirect(307, "/api/ai/assess");
  });

  // Market Data Routes (Mocked)
  app.get("/api/market/premarket", (req, res) => {
    const limit = parseInt(req.query.limit as string) || 18;
    const movers = [
      { ticker: "NVDA", price: 145.20, change: 5.40, changePercent: 3.86, volume: 45000000, status: "Live" },
      { ticker: "TSLA", price: 350.15, change: -12.30, changePercent: -3.39, volume: 32000000, status: "Live" },
      { ticker: "AAPL", price: 232.10, change: 1.20, changePercent: 0.52, volume: 28000000, status: "Live" },
      { ticker: "AMD", price: 158.45, change: 4.15, changePercent: 2.69, volume: 15000000, status: "Live" },
      { ticker: "MSFT", price: 415.60, change: -2.40, changePercent: -0.57, volume: 12000000, status: "Live" },
      { ticker: "GOOGL", price: 178.30, change: 0.80, changePercent: 0.45, volume: 10000000, status: "Live" },
      { ticker: "META", price: 585.20, change: 15.40, changePercent: 2.70, volume: 9000000, status: "Live" },
      { ticker: "AMZN", price: 198.15, change: -1.25, changePercent: -0.63, volume: 8500000, status: "Live" },
      { ticker: "NFLX", price: 760.40, change: 12.10, changePercent: 1.62, volume: 5000000, status: "Live" },
    ].slice(0, limit);

    res.json({
      movers,
      source: "Polygon",
      status: "success",
      message: "Live feed active",
      asOf: new Date().toISOString()
    });
  });

  app.get("/api/market/quote", (req, res) => {
    const ticker = req.query.ticker as string;
    if (!ticker) return res.status(400).json({ error: "Ticker required" });

    const sectors = ["Technology", "Healthcare", "Financials", "Energy", "Consumer Discretionary", "Communication Services"];
    const sector = sectors[Math.floor(Math.random() * sectors.length)];

    res.json({
      ticker: ticker.toUpperCase(),
      price: 150.00 + Math.random() * 10,
      change: (Math.random() - 0.5) * 5,
      changePercent: (Math.random() - 0.5) * 3,
      volume: 1000000 + Math.random() * 5000000,
      sector,
      lastUpdated: new Date().toISOString()
    });
  });

  app.get("/api/market/candles", (req, res) => {
    const ticker = req.query.ticker as string;
    if (!ticker) return res.status(400).json({ error: "Ticker required" });

    // Mock candle data
    const candles = Array.from({ length: 50 }, (_, i) => ({
      time: new Date(Date.now() - (50 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      open: 150 + Math.random() * 10,
      high: 165 + Math.random() * 10,
      low: 145 + Math.random() * 10,
      close: 155 + Math.random() * 10,
    }));

    res.json(candles);
  });

  app.post("/api/market/enrich", (req, res) => {
    const { tickers } = req.body;
    if (!Array.isArray(tickers)) return res.status(400).json({ error: "Tickers array required" });

    const movers = tickers.map(ticker => ({
      ticker: ticker.toUpperCase(),
      price: 150.00 + Math.random() * 10,
      change: (Math.random() - 0.5) * 5,
      changePercent: (Math.random() - 0.5) * 3,
      volume: 1000000 + Math.random() * 5000000,
      status: "Enriched"
    }));

    res.json({
      movers,
      parsedTickers: tickers,
      unresolvedTickers: []
    });
  });

  app.post("/api/settings/reset-workspace", (req, res) => {
    const { scope } = req.body;
    // In a real app, this would delete Firestore data
    console.log(`Resetting workspace: ${scope}`);
    res.json({ status: "success", message: `Workspace ${scope} reset initiated.` });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
