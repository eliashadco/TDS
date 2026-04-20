// Mocking market data for now, would use Polygon/Yahoo in real app
export async function getQuote(symbol: string) {
  return {
    symbol,
    price: 150 + Math.random() * 10,
    change: (Math.random() - 0.5) * 5,
    changePercent: (Math.random() - 0.5) * 2,
    timestamp: new Date().toISOString(),
  };
}

export async function getCandles(symbol: string, range: string, timeframe: string) {
  const count = 50;
  const data = [];
  let lastPrice = 150;
  for (let i = 0; i < count; i++) {
    const open = lastPrice;
    const close = open + (Math.random() - 0.5) * 5;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    data.push({
      time: new Date(Date.now() - (count - i) * 3600000).toISOString(),
      open,
      high,
      low,
      close,
    });
    lastPrice = close;
  }
  return data;
}
