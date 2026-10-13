'use server';
import { requirePlayer, signIn, signOut } from '@/auth';
import { db } from '@/lib/db';
import { advanceGame } from '@/lib/game/store';
import { gameView, type GameView } from '@/lib/game/view';
import type { PlayerCommand } from '@/lib/game/types';
export async function login() { await signIn('google', { redirectTo: '/' }); }
export async function logout() { await signOut({ redirectTo: '/' }); }
export async function play(revision: number, command: PlayerCommand): Promise<{ game?: GameView; conflict?: boolean; error?: string }> {
  const player = await requirePlayer().catch(() => null);
  if (!player) return { error: 'A munkamenet lejárt vagy a hozzáférés megszűnt. Jelentkezz be újra; a mentésed megmaradt.' };
  try {
    const result = advanceGame(db(), player.email, revision, command);
    return { game: gameView(result.game), conflict: result.conflict };
  } catch { return { error: 'A lépést nem sikerült menteni. Nem léptünk tovább; töltsd újra az oldalt, vagy próbáld újra.' }; }
}
