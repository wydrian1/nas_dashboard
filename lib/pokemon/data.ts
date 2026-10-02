import "server-only";
import { db } from "@/lib/db";
import { readPokemonSnapshot } from "./snapshot.ts";
import type { PokemonSnapshot } from "./types.ts";
import type { Role } from '../users';

export function pokemonSnapshot(email:string,role:Role):PokemonSnapshot {
  return readPokemonSnapshot(db(),false,Date.now(),{email,role});
}
