import { formatMoney } from '@/lib/finance/types';
import type { FinanceSnapshot } from '@/lib/finance/types';

const colors=['#a8efc9','#71a9ed','#bea1ff','#f2d58d','#ef9ca6','#69c8cf','#eeac7e','#8ea8cf','#c9dc89','#d7a9d0','#7db48c','#9d9ade'];
export default function FinanceComposition({snapshot}:{snapshot:FinanceSnapshot}) {
  const {selected,accounts,balances}=snapshot;if(!selected)return null;
  const amounts=new Map(balances.map(balance=>[balance.account_id,balance.amount_minor])),grouped=new Map<string,number>();
  for(const account of accounts)if(account.kind==='asset')grouped.set(account.category,(grouped.get(account.category) || 0)+(amounts.get(account.id) || 0));
  const categories=[...grouped].filter(([,amount])=>amount>0).sort((a,b)=>b[1]-a[1]);
  const radius=82,circumference=2*Math.PI*radius;let offset=0;
  return <section className="finance-card"><div className="finance-section-head"><h2>Vagyon összetétele</h2></div><div className="finance-composition">
    <svg viewBox="0 0 240 240" className="finance-pie" role="img" aria-label={`Pozitív eszközök megoszlása kategóriánként, összesen ${formatMoney(selected.assets)}. Pontos értékek a jelmagyarázatban.`}>
      <circle cx={120} cy={120} r={radius} fill="none" stroke="#242c39" strokeWidth={28}/>
      {categories.map(([name,amount],index)=>{const share=amount/selected.assets,dash=share*circumference,start=offset;offset+=dash;return <circle key={name} cx={120} cy={120} r={radius} fill="none" stroke={colors[index%colors.length]} strokeWidth={28} strokeDasharray={`${Math.max(0,dash-1.5)} ${circumference}`} strokeDashoffset={-start} transform="rotate(-90 120 120)"><title>{`${name}: ${formatMoney(amount)} · ${new Intl.NumberFormat('hu-HU',{style:'percent',maximumFractionDigits:1}).format(share)}`}</title></circle>;})}
      <text x={120} y={111} textAnchor="middle" className="finance-pie-label">Eszközök</text><text x={120} y={139} textAnchor="middle" className="finance-pie-total">{new Intl.NumberFormat('hu-HU',{maximumFractionDigits:2}).format(selected.assets/100_000_000)} M Ft</text>
    </svg>
    <ul className="finance-pie-legend">{categories.map(([name,amount],index)=><li key={name}><i style={{background:colors[index%colors.length]}}/><div><span>{name}</span><small>{new Intl.NumberFormat('hu-HU',{style:'percent',maximumFractionDigits:1}).format(amount/selected.assets)}</small></div><strong>{formatMoney(amount)}</strong></li>)}</ul>
  </div><div className="finance-composition-debt"><span>Tartozások · külön levonva</span><strong>{formatMoney(selected.debt)}</strong></div><p className="footnote">A kördiagram a pozitív eszközöket mutatja. A nettó vagyon ebből a tartozások levonásával adódik.</p></section>;
}
