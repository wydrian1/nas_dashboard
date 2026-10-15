'use server';
import { requirePlayer, sessionCookie } from '@/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { basePath } from '@/lib/paths';
import { db } from '@/lib/db';
import { advanceGame, resetGame } from '@/lib/game/store';
import { gameView, type GameView } from '@/lib/game/view';
import type { PlayerCommand } from '@/lib/game/types';
export async function login() { redirect('/api/sso/start'); }
export async function logout() { (await cookies()).set(sessionCookie(), '', { path: basePath() || '/', maxAge: 0, httpOnly: true, secure: process.env.AUTH_URL?.startsWith('https:') || false, sameSite: 'lax' }); redirect('/?signedout=1'); }
export async function play(revision: number, command: PlayerCommand): Promise<{ game?: GameView; conflict?: boolean; error?: string }> {
  const player = await requirePlayer().catch(() => null);
  if (!player) return { error: 'A munkamenet lejárt vagy a hozzáférés megszűnt. Jelentkezz be újra; a mentésed megmaradt.' };
  try {
    const result = advanceGame(db(), player.email, revision, command);
    return { game: gameView(result.game), conflict: result.conflict };
  } catch { return { error: 'A lépést nem sikerült menteni. Nem léptünk tovább; töltsd újra az oldalt, vagy próbáld újra.' }; }
}
export async function restart(revision: number, confirmed: boolean): Promise<{ game?: GameView; conflict?: boolean; error?: string }> {
  const player = await requirePlayer().catch(() => null);
  if (!player) return { error: 'A munkamenet lejárt. Az újrakezdéshez jelentkezz be újra.' };
  if (confirmed !== true) return { error: 'Az újrakezdés megerősítést igényel.' };
  try { const result = resetGame(db(), player.email, revision); return { game: gameView(result.game), conflict: result.conflict }; }
  catch { return { error: 'Nem sikerült újrakezdeni. A korábbi mentésedet nem írtuk felül.' }; }
}
