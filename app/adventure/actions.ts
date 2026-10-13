'use server';

import { requireUser } from '@/auth';
import { db } from '@/lib/db';
import { advanceGame, type SavedGame } from '@/lib/adventure/store';

export async function playAdventure(revision: number, action: string): Promise<{ game?: SavedGame; conflict?: boolean; error?: string }> {
  const session = await requireUser().catch(() => null);
  if (!session) return { error: 'A munkamenet lejárt. Jelentkezz be újra; a korábbi mentésed megmarad.' };
  try {
    return advanceGame(db(), session.user!.email!, revision, action);
  } catch {
    return { error: 'A lépést nem sikerült menteni. Nem léptünk tovább; próbáld újra, vagy töltsd újra az oldalt.' };
  }
}
