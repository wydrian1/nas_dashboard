import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('dedicated illustrator can edit pure art only and has no gameplay, private-story or deployment access', () => {
  const profile = readFileSync(new URL('../.opencode/agents/nullpont-ascii-artist.md', import.meta.url), 'utf8');
  assert.match(profile, /mode: subagent/);
  assert.match(profile, /action: "\*"\s+resource: "\*"\s+effect: deny/);
  const edits = [...profile.matchAll(/action: edit\s+resource: "([^"]+)"\s+effect: allow/g)].map(match => match[1]);
  assert.deepEqual(edits, ['*apps/nullpont/lib/game/presentation/art/*.json']);
  // V2 uses whole-value wildcards, not globstar path-segment semantics.
  const matches = (pattern: string, path: string) => new RegExp('^' + pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i').test(path.replaceAll('\\', '/'));
  for (const path of ['apps/nullpont/lib/game/presentation/art/scenes.json', 'D:/!nas/.runtime/worktrees/dashboard-cleanup-layout/apps/nullpont/lib/game/presentation/art/scenes.json']) assert.ok(matches(edits[0], path));
  assert.equal(matches(edits[0], 'apps/nullpont/lib/game/presentation/bindings.json'), false);
  const reads = [...profile.matchAll(/action: read\s+resource: "([^"]+)"\s+effect: allow/g)].map(match => match[1]);
  assert.ok(reads.length > 0 && reads.every(path => !/chapters|bindings|storyboard|canon-ledger|sqlite|env\.local/.test(path)));
  const shell = [...profile.matchAll(/action: shell\s+resource: "([^"]+)"\s+effect: allow/g)].map(match => match[1]);
  const reader = 'D:/!nas/.runtime/node-v24.21.0-win-x64/node.exe apps/nullpont/scripts/Read-Art.mjs ';
  assert.deepEqual(shell, ['D:/!nas/.runtime/node-v24.21.0-win-x64/node.exe apps/nullpont/scripts/Check-Art.mjs', ...['threshold', 'awakening:corridor-doors', 'awakening:cloakroom', 'awakening:water-room', 'awakening:light-room', 'awakening:source-room', 'awakening:decision-room', 'relay:gallery', 'items'].map(id => reader + id)]);
  assert.ok(shell.every(command => !command.includes('*')));
  for (const suffix of ['; Write-Output NULLPONT_SYNTHETIC', ' > .runtime/nullpont-synthetic-probe.txt', ' $(Write-Output NULLPONT_SYNTHETIC)', ' | Write-Output NULLPONT_SYNTHETIC', ' && echo NULLPONT_SYNTHETIC']) {
    assert.ok(!shell.some(pattern => matches(pattern, reader + 'items' + suffix)));
  }
  assert.match(profile, /not a grid of labelled object cards/);
  assert.match(profile, /Keep hidden, removable and state-changing imagery OUT of the static background/);
  const workflow = readFileSync(new URL('../apps/nullpont/AGENTS.md', import.meta.url), 'utf8');
  assert.match(workflow, /designer → illustrator → coder/);
  assert.match(workflow, /Delegate illustration to \*\*nullpont-ascii-artist\*\*/);
  assert.match(workflow, /changing a drawing can change a clue/);
});

test('bounded illustrator reader rejects paths, unknown IDs and compound arguments without executing input', () => {
  const runner = fileURLToPath(new URL('../apps/nullpont/scripts/Read-Art.mjs', import.meta.url));
  for (const args of [[], ['../bindings.json'], ['chamber'], ['relay:gallery', 'extra'], ['items;whoami']]) {
    const result = spawnSync(process.execPath, [runner, ...args], { encoding: 'utf8', windowsHide: true });
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Expected one approved public artwork ID/);
  }
  const result = spawnSync(process.execPath, [runner, 'items'], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0);
  const items = JSON.parse(result.stdout);
  assert.ok(Object.keys(items).length > 0 && Object.keys(items).every(id => id.startsWith('awakening:')));
  assert.ok(Object.values(items).every(item => item && typeof item === 'object' && Object.keys(item).join(',') === 'glyph'));
});
