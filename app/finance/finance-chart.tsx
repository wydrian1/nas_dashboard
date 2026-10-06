"use client";
import { useState } from 'react';
import { formatMoney, formatMonth } from '@/lib/finance/types';
import type { FinancePoint } from '@/lib/finance/types';
import { financeChartBounds } from '@/lib/finance/chart-types';

export default function FinanceChart({points,selectedMonth}:{points:FinancePoint[];selectedMonth:string}) {
  const [range,setRange]=useState('12');
  const eligible=points.filter(point=>point.month<=selectedMonth),shown=range==='all' ? eligible : eligible.slice(-Number(range));
  const [hover,setHover]=useState<string|null>(null);
  const focus=shown.find(point=>point.month===hover) || shown.at(-1);
  if(!shown.length)return null;
  const width=900,height=270,left=86,right=18,top=20,bottom=44;
  const {low,high,span}=financeChartBounds(shown);
  const x=(i:number)=>shown.length===1 ? (width+left-right)/2 : left+i*(width-left-right)/(shown.length-1);
  const y=(amount:number)=>top+(high-amount)*(height-top-bottom)/span;
  const line=(key:'net'|'assets')=>shown.map((point,index)=>`${x(index)},${y(point[key])}`).join(' ');
  return <section className="finance-card finance-trend" aria-labelledby="finance-trend-title">
    <div className="finance-section-head"><div><span className="eyebrow">GYARAPODÁS</span><h2 id="finance-trend-title">Vagyon alakulása</h2></div><div className="finance-ranges" aria-label="Grafikon időtávja">{[['12','12 hónap'],['24','24 hónap'],['all','Teljes idősor']].map(([value,label])=><button key={value} type="button" aria-pressed={range===value} onClick={()=>{setRange(value);setHover(null);}}>{label}</button>)}</div></div>
    <div className="finance-chart-caption"><span><i className="finance-dot net"/>Nettó vagyon</span><span><i className="finance-dot assets"/>Eszközök</span><strong>{focus && `${formatMonth(focus.month)} · ${formatMoney(focus.net)}`}</strong></div>
    <svg className="finance-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Vagyontrend ${shown[0].month} és ${shown.at(-1)!.month} között. A részletes havi értékek a grafikon alatti táblázatban találhatók.`}>
      {[0,.25,.5,.75,1].map(step=>{const amount=low+span*step;return <g key={step}><line x1={left} x2={width-right} y1={y(amount)} y2={y(amount)} className="finance-gridline"/><text x={left-12} y={y(amount)+4} textAnchor="end">{new Intl.NumberFormat('hu-HU',{maximumFractionDigits:1}).format(amount/100_000_000)} M Ft</text></g>;})}
      <polyline points={line('assets')} className="finance-line assets"/><polyline points={line('net')} className="finance-line net"/>
      {shown.map((point,index)=><a key={point.month} href={`/finance?month=${point.month}`} aria-label={`${formatMonth(point.month)}: ${formatMoney(point.net)}`} onMouseEnter={()=>setHover(point.month)} onMouseLeave={()=>setHover(null)} onFocus={()=>setHover(point.month)} onBlur={()=>setHover(null)}><circle cx={x(index)} cy={y(point.net)} r={hover===point.month || point.month===selectedMonth ? 6 : 4} className="finance-chart-point"/><title>{`${formatMonth(point.month)}: ${formatMoney(point.net)}`}</title></a>)}
      {shown.map((point,index)=>index===0 || index===shown.length-1 || index%Math.max(1,Math.ceil(shown.length/6))===0 ? <text key={point.month} x={x(index)} y={height-14} textAnchor={index===0 ? 'start' : index===shown.length-1 ? 'end' : 'middle'}>{point.month}</text> : null)}
    </svg>
    <p className="footnote">A függőleges skála a megjelenített időszak minimumától indul, nem nullától. Egyenlegváltozás, nem befektetési hozam: befizetés, kivét, értékváltozás és tartozáscsökkenés is módosíthatja. Kattints egy hónap pontjára a részletekhez.</p>
    <details><summary>Havi értékek · {shown.length} állapot</summary><div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Hónap</th><th>Eszközök</th><th>Tartozások</th><th>Nettó vagyon</th></tr></thead><tbody>{shown.map(point=><tr key={point.month}><th><a href={`/finance?month=${point.month}`}>{formatMonth(point.month)}</a></th><td>{formatMoney(point.assets)}</td><td>{formatMoney(point.debt)}</td><td>{formatMoney(point.net)}</td></tr>)}</tbody></table></div></details>
  </section>;
}
