import { requirePlayer } from '@/auth';
import { db } from '@/lib/db';
import { loadGame } from '@/lib/game/store';
import { gameView } from '@/lib/game/view';
import { login, logout } from './actions';
import Game from './game';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const player = await requirePlayer().catch(() => null);
  if (!player) return <main className="login"><span className="eyebrow">FOLYTATÁSOS SZÖVEGES KALAND</span><h1>NULLPONT</h1><p>Az emlékeid hiányoznak.<br/>A következményeik nem.</p><form action={login}><button>Belépés Google-fiókkal</button></form><small>Csak engedélyezett játékosoknak. A mentésed a saját fiókodhoz tartozik.</small></main>;
  const game = gameView(loadGame(db(), player.email));
  return <main className="shell"><header className="masthead"><div><span className="eyebrow">EGY TÖRTÉNET, AMELY MÉG NEM EMLÉKSZIK RÁD</span><h1>NULLPONT</h1></div><div className="account"><span>{player.name || 'Játékos'}</span><form action={logout}><button>Kilépés</button></form></div></header><Game initialGame={game}/><footer>Nincs végleges elakadás. A történet folytatódik.</footer></main>;
}
