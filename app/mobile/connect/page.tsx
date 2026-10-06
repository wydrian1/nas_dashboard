import { requireUser } from '@/auth';
import { db } from '@/lib/db';
import { pairInfo } from '@/lib/mobile/store';
import { mobileLogin, mobileApprove } from '../actions';
import {homeForRole} from '@/lib/users';

export const dynamic='force-dynamic';
export const metadata={title:'Telefon párosítása · Wydrian',referrer:'no-referrer'};
export default async function Connect({searchParams}:{searchParams:Promise<{id?:string}>}) {
  const {id}=await searchParams;
  const pair=(()=>{try{return pairInfo(db(),id);}catch{return null;}})();
  const session=await requireUser().catch(()=>null);
  return <main className="login-shell"><div className="login-card"><span className="eyebrow">ANDROID APP</span><h1>Telefon párosítása</h1>
    {!pair ? <><p>A párosítás lejárt vagy már elkészült. Térj vissza az appba.</p><a href={session?.role==='admin' ? '/config#mobile' : homeForRole(session?.role || null)}>Vissza</a></> : <>
      <p>Eszköz: <strong>{pair.label}</strong></p><p>Ellenőrző kód: <strong style={{fontSize:'1.6rem',letterSpacing:'.15em'}}>{pair.code}</strong></p>
      <p>Csak akkor hagyd jóvá, ha te indítottad a párosítást, és az appban ugyanez a kód látható.</p>
      {!session ? <form action={mobileLogin}><input type="hidden" name="id" value={pair.id}/><button className="google-button">Belépés Google-fiókkal</button></form> : pair.approved_email ? <p><strong>Jóváhagyva.</strong> Térj vissza a telefonos appba; a kapcsolódás automatikusan befejeződik.</p> : <form action={mobileApprove}>
        <input type="hidden" name="id" value={pair.id}/><label><input type="checkbox" name="confirm" value="yes" required/> Én indítottam, és a kód megegyezik.</label><p>Az app 90 napig hozzáférhet a saját szerepköröd által engedélyezett oldalakhoz. A telefon az app menüjéből bármikor leválasztható.</p><button className="primary-button">Telefon jóváhagyása</button>
      </form>}
    </>}
  </div></main>;
}
