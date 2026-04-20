import { Trade } from '../../lib/types';
import { Badge } from '../ui/Badge';
import { formatCurrency } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

export function ActivePositionsCard({ trades }: { trades: Trade[] }) {
  const navigate = useNavigate();

  return (
    <section>
      <h3 className="font-serif italic text-xl mb-4">Active Positions</h3>
      <div className="bg-white border border-[var(--line)]">
        <div className="grid grid-cols-[80px_1fr_100px_100px_100px] p-4 border-b border-[var(--line)] bg-gray-50">
          <span className="col-header">Ticker</span>
          <span className="col-header">Thesis</span>
          <span className="col-header">Entry</span>
          <span className="col-header">P&L</span>
          <span className="col-header">Status</span>
        </div>
        
        {trades.length === 0 ? (
          <div className="p-12 text-center opacity-30 italic font-serif">
            No active positions in current lane.
          </div>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {trades.map((trade) => (
              <div
                key={trade.id}
                onClick={() => navigate(`/trade/${trade.id}`)}
                className="grid grid-cols-[80px_1fr_100px_100px_100px] p-4 items-center hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="font-mono font-bold">{trade.symbol}</div>
                <div className="text-xs opacity-70 line-clamp-1 italic pr-4">{trade.thesis}</div>
                <div className="font-mono text-sm">{trade.entryPrice ? formatCurrency(trade.entryPrice) : '—'}</div>
                <div className="font-mono text-sm">—</div>
                <div>
                  <Badge variant={trade.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {trade.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
