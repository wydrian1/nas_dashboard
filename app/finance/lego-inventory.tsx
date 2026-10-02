import { ActionForm, ActionButton } from '../action-form';
import { saveLegoItem, deleteLegoItem } from './lego-actions';
import { formatMoney, moneyInput } from '@/lib/finance/types';
import type { LegoItem, LegoSnapshot } from '@/lib/finance/lego-types';

function Fields({item}:{item?:LegoItem}) {
  return <><input type="hidden" name="id" value={item?.id || ''}/><input type="hidden" name="revision" value={item?.revision || 0}/>
    <label>Készletszám<input name="set_number" defaultValue={item?.set_number} maxLength={14} pattern="[0-9]{3,10}(-[0-9]{1,3})?" required/></label>
    <label className="finance-lego-name">Megnevezés<input name="name" defaultValue={item?.name} maxLength={200} required/></label>
    <label>Darabszám<input name="quantity" type="number" min={1} max={9999} defaultValue={item?.quantity || 1} required/></label>
    <label>Egységár · Ft<input name="unit_price" inputMode="decimal" maxLength={24} defaultValue={moneyInput(item?.unit_price_minor)} required/></label>
    <label>Beszerzés dátuma<input name="acquired_on" type="date" defaultValue={item?.acquired_on || ''}/><small>Üres = ismeretlen</small></label></>;
}
export default function LegoInventory({snapshot}:{snapshot:LegoSnapshot}) {
  return <section className="finance-card finance-lego" id="lego-inventory" aria-labelledby="lego-title"><div className="finance-section-head"><div><span className="eyebrow">GYŰJTEMÉNY NYILVÁNTARTÁSA</span><h2 id="lego-title">LEGO-lista</h2></div><strong>{formatMoney(snapshot.totalMinor)}</strong></div>
    <p>{snapshot.items.length} tétel · {snapshot.quantity} készlet · összes beszerzési érték. Ez nem aktuális piaci becslés.</p>
    <p className="footnote">Az aktuális lista a választott hónaptól független. A módosítások nem írják át a korábban rögzített havi LEGO-értékeket, és nem adódnak hozzá másodszor a vagyonhoz. Minden új hónap LEGO-mezőjét a lista aktuális összegével töltjük elő; a havi mentést külön jóvá kell hagyni.</p>
    <div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Készlet / megnevezés</th><th>Db</th><th>Egységár</th><th>Összérték</th><th>Beszerzés</th><th>Kezelés</th></tr></thead><tbody>{snapshot.items.map(item=><tr key={item.id}><th><span className="finance-lego-number">{item.set_number}</span>{item.name}</th><td>{item.quantity}</td><td>{formatMoney(item.unit_price_minor)}</td><td>{formatMoney(item.quantity*item.unit_price_minor)}</td><td>{item.acquired_on || 'Ismeretlen'}</td><td><details className="finance-lego-edit"><summary>Szerkesztés</summary><ActionForm key={item.id+'-'+item.revision} action={saveLegoItem} className="finance-lego-form"><Fields item={item}/><ActionButton>LEGO mentése</ActionButton></ActionForm><ActionForm action={deleteLegoItem} className="finance-lego-delete"><input type="hidden" name="id" value={item.id}/><input type="hidden" name="revision" value={item.revision}/><label className="finance-check"><input type="checkbox" name="confirmed" required/>Törlöm ezt a tételt</label><ActionButton>Tétel törlése</ActionButton></ActionForm></details></td></tr>)}</tbody></table></div>
    {!snapshot.items.length && <p>Még nincs LEGO-tétel.</p>}
    <details className="finance-extra"><summary>Új LEGO-tétel hozzáadása</summary><ActionForm action={saveLegoItem} className="finance-lego-form"><Fields/><ActionButton>LEGO hozzáadása</ActionButton></ActionForm></details>
  </section>;
}
