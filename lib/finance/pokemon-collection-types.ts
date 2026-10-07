import type { LegoItem } from './lego-types.ts';

export type PokemonCollectionItem=Omit<LegoItem,'set_number'>;
export type PokemonCollectionSnapshot={items:PokemonCollectionItem[];quantity:number;totalMinor:number};
