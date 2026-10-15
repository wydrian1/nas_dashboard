// Fixed read-only illustrator runner. Imports only public source; never saves,
// service configuration or private narrative memory. Catalog construction also
// validates presentation bindings, all visual poses and target coverage.
import { CATALOG } from '../lib/game/catalog.ts';

let handlers = 0;
for (const scene of Object.values(CATALOG.scenes)) {
  if (!scene.art || /[^\x20-\x7e\n]/.test(scene.art)) throw new Error('Invalid scene ASCII');
  handlers += scene.artSpots?.length ?? 0;
}
for (const id of Object.keys(CATALOG.items)) {
  if (!CATALOG.itemArt[id] || /[^\x20-\x7e\n]/.test(CATALOG.itemArt[id])) throw new Error('Missing or invalid inventory ASCII');
}
console.log(JSON.stringify({ passed: true, scenes: Object.keys(CATALOG.scenes).length, items: Object.keys(CATALOG.items).length, handlers, readOnly: true }));
