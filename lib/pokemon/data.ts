import "server-only";
import { db } from "@/lib/db";
import { readPokemonSnapshot } from "./snapshot.ts";
import type { PokemonSnapshot } from "./types.ts";
import {requireAccess,type Role} from '../users';

export function pokemonSnapshot(email:string,role:Role):PokemonSnapshot {
  requireAccess(db(),email,'pokemon');
  return readPokemonSnapshot(db(),false,Date.now(),{email,role});
}
