import { TradeAssessment, Strategy, Direction } from "../lib/types";

export async function assessThesis(thesis: string, strategy: Strategy, direction: Direction, symbol: string = 'REASSESSMENT'): Promise<TradeAssessment> {
  const response = await fetch('/api/ai/assess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      thesis,
      strategy,
      direction,
      symbol
    })
  });
  
  if (!response.ok) {
    throw new Error('Assessment failed');
  }
  
  return response.json();
}
