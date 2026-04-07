"use client";

import { useEffect, useRef } from "react";
import { CandlestickSeries, ColorType, CrosshairMode, LineStyle, createChart } from "lightweight-charts";
import type { UTCTimestamp } from "lightweight-charts";
import type { Candle, CandleTimeframe } from "@/types/market";

type PriceChartProps = {
  candles: Candle[];
  entryPrice?: number;
  stopLoss?: number;
  r2Target?: number;
  r4Target?: number;
  direction?: "LONG" | "SHORT";
  timeframe?: CandleTimeframe;
  height?: number;
};

export default function PriceChart({
  candles,
  entryPrice,
  stopLoss,
  r2Target,
  r4Target,
  direction = "LONG",
  timeframe = "day",
  height = 300,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) {
      return;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#6b7b8f",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "#e2e8f0" },
        horzLines: { color: "#e2e8f0" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: "#d8e2ec",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "#d8e2ec",
        timeVisible: timeframe !== "week",
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#059669",
      downColor: "#dc2626",
      borderUpColor: "#059669",
      borderDownColor: "#dc2626",
      wickUpColor: "#059669",
      wickDownColor: "#dc2626",
    });

    candleSeries.setData(
      candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    );

    if (entryPrice) {
      candleSeries.createPriceLine({
        price: entryPrice,
        color: "#2563eb",
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: "Entry",
      });
    }

    if (stopLoss) {
      candleSeries.createPriceLine({
        price: stopLoss,
        color: "#dc2626",
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: "Stop",
      });
    }

    if (r2Target) {
      candleSeries.createPriceLine({
        price: r2Target,
        color: "#059669",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "2R",
      });
    }

    if (r4Target) {
      candleSeries.createPriceLine({
        price: r4Target,
        color: "#059669",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "4R",
      });
    }

    chart.timeScale().fitContent();

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) {
        chart.applyOptions({ width });
      }
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [candles, direction, entryPrice, height, r2Target, r4Target, stopLoss, timeframe]);

  if (candles.length === 0) {
    return (
      <div className="fin-card flex h-64 items-center justify-center text-xs text-tds-dim">
        No candle data available.
      </div>
    );
  }

  return <div ref={containerRef} className="w-full overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_20px_50px_-34px_rgba(15,23,42,0.26)]" />;
}