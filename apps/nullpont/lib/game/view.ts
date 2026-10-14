import { CATALOG, meets, type AdventureCatalog } from './catalog.ts';
import type { SavedGame } from './store.ts';
import type { StoryEntry, ArtSpot } from './types.ts';
import { activeSceneId, observeRoom } from './engine.ts';
export type VisibleSpot = Pick<ArtSpot,'id'|'row'|'col'|'width'|'height'|'glyph'> & { label: string; environment?: string; exit?: {id:string;label:string}; actions: ('look'|'take'|'talk'|'attack')[] };
export type GameView = {
  revision: number; turns: number; message: string; journal: string[]; book: StoryEntry[];
  breadcrumbs: { id: string; title: string }[];
  inputs: { id: string; label: string; prompt: string; maxLength: number; format: 'digits' | 'text' }[];
  scene: { id: string; title: string; description: string; art: string; columns: number; rows: number; spots: VisibleSpot[] };
  inventory: { id: string; label: string; art: string }[]; environment: { id: string; label: string }[];
  exits: { id: string; label: string }[]; topics: { id: string; label: string; target: string }[];
};
// No chapter rules, recipes, future entities or intended solutions cross the client boundary.
export function gameView(game: SavedGame, catalog: AdventureCatalog = CATALOG): GameView {
  const state = observeRoom(game.state, catalog), scene = catalog.scenes[activeSceneId(state)];
  const environment = (scene.environment ?? []).filter(entity => state.discoveries.includes(entity.id) && meets(state, entity.requires)).map(({ id, label }) => ({ id, label }));
  const exits = (scene.exits ?? []).filter(exit => meets(state, exit.requires)).map(({ id, label }) => ({ id, label }));
  const spots: VisibleSpot[] = [];
  for (const spot of scene.artSpots ?? []) {
    const entity = environment.find(entry => entry.id === spot.environment), exit = exits.find(entry => entry.id === spot.exit);
    if (!entity && !exit) continue;
    spots.push({id:spot.id,row:spot.row,col:spot.col,width:spot.width,height:spot.height,...(spot.glyph?{glyph:spot.glyph}:{}),label:entity?.label??exit!.label, ...(entity?{environment:entity.id}:{}),...(exit?{exit}:{}),actions:entity?[...spot.actions??['look','take','talk','attack']]:[]});
  }
  // Older append-only modules still work: unmapped known objects appear as ASCII
  // tiles within the drawing, never as a separate environment/movement menu.
  const extras = [...environment.filter(entity => !spots.some(spot => spot.environment === entity.id)).map(entity => ({entity,exit:undefined})),...exits.filter(exit => !spots.some(spot => spot.exit?.id === exit.id)).map(exit => ({entity:undefined,exit}))];
  const lines = scene.art.split('\n');
  if (extras.length) {
    const start = lines.length;
    for (let i=0;i<Math.ceil(extras.length/4)*4;i++) lines.push(' '.repeat(76));
    extras.forEach(({entity,exit},index)=>spots.push({id:'compat:'+ (entity?.id??exit!.id),row:start+Math.floor(index/4)*4,col:index%4*19,width:16,height:3,glyph:exit?'  [  >>  ]':'  [  ?  ]',label:entity?.label??exit!.label,...(entity?{environment:entity.id}:{}),...(exit?{exit}:{}),actions:entity?['look','take','talk','attack']:[]}));
  }
  return {
    revision: game.revision, turns: state.turns, message: state.message, journal: [...state.journal], book: [...state.book],
    breadcrumbs: [state.room, ...state.focus ?? []].map(id => ({ id, title: catalog.scenes[id].title })),
    inputs: (scene.inputs ?? []).filter(input => environment.some(entity => entity.id === input.id) && meets(state, input.requires)).map(({id,label,prompt,maxLength,format}) => ({id,label,prompt,maxLength:maxLength ?? 80,format:format ?? 'text'})),
    scene: { id: activeSceneId(state), title: scene.title, description: scene.description, art: lines.join('\n'), columns:Math.max(...lines.map(line=>line.length)),rows:lines.length,spots },
    inventory: state.inventory.map(id => ({ id, label: catalog.items[id], art:catalog.itemArt[id]??' [ ? ]' })),
    environment, exits,
    topics: (scene.topics ?? []).filter(topic => meets(state, topic.requires)).map(({ id, label, target }) => ({ id, label, target })),
  };
}
