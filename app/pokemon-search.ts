export function filterPokemonTitles<T extends {title:string}>(items:T[],query:string):T[] {
  const term=query.trim().toLowerCase();
  return items.filter(item=>item.title.toLowerCase().includes(term));
}
