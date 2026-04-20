import * as React from 'react';
import { Trade } from '../../lib/types';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowRight } from 'lucide-react';

interface ReadyTradesCardProps {
  trades: Trade[];
}

export function ReadyTradesCard({ trades }: ReadyTradesCardProps) {
  const navigate = useNavigate();
  const readyTrades = trades.filter(t => t.status === 'PLANNING');

  if (readyTrades.length === 0) return null;

  return (
    <Card className="bg-white border-[var(--line)]">
      <CardHeader className="p-4 border-b border-[var(--line)] flex flex-row items-center justify-between">
        <h4 className="col-header flex items-center gap-2">
          <Zap size={14} className="text-yellow-500" /> Ready to Execute
        </h4>
        <span className="font-mono text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
          {readyTrades.length} ACTIONABLE
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-[var(--line)]">
          {readyTrades.map((trade) => (
            <div key={trade.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-serif italic text-lg">{trade.symbol}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    trade.direction === 'LONG' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {trade.direction}
                  </span>
                </div>
                <p className="text-xs opacity-50 font-mono">
                  Conviction: {trade.conviction} • Size: {trade.positionSize} shares
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="font-mono text-[10px] gap-2"
                onClick={() => navigate(`/trade/${trade.id}`)}
              >
                EXECUTE <ArrowRight size={12} />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
