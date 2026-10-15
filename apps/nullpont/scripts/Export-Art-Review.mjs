// Public, developer-only review evidence. No saves, private story or credentials.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePresentation } from '../lib/game/presentation/index.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const bytes = readFileSync(resolve(root, 'lib/game/presentation/art/scenes.json'));
const bindingBytes = readFileSync(resolve(root, 'lib/game/presentation/bindings.json'));
const art = JSON.parse(bytes), bindings = JSON.parse(bindingBytes);
validatePresentation(art, bindings);
const sha = value => createHash('sha256').update(value).digest('hex');
const lines = ['# Public ASCII review evidence', '', `Artwork SHA-256: ${sha(bytes)}`, `Bindings SHA-256: ${sha(bindingBytes)}`, '', 'Derived evidence only: review the hashed source and bindings too. No approval is asserted.', ''];
const block = text => lines.push('```text', text, '```', '');
for (const [id, scene] of Object.entries(art.scenes)) {
  lines.push('## ' + id, '', '### Static background', ''); block(scene.background);
  for (const handler of scene.handlers) {
    lines.push(`### ${handler.id} — row ${handler.row}, col ${handler.col}, ${handler.width}×${handler.height}`, '');
    if (handler.glyph !== undefined) { lines.push('Default:', ''); block(handler.glyph); }
    for (const [pose, glyph] of Object.entries(handler.poses ?? {})) { lines.push(pose + ':', ''); block(glyph); }
  }
}
for (const [id, item] of Object.entries(art.items)) { lines.push('## Item ' + id, ''); block(item.glyph); }
const output = resolve(root, '../../.runtime/nullpont-ascii-review.md');
mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, lines.join('\n'));
console.log(JSON.stringify({ output, artSha256: sha(bytes), bindingsSha256: sha(bindingBytes), scenes: Object.keys(art.scenes).length, items: Object.keys(art.items).length }));
