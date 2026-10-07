import type { FinancePoint } from './types.ts';

export function financeChartBounds(points:Pick<FinancePoint,'net'|'assets'>[]):{low:number;high:number;span:number} {
  const values=points.flatMap(point=>[point.net,point.assets]);
  const low=values.length ? Math.min(...values) : 0,max=values.length ? Math.max(...values) : 0;
  // Keep flat and single-point series drawable without forcing a zero baseline.
  const high=max>low ? max : low+Math.max(100,Math.abs(low)*.01);
  return {low,high,span:high-low};
}
