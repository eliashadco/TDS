import * as React from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { TrendingUp, TrendingDown, Search } from 'lucide-react';
import { getQuote } from '../../services/marketData';
import { formatCurrency, formatPercent } from '../../lib/utils';

export function MarketWatchClient() {
  const [tickers, setTickers] = React.useState(['NVDA', 'AAPL', 'TSLA', 'MSFT', 'AMD']);
  const [quotes, setQuotes] = React.useState<{ [key: string]: any }>({});
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    async function fetchQuotes() {
      const newQuotes: any = {};
      for (const ticker of tickers) {
        newQuotes[ticker] = await getQuote(ticker);
      }
      setQuotes(newQuotes);
    }
    fetchQuotes();
    const interval = setInterval(fetchQuotes, 30000);
    return () => clearInterval(interval);
  }, [tickers]);

  const addTicker = () => {
    if (search && !tickers.includes(search.toUpperCase())) {
      setTickers([...tickers, search.toUpperCase()]);
      setSearch('');
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif italic text-xl">Market Watch</h3>
        <div className="flex gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Add Ticker..."
            className="w-32 h-8 text-xs"
            onKeyDown={(e) => e.key === 'Enter' && addTicker()}
          />
          <Button size="sm" onClick={addTicker} variant="secondary">
            <Search size={14} />
          </Button>
        </div>
      </div>

      <div className="bg-white border border-[var(--line)]">
        <div className="grid grid-cols-[1fr_100px_100px_100px] p-3 border-b border-[var(--line)] bg-gray-50">
          <span className="col-header">Instrument</span>
          <span className="col-header text-right">Price</span>
          <span className="col-header text-right">Change</span>
          <span className="col-header text-right">% Chg</span>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {tickers.map((ticker) => {
            const quote = quotes[ticker];
            if (!quote) return null;
            const isPositive = quote.change >= 0;
            return (
              <div key={ticker} className="grid grid-cols-[1fr_100px_100px_100px] p-3 items-center hover:bg-gray-50 transition-colors cursor-pointer">
                <div className="font-mono font-bold">{ticker}</div>
                <div className="font-mono text-sm text-right">{formatCurrency(quote.price)}</div>
                <div className={cn('font-mono text-sm text-right flex items-center justify-end gap-1', isPositive ? 'text-green-600' : 'text-red-600')}>
                  {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {quote.change.toFixed(2)}
                </div>
                <div className={cn('font-mono text-sm text-right', isPositive ? 'text-green-600' : 'text-red-600')}>
                  {quote.changePercent.toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
