import { Metric, Direction } from './types';

export function getDirectionDescription(metric: Metric, direction: Direction): string {
  return direction === 'LONG' ? metric.longInterpretation : metric.shortInterpretation;
}
