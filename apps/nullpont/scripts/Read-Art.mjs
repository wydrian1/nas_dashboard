// Bounded read-only transport for JSON string lines the read tool truncates.
// No paths, writes, executable input, bindings or private inputs accepted.
import art from '../lib/game/presentation/art/scenes.json' with { type: 'json' };

const allowed = new Set(['threshold', 'awakening:corridor-doors', 'awakening:cloakroom', 'awakening:water-room', 'awakening:light-room', 'awakening:source-room', 'awakening:decision-room', 'relay:gallery', 'items']);
const args = process.argv.slice(2);
if (args.length !== 1 || !allowed.has(args[0])) throw new Error('Expected one approved public artwork ID');
if (args[0] === 'items') {
  console.log(JSON.stringify(Object.fromEntries(Object.entries(art.items).filter(([id]) => id.startsWith('awakening:'))), null, 2));
} else {
  const scene = art.scenes[args[0]], width = Math.max(...scene.background.split('\n').map(line => line.length));
  const rows = scene.background.split('\n').map(line => line.padEnd(width));
  for (const handler of scene.handlers) {
    if (handler.glyph === undefined) continue;
    const glyph = handler.glyph.split('\n');
    for (let row = 0; row < handler.height && handler.row + row < rows.length; row++) {
      const y = handler.row + row;
      rows[y] = rows[y].slice(0, handler.col) + (glyph[row] ?? '').padEnd(handler.width) + rows[y].slice(handler.col + handler.width);
    }
  }
  console.log('DEFAULT COMPOSITION\n' + rows.join('\n'));
  console.log('EXACT JSON FOR PATCH\n' + JSON.stringify(scene, null, 2));
}
