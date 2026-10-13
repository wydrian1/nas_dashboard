import { CATALOG, meets } from './catalog.ts';
import type { SavedGame } from './store.ts';
import type { StoryEntry } from './types.ts';
export type GameView = {
  revision: number; turns: number; message: string; journal: string[]; book: StoryEntry[];
  scene: { id: string; title: string; description: string; art: string };
  inventory: { id: string; label: string }[]; environment: { id: string; label: string }[];
  exits: { id: string; label: string }[]; topics: { id: string; label: string; target: string }[];
};
// No chapter rules, recipes, future entities or intended solutions cross the client boundary.
export function gameView(game: SavedGame): GameView {
  const { state } = game, scene = CATALOG.scenes[state.room];
  return {
    revision: game.revision, turns: state.turns, message: state.message, journal: [...state.journal], book: [...state.book],
    scene: { id: state.room, title: scene.title, description: scene.description, art: scene.art },
    inventory: state.inventory.map(id => ({ id, label: CATALOG.items[id] })),
    environment: (scene.environment ?? []).filter(entity => state.discoveries.includes(entity.id) && meets(state, entity.requires)).map(({ id, label }) => ({ id, label })),
    exits: (scene.exits ?? []).filter(exit => meets(state, exit.requires)).map(({ id, label }) => ({ id, label })),
    topics: (scene.topics ?? []).filter(topic => meets(state, topic.requires)).map(({ id, label, target }) => ({ id, label, target })),
  };
}
