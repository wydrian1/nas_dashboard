import { formatMoney, formatMonth, formatPercent } from '@/lib/finance/types';
import { cpiGrowthPeriods, realGrowthPeriods } from '@/lib/finance/market-types';
import type { FinanceSnapshot } from '@/lib/finance/types';
import type { InflationSeries } from '@/lib/finance/inflation-types';
import { KSH_MONTHLY_URL } from '@/lib/finance/inflation-types';

export default function RealGrowth({snapshot,inflation=null,inflationError=null}:{snapshot:FinanceSnapshot;inflation?:InflationSeries|null;inflationError?:string|null}) {
  const periods=inflation ? cpiGrowthPeriods(snapshot,inflation) : realGrowthPeriods(snapshot),latest=periods.at(-1),annual=inflation?.annual.at(-1);
  return <section className="finance-card finance-real" aria-labelledby="real-growth-title"><div className="finance-section-head"><div><span className="eyebrow">VÁSÁRLÓERŐ ÉS GYARAPODÁS</span><h2 id="real-growth-title">Reálérték-növekedés</h2></div>{latest && <span className="finance-real-period">{inflation ? formatMonth(latest.label) : latest.label} · éves összehasonlítás</span>}</div>
    {inflationError && <p className="error">{inflationError}</p>}
    {inflation && <p>Automatikus KSH-adatok · az előző év azonos hónapjához képest. {latest && latest.label!==snapshot.selected?.month ? `${formatMonth(snapshot.selected!.month)} inflációja még nem érhető el, ezért a legutóbbi összehasonlítható állapotot mutatjuk.` : ''}</p>}
    {!latest ? <p>Ehhez az állapothoz még nincs teljes, inflációval lefedett éves összehasonlítás.</p> : <>
      <div className="finance-real-kpis"><div><span>Inflációval korrigált gyarapodás</span><strong className={latest.real<0 ? 'finance-negative' : 'finance-positive'}>{formatPercent(latest.real)}</strong><small>{latest.startDate} → {latest.endDate}</small></div><div><span>Vagyongyarapodás reálértéken</span><strong>{formatMoney(latest.realGain)}</strong><small>Az időszak kezdetének vásárlóerején</small></div><div><span>Éves infláció</span><strong>{formatPercent(latest.inflation)}</strong><small>Nominális növekedés: {formatPercent(latest.nominal)}</small></div></div>
      <RealBars periods={periods.slice(-12)}/>
      <details><summary>Éves adatok és számítás</summary><div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Év / állapotok</th><th>Nominális növekedés</th><th>Infláció</th><th>Reálnövekedés</th></tr></thead><tbody>{periods.map(period=><tr key={period.label}><th>{period.label}<small className="finance-period-dates">{period.startDate} → {period.endDate}</small></th><td>{formatPercent(period.nominal)}</td><td>{formatPercent(period.inflation)}</td><td className={period.real<0 ? 'finance-negative' : 'finance-positive'}>{formatPercent(period.real)}</td></tr>)}</tbody></table></div></details>
    </>}
    {annual && <p className="footnote">Legutolsó teljes naptári év átlagos inflációja: <strong>{annual.year}: {formatPercent(annual.rate)}</strong>. Ez külön mutató; a havi éves összehasonlításhoz nem ezt, hanem az adott hónap azonos időszaki árindexét használjuk.</p>}
    <p className="footnote">Reálnövekedés = (1 + nominális növekedés) / (1 + infláció) − 1. {inflation ? <a href={KSH_MONTHLY_URL} target="_blank" rel="noopener noreferrer">Forrás: KSH, havi összesített fogyasztóiár-index</a> : 'A korábbi éves infláció a megadott táblázatból származik.'}; hiányzó időszakra nem becsülünk értéket. A befizetések és kivétek is részei a vagyongyarapodásnak, ezért ez nem befektetési hozam.</p>
  </section>;
}
function RealBars({periods}:{periods:ReturnType<typeof realGrowthPeriods>}) {
  const width=850,height=280,left=58,right=18,top=28,bottom=45;
  const all=periods.flatMap(period=>[period.nominal,period.inflation,period.real]),low=Math.min(0,...all),high=Math.max(.05,...all),span=high-low;
  const y=(value:number)=>top+(high-value)*(height-top-bottom)/span,zero=y(0),group=(width-left-right)/periods.length,bar=Math.min(42,group/4.5);
  const series=[['nominal','Nominális'],['inflation','Infláció'],['real','Reálérték']] as const;
  return <><div className="finance-real-legend">{series.map(([key,label])=><span key={key}><i className={'finance-real-dot '+key}/>{label}</span>)}</div><svg className="finance-real-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Éves nominális vagyonnövekedés, infláció és reálérték-növekedés oszlopdiagramja. Pontos értékek az éves adattáblában.">
    {[0,.25,.5,.75,1].map(step=>{const value=low+span*step;return <g key={step}><line x1={left} x2={width-right} y1={y(value)} y2={y(value)} className="finance-gridline"/><text x={left-10} y={y(value)+4} textAnchor="end">{Math.round(value*100)}%</text></g>;})}
    <line x1={left} x2={width-right} y1={zero} y2={zero} className="finance-real-zero"/>
    {periods.map((period,index)=><g key={period.label}>{series.map(([key,label],i)=>{const value=period[key],x=left+group*(index+.5)+(i-1.5)*bar;return <rect key={key} x={x} y={Math.min(zero,y(value))} width={bar-5} height={Math.max(1,Math.abs(zero-y(value)))} rx={3} className={'finance-real-bar '+key}><title>{period.label} · {label}: {formatPercent(value)}</title></rect>;})}<text x={left+group*(index+.5)} y={height-15} textAnchor="middle">{period.label}</text></g>)}
  </svg></>;
}
