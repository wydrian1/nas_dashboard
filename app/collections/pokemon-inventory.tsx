import { ActionForm, ActionButton } from '../action-form';
import { savePokemonItem, deletePokemonItem } from './pokemon-actions';
import { formatMoney } from '@/lib/finance/types';
import type { PokemonCollectionItem, PokemonCollectionSnapshot } from '@/lib/finance/pokemon-collection-types';
import IntegerAmountInput from '../finance/integer-amount-input';

function Fields({item}:{item?:PokemonCollectionItem}) {
  return <><input type="hidden" name="id" value={item?.id || ''}/><input type="hidden" name="revision" value={item?.revision || 0}/>
    <label className="finance-lego-name">Megnevezés<input name="name" defaultValue={item?.name} maxLength={200} required/></label>
    <label>Darabszám<input name="quantity" type="number" min={1} max={9999} step={1} defaultValue={item?.quantity || 1} required/></label>
    <label>Egységár · Ft<IntegerAmountInput name="unit_price" minor={item?.unit_price_minor} required/></label>
    <label>Vásárlás dátuma<input name="acquired_on" type="date" defaultValue={item?.acquired_on || ''}/><small>Üres = ismeretlen; reálgyarapodáshoz szükséges</small></label></>;
}
export default function PokemonInventory({snapshot}:{snapshot:PokemonCollectionSnapshot}) {
  return <section className="finance-card finance-lego" id="pokemon-inventory" aria-labelledby="pokemon-inventory-title"><div className="finance-section-head"><div><span className="eyebrow">GYŰJTEMÉNY NYILVÁNTARTÁSA</span><h2 id="pokemon-inventory-title">Pokémon-gyűjtemény</h2></div><strong>{formatMoney(snapshot.totalMinor)}</strong></div>
    <p>{snapshot.items.length} vásárlási sor · {snapshot.quantity} darab · összes bekerülési érték. Ez nem a Collectr piaci becslése.</p>
    <p className="footnote">Azonos termék különböző vásárlásai külön sorban maradnak. A módosítások nem mentenek havi pénzügyi állapotot, és nem adódnak hozzá másodszor a vagyonhoz. A havi Pokémon-érték továbbra is a pénzügyi űrlapon, külön megerősítéssel rögzíthető.</p>
    <div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Megnevezés</th><th>Db</th><th>Egységár</th><th>Bekerülési összeg</th><th>Vásárlás</th><th>Kezelés</th></tr></thead><tbody>{snapshot.items.map(item=><tr key={item.id}><th>{item.name}</th><td>{item.quantity}</td><td>{formatMoney(item.unit_price_minor)}</td><td>{formatMoney(item.quantity*item.unit_price_minor)}</td><td>{item.acquired_on || 'Ismeretlen'}</td><td><details className="finance-lego-edit"><summary>Szerkesztés</summary><ActionForm key={item.id+'-'+item.revision} action={savePokemonItem} className="finance-lego-form"><Fields item={item}/><ActionButton>Pokémon mentése</ActionButton></ActionForm><ActionForm action={deletePokemonItem} className="finance-lego-delete"><input type="hidden" name="id" value={item.id}/><input type="hidden" name="revision" value={item.revision}/><label className="finance-check"><input type="checkbox" name="confirmed" required/>Törlöm ezt a vásárlási sort</label><ActionButton>Tétel törlése</ActionButton></ActionForm></details></td></tr>)}</tbody></table></div>
    {!snapshot.items.length && <p>Még nincs Pokémon-vásárlás.</p>}
    <details className="finance-extra"><summary>Új Pokémon-vásárlás hozzáadása</summary><ActionForm action={savePokemonItem} className="finance-lego-form"><Fields/><ActionButton>Pokémon hozzáadása</ActionButton></ActionForm></details>
  </section>;
}
