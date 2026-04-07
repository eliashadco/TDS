import { z } from "zod";

const tickerRegex = /^[A-Z]{1,12}$/;

export const thesisSchema = z.object({
  ticker: z.string().trim().toUpperCase().regex(tickerRegex, "Ticker must be 1-12 uppercase letters"),
  direction: z.enum(["LONG", "SHORT"]),
  assetClass: z.string().trim().min(2),
  setupTypes: z.array(z.string()).min(1, "Select at least one setup type"),
  thesis: z.string().trim().min(10, "Thesis is too short"),
  invalidation: z.string().trim().min(5, "Invalidation is required"),
  catalystWindow: z.string().trim().optional(),
});

export const executionSchema = z
  .object({
    entryPrice: z.number().positive(),
    stopLoss: z.number().positive(),
  })
  .refine((input) => input.entryPrice !== input.stopLoss, {
    message: "Entry and stop must differ",
    path: ["stopLoss"],
  });

export const metricCustomSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().min(5).max(240),
});

export const equitySchema = z.object({
  equity: z.number().positive().max(1_000_000_000),
});
