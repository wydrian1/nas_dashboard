"use client";
import { useState } from 'react';
import { ActionForm, ActionButton } from '../action-form';
import { addAccount, saveMonth } from '../finance-actions';
import { formatMonth, formatMoney, moneyInput, nextMonth, parseMoney, visibleFinanceNote } from '@/lib/finance/types';
import type { FinanceAccount, FinanceBalance, FinancePoint } from '@/lib/finance/types';
import { COLLECTR_ACCOUNT_ID, COLLECTR_PROFILE, usdAccount, usdToHuf } from '@/lib/finance/market-types';
import type { FinanceMarket } from '@/lib/finance/market-types';
import { LEGO_ACCOUNT_ID } from '@/lib/finance/lego-types';
import { newMonthAmount } from '@/lib/finance/editor-types';

export default function FinanceEditor({accounts,selected,balances,latest,latestBalances,market:initialMarket,legoTotal}:{accounts:FinanceAccount[];selected:FinancePoint;balances:FinanceBalance[];latest:FinancePoint;latestBalances:FinanceBalance[];market?:FinanceMarket;legoTotal?:number}) {
  const [mode,setMode]=useState<'new'|'edit'>('new');
  const [market,setMarket]=useState(initialMarket),[refreshing,setRefreshing]=useState(false),[refreshVersion,setRefreshVersion]=useState(0),[refreshError,setRefreshError]=useState('');
  const base=mode==='new' ? latest : selected,seed=mode==='new' ? latestBalances : balances;
  const month=mode==='new' ? nextMonth(latest.month) : selected.month;
  const today=new Date().toISOString().slice(0,10),asOf=mode==='edit' ? selected.as_of : today.startsWith(month) ? today : month+'-01';
  const amounts=new Map(seed.map(balance=>[balance.account_id,balance]));
  async function refreshMarket(){setRefreshing(true);setRefreshError('');try{const response=await fetch('/api/finance/market',{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error();setMarket(await response.json());setRefreshVersion(value=>value+1);}catch{setRefreshError('A frissítés nem sikerült. A beírt értékeket megőriztem.');}finally{setRefreshing(false);}}
  const fields=(account:FinanceAccount)=><FinanceAmount key={`${mode}-${base.month}-${base.revision}-${account.id}`} account={account} stored={amounts.get(account.id)} newMonth={mode==='new'} market={market} refreshVersion={refreshVersion} legoTotal={legoTotal}/>;
  return <section className="finance-card" id="monthly-entry"><div className="finance-section-head"><div><span className="eyebrow">KÉZI ADATBEVITEL</span><h2>Havi állapot rögzítése</h2></div></div>
    <div className="finance-ranges"><button type="button" aria-pressed={mode==='new'} onClick={()=>setMode('new')}>Új hónap</button><button type="button" aria-pressed={mode==='edit'} onClick={()=>setMode('edit')}>{formatMonth(selected.month)} módosítása</button></div>
    <p>{mode==='new' ? `Az új hónaphoz a Lili/Bali DEBT ${formatMonth(base.month)} értékeiből indul. A Pokémon értékét a Collectr tölti ki, a LEGO a lenti lista összegéből indul. Minden más összegmező üres; az eToro (stock) és a Ledger értékét USD-ben add meg.` : `A módosítás ${formatMonth(base.month)} mentett Ft-értékeiből indul, automatikus átváltás vagy listaérték-csere nélkül.`} Ezek nem friss banki adatok: ellenőrizd és írd át a teljes havi állapotot. Üres Ft-mező = nincs rögzített összeg. A kamatot kézzel írd hozzá a negatív DEBT-összeghez; a pipa csak az eseményt jelöli.</p>
    <div className="finance-market-status"><a href={COLLECTR_PROFILE} target="_blank" rel="noopener noreferrer">Collectr · Estimated Portfolio Value ↗</a>{market?.collectr && <span>USD-érték lekérve: {market.collectr.fetchedAt.slice(0,16).replace('T',' ')} UTC</span>}{market?.rates && <span>Átváltás: {market.rates.usdHuf} Ft/USD · {market.rates.date}</span>}<button type="button" className="secondary-button" onClick={refreshMarket} disabled={refreshing}>{refreshing ? 'Lekérés…' : 'Collectr / árfolyam lekérése'}</button><small>A frissítés a szerkesztés alatt csak az érintetlen Pokémon-mezőt tölti ki; a már beírt összegeket nem írja felül.</small></div>
    {(refreshError || market?.rateError || market?.collectrError) && <p className="error" role="alert">{[refreshError,market?.rateError,market?.collectrError].filter(Boolean).join(' ')}</p>}
    <ActionForm key={`${mode}-${selected.month}-${selected.revision}-${latest.month}-${latest.revision}-${accounts.length}`} action={saveMonth} className="finance-entry-form">
      <input type="hidden" name="revision" value={mode==='edit' ? selected.revision : 0}/>
      <input type="hidden" name="fx_date" value={market?.rates?.date || ''}/>
      <div className="finance-form-meta"><label>Hónap<input type="month" name="month" defaultValue={month} readOnly={mode==='edit'} required/></label><label>Állapot dátuma<input type="date" name="as_of" defaultValue={asOf} required/></label></div>
      {accounts.filter(account=>amounts.has(account.id)).map(fields)}
      <details className="finance-extra"><summary>További / üres tételek ({accounts.filter(account=>!amounts.has(account.id)).length})</summary>{accounts.filter(account=>!amounts.has(account.id)).map(fields)}</details>
      <label className="finance-note">Megjegyzés<textarea name="note" maxLength={3000} rows={3} defaultValue={mode==='edit' ? visibleFinanceNote(selected.note) : ''} placeholder="Például befizetés, kivét, kamatjóváírás vagy lezárt számla…"/></label>
      <label className="finance-check"><input type="checkbox" name="confirmed" required/>Ellenőriztem az összegeket és a dátumot; a teljes havi állapotot mentem.</label>
      <ActionButton>{mode==='edit' ? 'Havi állapot módosítása' : 'Új havi állapot mentése'}</ActionButton>
    </ActionForm>
    <details className="finance-extra"><summary>Új számla vagy vagyontétel hozzáadása</summary><p>A korábbi hónapokat nem módosítja. Az új tétel összegét a havi űrlap üres/további tételeinél lehet rögzíteni.</p><ActionForm action={addAccount} className="finance-account-form"><label>Név<input name="name" maxLength={120} required/></label><label>Kategória<input name="category" list="finance-categories" maxLength={80} required/><datalist id="finance-categories">{[...new Set(accounts.map(account=>account.category))].map(category=><option key={category} value={category}/>)}</datalist></label><label>Típus<select name="kind" defaultValue="asset"><option value="asset">Vagyon / eszköz</option><option value="debt">Tartozás</option></select></label><label>Éves DEBT-fordulóhónap<input type="number" name="turnover_month" min={1} max={12} placeholder="Opcionális: 1–12"/></label><ActionButton>Új tétel létrehozása</ActionButton></ActionForm></details>
  </section>;
}

function FinanceAmount({account,stored,newMonth,market,refreshVersion,legoTotal}:{account:FinanceAccount;stored?:FinanceBalance;newMonth:boolean;market?:FinanceMarket;refreshVersion:number;legoTotal?:number}) {
  const isUsd=usdAccount(account.id),isCollectr=account.id===COLLECTR_ACCOUNT_ID;
  const [currency,setCurrency]=useState<'HUF'|'USD'>(newMonth && isUsd ? 'USD' : 'HUF');
  const initial=newMonth ? newMonthAmount(account,stored,market,legoTotal) : stored?.amount_minor;
  const [value,setValue]=useState(moneyInput(initial)),[dirty,setDirty]=useState(false),[lastRefresh,setLastRefresh]=useState(refreshVersion);
  const [lastLegoTotal,setLastLegoTotal]=useState(legoTotal);
  if(legoTotal!==lastLegoTotal){setLastLegoTotal(legoTotal);if(newMonth && account.id===LEGO_ACCOUNT_ID && !dirty && legoTotal!==undefined)setValue(moneyInput(legoTotal));}
  if(refreshVersion!==lastRefresh){setLastRefresh(refreshVersion);if(newMonth && isCollectr && !dirty && currency==='USD')setValue(moneyInput(market?.collectr?.usdMinor));}
  let converted:number|null=null;try{const amount=parseMoney(value);if(currency==='USD' && amount!==null && market?.rates)converted=usdToHuf(amount,market.rates.usdHuf);}catch{}
  return <div className="finance-input-row"><label htmlFor={'amount-'+account.id}>{account.name}<small>{account.category}{account.kind==='debt' ? ' · negatív Ft' : isUsd ? ' · USD vagy Ft' : ' · Ft'}</small>{newMonth && isUsd && stored && <small>Előző havi Ft-érték: {formatMoney(stored.amount_minor)} · nem másoljuk a mezőbe</small>}</label><div className="finance-amount-entry"><input id={'amount-'+account.id} name={'amount:'+account.id} value={value} onChange={event=>{setDirty(true);setValue(event.target.value);}} inputMode="decimal" maxLength={24} placeholder={currency==='USD' ? 'USD összeg szükséges' : 'nincs rögzítve'} required={newMonth && currency==='USD'} aria-label={account.name+' összege '+(currency==='USD' ? 'USD-ben' : 'Ft-ban')}/>{isUsd ? <select name={'currency:'+account.id} value={currency} aria-label={account.name+' beviteli devizája'} onChange={event=>{setCurrency(event.target.value as 'HUF'|'USD');setValue('');setDirty(true);}}><option value="USD">USD</option><option value="HUF">Ft</option></select> : <input type="hidden" name={'currency:'+account.id} value="HUF"/>}{converted!==null && <small className="finance-converted">≈ {formatMoney(converted)} · mentés Ft-ban</small>}</div>{account.turnover_month && <label className="finance-check"><input type="checkbox" name={'turnover:'+account.id} defaultChecked={!newMonth && stored?.turnover===1}/>Kamat jóváírva <small>Fordulóhónap: {account.turnover_month}.</small></label>}</div>;
}
