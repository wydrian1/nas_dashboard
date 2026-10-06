import type {LatestInfoFinance} from '@/lib/important-info/store';
import {formatMoney,formatMonth} from '@/lib/finance/types';
export default function ImportantInfoFinance({finance}:{finance:LatestInfoFinance}){
  if(!finance)return <section className="info-card"><h2>Legutóbbi havi pénzügyi állapot</h2><p>Még nincs mentett pénzügyi hónap.</p></section>;
  return <section className="info-finance" aria-label="Legutóbbi mentett havi pénzügy">
    <div className="section-heading"><div><span className="eyebrow">LEGUTÓBBI MENTETT HÓNAP</span><h2>{formatMonth(finance.month)}</h2><p>Állapotfelvétel: <time dateTime={finance.asOf}>{finance.asOf}</time>. Csak mentett adatok; nincs élő egyenleglekérés vagy automatikus átírás.</p></div></div>
    <div className="info-totals"><article className="info-card"><span>Teljes összeg · nettó vagyon</span><strong>{formatMoney(finance.netMinor)}</strong></article><article className="info-card"><span>Eszközök összesen</span><strong>{formatMoney(finance.assetsMinor)}</strong></article><article className="info-card"><span>Tartozások összesen</span><strong>{formatMoney(finance.debtMinor)}</strong></article></div>
    <div className="info-groups">{finance.groups.map(group=><section className="info-card" key={group.category}><div className="info-group-heading"><h3>{group.category}</h3><strong>{group.items.some(item=>item.amountMinor!==null)?formatMoney(group.totalMinor):'Nincs rögzített érték'}</strong></div><table className="info-table"><thead><tr><th scope="col">Tétel</th><th scope="col">Érték</th></tr></thead><tbody>{group.items.map(item=><tr key={item.id}><th scope="row">{item.name}{item.kind==='debt'&&<small>Tartozás</small>}</th><td>{item.amountMinor===null?'Nincs rögzített érték':formatMoney(item.amountMinor)}</td></tr>)}</tbody></table></section>)}</div>
    <p className="footnote">Minden összeg Ft-ban. A negatív tartozásokat a nettó összeg levonja; a hiányzó értékeket nem tekintjük nullás egyenlegnek. A pénzügyi modul következő mentett hónapja ezen az oldalon is megjelenik a következő megnyitáskor/frissítéskor.</p>
  </section>;
}
