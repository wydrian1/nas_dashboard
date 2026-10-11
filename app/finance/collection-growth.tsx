import type { FinanceSnapshot } from '@/lib/finance/types';
import { formatMoney, formatMonth, formatPercent } from '@/lib/finance/types';
import type { LegoSnapshot } from '@/lib/finance/lego-types';
import { LEGO_ACCOUNT_ID } from '@/lib/finance/lego-types';
import { COLLECTR_ACCOUNT_ID, COLLECTR_PROFILE, BRICKECONOMY_PROFILE, type FinanceMarket } from '@/lib/finance/market-types';
import type { PokemonCollectionSnapshot } from '@/lib/finance/pokemon-collection-types';
import type { InflationSeries } from '@/lib/finance/inflation-types';
import { collectionGrowth, collectionMarketGrowth } from '@/lib/finance/collection-growth-types';
import type { CollectionGrowth, CollectionMarketGrowth } from '@/lib/finance/collection-growth-types';
import {valuationQuality} from '@/lib/finance/valuation-quality';
import type {CollectionCostItem} from '@/lib/finance/collection-growth-types';

const signed=(value:number)=>(value>0?'+':'')+formatMoney(value);
function GrowthValues({growth,asOf,label}:{growth:CollectionGrowth;asOf:string;label:string}) {
  const gain=(value:number|null,ratio:number|null)=><><strong className={value===null?'':value<0?'finance-negative':'finance-positive'}>{value===null?'Nem számolható':signed(value)}</strong><small>{formatPercent(ratio)}</small></>;
  return <><div className="collection-growth-values">
    <div><span>{label} · {asOf}</span><strong>{growth.valueMinor===null?'Nincs rögzített havi érték':formatMoney(growth.valueMinor)}</strong></div>
    <div><span>Bekerülési érték · {growth.quantity} db</span><strong>{formatMoney(growth.costMinor)}</strong></div>
    <div><span>Nominális gyarapodás</span>{gain(growth.nominalGainMinor,growth.nominalRatio)}</div>
    <div><span>Reálgyarapodás{growth.unknownDates>0 && ' · feltételezett dátummal'}</span>{gain(growth.realGainMinor,growth.realRatio)}</div>
  </div>
    {growth.adjustedCostMinor!==null && <p className="footnote">Inflációval korrigált bekerülés: {formatMoney(growth.adjustedCostMinor)}.</p>}
    {growth.inflationThrough && <p className="footnote">KSH-infláció figyelembe véve: {formatMonth(growth.inflationThrough)} hónapig.{growth.inflationThrough<asOf.slice(0,7) && ' Az újabb hónapokra még nincs elérhető index; nem ismételjük meg az utolsó havi rátát.'}</p>}
    {growth.realUnavailable && <p className="footnote">{growth.realUnavailable}</p>}
    {growth.unknownDates>0 && <p className="footnote">{growth.unknownDates} vásárlási sor dátuma ismeretlen: a számításban {growth.assumedAcquiredOn} a feltételezett vásárlási dátum, az adott összehasonlítás állapotdátuma előtt egy évvel. Ez csak számítási feltételezés, a nyilvántartott dátum nem változik.</p>}
    {growth.futureItems>0 && <p className="footnote">{growth.futureItems} későbbi vásárlási sor nem szerepel az állapotdátumig számolt bekerülésben.</p>}
  </>;
}
function GrowthCard({name,saved,asOf,current,provider,profile,items,now}:{name:string;saved:CollectionGrowth|null;asOf:string|null;current:CollectionMarketGrowth;provider:string;profile:string;items:CollectionCostItem[];now:number}) {
  const delta=current.growth?.valueMinor!==null && current.growth?.valueMinor!==undefined && saved?.valueMinor!==null && saved?.valueMinor!==undefined ? current.growth.valueMinor-saved.valueMinor : null;
  const quality=valuationQuality(items,current.fetchedAt,now);
  return <article className="finance-card collection-growth-card" aria-label={name+' gyarapodása'}><h3>{name}</h3>
    <div className="collection-growth-comparison" data-valuation="saved"><h4>Utolsó mentett érték alapján</h4>{saved && asOf ? <GrowthValues growth={saved} asOf={asOf} label="Mentett havi tény"/> : <p className="footnote">Nincs rögzített havi érték.</p>}</div>
    <div className="collection-growth-comparison" data-valuation="market"><h4>Aktuális piaci becslés alapján</h4><a className="collection-growth-source" href={profile} target="_blank" rel="noopener noreferrer">{provider} ↗</a>
      <p className="footnote" data-quality={quality.sourceState}><strong>{quality.sourceState==='recent'?'Friss lekérésből származó becslés':quality.sourceState==='stale'?'Elavult piaci becslés · több mint 24 órás':'Nincs ellenőrizhető lekérési időpont'}</strong> · nem realizált eladási ár, nem mentett havi tény.</p>
      {current.fetchedAt && <p className="footnote">Lekérve: {current.fetchedAt.slice(0,16).replace('T',' ')} UTC.</p>}
      {current.usdHuf!==null && <p className="footnote">Átváltás: {current.usdHuf} Ft/USD · {current.rateDate} · ECB / Frankfurter.</p>}
      {current.growth && current.asOf && <GrowthValues growth={current.growth} asOf={current.asOf} label="Lekért piaci becslés"/>}
      {current.unavailable && <p className="footnote" role="status">{current.unavailable}</p>}
      <div className="collection-growth-values collection-growth-delta"><div><span>Eltérés az utolsó mentett értéktől</span><strong className={delta===null?'':delta<0?'finance-negative':'finance-positive'}>{delta===null?'Nem számolható':signed(delta)}</strong></div></div>
    </div>
    <div className="collection-growth-comparison" data-valuation="quality"><h4>Nyilvántartási adatminőség</h4><p>{quality.unknownDateRows} sor / {quality.unknownDateUnits} db ismeretlen beszerzési dátummal · {formatMoney(quality.unknownDateCostMinor)} érintett bekerülés.</p><p>{quality.zeroCostRows} sorban 0 Ft a rögzített bekerülés; ez lehet valódi nulla, nem minősítjük automatikusan hiányzó árnak.</p><p className="footnote">A feltételezett dátum befolyásolja a reálgyarapodást, de nem módosítja a nyilvántartást vagy a mentett összegeket. A külső portfólió és a helyi tételek azonosságát nem állítjuk.</p></div>
  </article>;
}
export default function CollectionGrowthSection({snapshot,lego,pokemon,inflation,market}:{snapshot:FinanceSnapshot;lego:LegoSnapshot;pokemon:PokemonCollectionSnapshot;inflation?:InflationSeries|null;market?:FinanceMarket}) {
  const latest=snapshot.selected;
  const balances=new Map(snapshot.balances.map(balance=>[balance.account_id,balance.amount_minor]));
  const indices=inflation??market?.inflation??undefined;
  const pokemonGrowth=latest ? collectionGrowth(pokemon.items,balances.get(COLLECTR_ACCOUNT_ID)??null,latest.as_of,indices) : null,legoGrowth=latest ? collectionGrowth(lego.items,balances.get(LEGO_ACCOUNT_ID)??null,latest.as_of,indices) : null;
  const currentMarket=market ? {...market,inflation:indices??null} : undefined;
  const now=market?.checkedAt??0; // Server snapshot time: identical during SSR and hydration.
  return <section id="collection-growth" aria-labelledby="collection-growth-title"><div className="finance-section-head"><div><span className="eyebrow">BEKERÜLÉS ÉS ÉRTÉK</span><h2 id="collection-growth-title">Gyűjtemény gyarapodás</h2><p>{latest ? `Legutóbbi mentett havi tény: ${formatMonth(latest.month)} · ${latest.as_of}.` : 'Még nincs mentett havi tény.'} Mellette az aktuálisan lekért Collectr- és BrickEconomy-becslés. A korábbi hónap megtekintése ezt az összehasonlítást nem váltja át.</p></div><a href="/collections" className="secondary-button" target="_blank" rel="noopener noreferrer">Gyűjtemények kezelése ↗</a></div>
    <div className="finance-two-columns"><GrowthCard name="Pokémon" saved={pokemonGrowth} asOf={latest?.as_of??null} current={collectionMarketGrowth(pokemon.items,'pokemon',currentMarket)} provider="Collectr · Estimated Portfolio Value" profile={COLLECTR_PROFILE} items={pokemon.items} now={now}/><GrowthCard name="LEGO" saved={legoGrowth} asOf={latest?.as_of??null} current={collectionMarketGrowth(lego.items,'lego',currentMarket)} provider="BrickEconomy · Current value" profile={BRICKECONOMY_PROFILE} items={lego.items} now={now}/></div>
    <p className="footnote">Nominális: az adott mentett vagy lekért érték − bekerülés. Reál: az adott érték − inflációval korrigált bekerülés; a százalékot az adott bekerülési alaphoz mérjük. A piaci számítás dátuma a forrás lekérésének UTC-napja, nem a mentett hónap dátuma. KSH havi MoM-indexeket láncolunk a vásárlást követő hónaptól legfeljebb az adott állapot hónapjáig, a legutolsó elérhető indexnél megállva, napi arányosítás nélkül. Dátum nélkül az adott állapot előtt egy évvel történt vásárlást feltételezünk; február 29. évfordulója február 28. Nem becsülünk a közzétett idősoron belül hiányzó indexet. Az aktuális gyűjteménylistából számolunk, nem történelmi készletrekonstrukcióból; a külső portfóliók tartalma eltérhet. A piaci érték becslés, a mentett értéktől való eltérés nem önmagában befektetési hozam. Az oldal és a kézi lekérés közös piaci adatait használjuk a meglévő gyorsítótárral, automatikus havi mentés vagy második vagyonösszeg nélkül.</p>
  </section>;
}
