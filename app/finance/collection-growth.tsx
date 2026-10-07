import type { FinanceSnapshot } from '@/lib/finance/types';
import { formatMoney, formatMonth, formatPercent } from '@/lib/finance/types';
import type { LegoSnapshot } from '@/lib/finance/lego-types';
import { LEGO_ACCOUNT_ID } from '@/lib/finance/lego-types';
import { COLLECTR_ACCOUNT_ID } from '@/lib/finance/market-types';
import type { PokemonCollectionSnapshot } from '@/lib/finance/pokemon-collection-types';
import type { InflationSeries } from '@/lib/finance/inflation-types';
import { collectionGrowth } from '@/lib/finance/collection-growth-types';
import type { CollectionGrowth } from '@/lib/finance/collection-growth-types';

const signed=(value:number)=>(value>0?'+':'')+formatMoney(value);
function GrowthCard({name,growth,asOf}:{name:string;growth:CollectionGrowth;asOf:string}) {
  const gain=(value:number|null,ratio:number|null)=><><strong className={value===null?'':value<0?'finance-negative':'finance-positive'}>{value===null?'Nem számolható':signed(value)}</strong><small>{formatPercent(ratio)}</small></>;
  return <article className="finance-card collection-growth-card" aria-label={name+' gyarapodása'}><h3>{name}</h3><div className="collection-growth-values">
    <div><span>Mentett havi tény · {asOf}</span><strong>{growth.valueMinor===null?'Nincs rögzített havi érték':formatMoney(growth.valueMinor)}</strong></div>
    <div><span>Bekerülési érték · {growth.quantity} db</span><strong>{formatMoney(growth.costMinor)}</strong></div>
    <div><span>Nominális gyarapodás</span>{gain(growth.nominalGainMinor,growth.nominalRatio)}</div>
    <div><span>Reálgyarapodás{growth.unknownDates>0 && ' · feltételezett dátummal'}</span>{gain(growth.realGainMinor,growth.realRatio)}</div>
  </div>
    {growth.adjustedCostMinor!==null && <p className="footnote">Inflációval korrigált bekerülés: {formatMoney(growth.adjustedCostMinor)}.</p>}
    {growth.inflationThrough && <p className="footnote">KSH-infláció figyelembe véve: {formatMonth(growth.inflationThrough)} hónapig.{growth.inflationThrough<asOf.slice(0,7) && ' Az újabb hónapokra még nincs elérhető index; nem ismételjük meg az utolsó havi rátát.'}</p>}
    {growth.realUnavailable && <p className="footnote">{growth.realUnavailable}</p>}
    {growth.unknownDates>0 && <p className="footnote">{growth.unknownDates} vásárlási sor dátuma ismeretlen: a számításban {growth.assumedAcquiredOn} a feltételezett vásárlási dátum, a mentett állapot előtt egy évvel. Ez csak számítási feltételezés, a nyilvántartott dátum nem változik.</p>}
    {growth.futureItems>0 && <p className="footnote">{growth.futureItems} későbbi vásárlási sor nem szerepel az állapotdátumig számolt bekerülésben.</p>}
  </article>;
}
export default function CollectionGrowthSection({snapshot,lego,pokemon,inflation}:{snapshot:FinanceSnapshot;lego:LegoSnapshot;pokemon:PokemonCollectionSnapshot;inflation?:InflationSeries|null}) {
  const latest=snapshot.selected;
  if(!latest)return null;
  const balances=new Map(snapshot.balances.map(balance=>[balance.account_id,balance.amount_minor]));
  const pokemonGrowth=collectionGrowth(pokemon.items,balances.get(COLLECTR_ACCOUNT_ID)??null,latest.as_of,inflation??undefined),legoGrowth=collectionGrowth(lego.items,balances.get(LEGO_ACCOUNT_ID)??null,latest.as_of,inflation??undefined);
  return <section id="collection-growth" aria-labelledby="collection-growth-title"><div className="finance-section-head"><div><span className="eyebrow">BEKERÜLÉS ÉS ÉRTÉK</span><h2 id="collection-growth-title">Gyűjtemény gyarapodás</h2><p>Legutóbbi mentett havi tény: {formatMonth(latest.month)} · {latest.as_of}. A korábbi hónap megtekintése ezt az aktuális összehasonlítást nem váltja át.</p></div><a href="/collections" className="secondary-button" target="_blank" rel="noopener noreferrer">Gyűjtemények kezelése ↗</a></div>
    <div className="finance-two-columns"><GrowthCard name="Pokémon" growth={pokemonGrowth} asOf={latest.as_of}/><GrowthCard name="LEGO" growth={legoGrowth} asOf={latest.as_of}/></div>
    <p className="footnote">Nominális: mentett havi érték − bekerülés. Reál: mentett havi érték − inflációval korrigált bekerülés; a százalékot az adott bekerülési alaphoz mérjük. KSH havi MoM-indexeket láncolunk a vásárlást követő hónaptól legfeljebb az állapot hónapjáig, a legutolsó elérhető indexnél megállva, napi arányosítás nélkül. Dátum nélkül a mentett állapot előtt egy évvel történt vásárlást feltételezünk; február 29. évfordulója február 28. Nem becsülünk a közzétett idősoron belül hiányzó indexet. Az aktuális gyűjteménylistából számolunk, nem történelmi készletrekonstrukcióból. Nincs új piaci lekérés, automatikus havi mentés vagy második vagyonösszeg.</p>
  </section>;
}
