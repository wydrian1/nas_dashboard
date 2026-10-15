import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import art from '../lib/game/presentation/art/scenes.json' with { type: 'json' };

// Baseline: the installed 19161ed release, before presentation extraction.
// This guards scope coverage, not artistic quality (which needs visual review).
test('every pre-existing non-opening-room background and inventory image was redrawn', () => {
  const scenes: Record<string, string> = {
    threshold: 'a8ef5c6b7f4fd49e02b13aafc5a3f49a906ed6eacafcaa9f3707e878f73c5ee4',
    'awakening:cloakroom': '53b458d1f94578a562bad182ce5dea4c25d0064c7913d6f6ecfc666e9a04ec33',
    'awakening:water-room': '34cf20811896d721b3be68b04fde7d58b6e3c3211a4200de68e8d792c502e152',
    'awakening:light-room': 'e7450b19e0b018c76aff558796a9aa9804d0d1d18ff97fee7e531fc59f3de1d0',
    'awakening:source-room': '6db20ccca802228b268bb3e4c0a312013bcfaf27802d15a2d781fc0e60fc5648',
    'awakening:decision-room': '84d9b7334bfb8bebdefd7c2135230bda8d1eb9dbff99562a4613d3caac800489',
    'archive:vestibule': 'bb9f05ad8cd1bcf8450436500bcfa4ca75704bb1b99b1fc719b32e5ec11419c8',
    'archive:directory': 'a8c2970025502799e829da0222e13ad7b1d80f6372cb18d30d0777bcab8159ff',
    'archive:paper-fold': '4584812f16229f5281ce7c385f53e9bc5ed155477326dc812dad12887cb2d909',
    'archive:bridge-room': 'd0d792c2aff0fcae89bc0d8c6877005660fc3982b8bfaa51790f29b212c728bd',
    'archive:signal-room': 'fcbafbc0311c426b94bd35462814e6f907fdf43a46436ce2c0124a29d7bc061f',
    'archive:record-room': '79194064d92eb19637bd322b89722c81b8bfef7683cbbb4c06ad2bcc2a79e71e',
    'relay:gallery': '5b6b4e7f1204fd408e069beb9427893cfe320006461c6f6aa611d76e8097f123',
    'relay:clock-detail': 'ea13552bf0f41bd43fbaac1988838b74b30e27d81fac75524bf63da61b1498b8',
    'relay:interval-room': '8f241b21a10ab23eaf02f606437c1434b39d7e807aba5d0d6e0e258d688f67d8',
    'relay:well-room': '0f70591e9b3ec172dd1a32c59ab6fd224ae421870d7f84726f49252a027a2dad',
    'relay:dispatch-room': '14536b21e062cb9b824129b2d4587342c85fe0cd81915d94a21781bbaec1fbeb',
    'relay:receiver-room': 'd46e6e50e40c94f4dc71088cb7c20018977f412fe5a0a21f5f9d51b95be2226d',
  };
  const items: Record<string, string> = {
    'awakening:frame': '247e3bbcf2a680ae0222c1a982323aa2faeefb228dd43ed5e78334155bba7de0',
    'awakening:prism': '2ecd17cb146a4e1e684dfd6b50d9315771f3bdce86bc4fb68f988960b0600a79',
    'awakening:viewer': '5219672700e9230d435ee0ce1515345d11cdac568e9d188b519111a89f306a0b',
    'awakening:source-card': '6cf98313e1aff5cc08ef2b184a759076b148b5073cc3ec5d36eadc8aadc3da9b',
    'archive:witness': '2406f29e7e15911a48f0b27eebd9672573b36fb15ab8d92272033186b62c298e',
    'relay:blank-seal': '01ae123d4dc61a9affe844eb1a9e2ece165352637ae2201c1db4d18476acb7de',
  };
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  const sceneRegistry: Record<string, { background: string }> = art.scenes;
  const itemRegistry: Record<string, { glyph: string }> = art.items;
  for (const [id, before] of Object.entries(scenes)) assert.notEqual(hash(sceneRegistry[id].background), before, `${id}: original background remains`);
  for (const [id, before] of Object.entries(items)) assert.notEqual(hash(itemRegistry[id].glyph), before, `${id}: original inventory image remains`);
});
