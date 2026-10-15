import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import art from '../lib/game/presentation/art/scenes.json' with { type: 'json' };

test('redesign preserves original first-room art, closeups, poses and inventory pictures exactly', () => {
  const originals = [
    [art.scenes.chamber, '5afa258ac6bd01978f433728d6153d20f4c3c4d89648c6eacd347068bbc1b5a8'],
    [art.scenes['awakening:bed-detail'], '5022d09403c44cf5e9e4862e584b563223d6271f9c48daace502c42a5e59291c'],
    [art.scenes['awakening:bed-rim'], 'efe3375b05c71dd6b041da4ec2b734122c6fc4456f1bcbcfd22caada64cf829a'],
    [art.scenes['awakening:panel-detail'], 'b6dedd5c62356831e098e98706c1a069f87f0e1fc576974a6b8d7d19764882ed'],
    [art.items.foil, 'ac46768a47ebb7611f30dd7ec08e0afa975001db020880a2c59549181d4f7d42'],
    [art.items.wire, 'ef074e47984b97cbd42c078e7da58be0ff42ba8dcdfa01611a6820fa4b6d12e1'],
    [art.items.bridge, '93de3efe45697c58ad1fe68385a561d871637ee7d3dffe83846dc6fc737a4391'],
  ] as const;
  for (const [asset, expected] of originals) assert.equal(createHash('sha256').update(JSON.stringify(asset)).digest('hex'), expected);
});
