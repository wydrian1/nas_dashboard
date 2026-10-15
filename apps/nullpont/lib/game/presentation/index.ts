import artRegistry from './art/scenes.json' with { type: 'json' };
import bindingRegistry from './bindings.json' with { type: 'json' };
import type { ArtSpot, Requirement } from '../types.ts';

// The artist owns only art/scenes.json. IDs hNN/pNN are opaque visual handles:
// scene descriptions/required elements go to the artist, gameplay stays here.
type Handler = { id: string; row: number; col: number; width: number; height: number; glyph?: string; poses?: Record<string, string> };
type Assets = { version: 1; scenes: Record<string, { background: string; handlers: Handler[] }>; items: Record<string, { glyph: string }> };
type Binding = { handler: string; id: string; environment?: string; exit?: string; actions?: ArtSpot['actions']; variants?: { requires: Requirement; pose: string }[] };
type Bindings = { version: 1; scenes: Record<string, Binding[]> };
const MAX_WIDTH = 160, MAX_HEIGHT = 80;
const actions = ['look', 'take', 'talk', 'attack', 'use'];
const requirementKeys = ['flags', 'withoutFlags', 'items', 'withoutItems', 'discoveries'];

function fail(context: string, message: string): never { throw new Error(`Presentation ${context}: ${message}`); }
function object(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(context, 'expected object');
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[], context: string) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(context, `unknown field ${key}`);
}
function name(value: unknown, context: string): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9:_-]*$/.test(value)) fail(context, 'invalid ID');
}
function list(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) fail(context, 'expected array');
  return value;
}
function unique(values: string[], context: string) {
  if (new Set(values).size !== values.length) fail(context, 'duplicate ID/value');
}
function ascii(value: unknown, context: string, width = MAX_WIDTH, height = MAX_HEIGHT): string[] {
  if (typeof value !== 'string' || /[^\x20-\x7e\n]/.test(value)) fail(context, 'expected printable ASCII and LF only');
  const lines = value.split('\n');
  if (lines.length > height || lines.some(line => line.length > width)) fail(context, 'oversized ASCII dimensions');
  return lines;
}
function requirement(value: unknown, context: string) {
  const req = object(value, context);
  keys(req, requirementKeys, context);
  for (const [key, entries] of Object.entries(req)) {
    const values = list(entries, `${context}.${key}`);
    values.forEach(value => name(value, context));
    unique(values as string[], context);
  }
}

/** Strict allowlists keep all gameplay metadata out of the artist-owned JSON.
 * Handler rectangles are disjoint, including all named poses; geometry and
 * binding coverage are checked eagerly, even for scenes not yet visited.
 */
export function validatePresentation(rawArt: unknown, rawBindings: unknown): void {
  const art = object(rawArt, 'art'), bindings = object(rawBindings, 'bindings');
  keys(art, ['version', 'scenes', 'items'], 'art');
  keys(bindings, ['version', 'scenes'], 'bindings');
  if (art.version !== 1 || bindings.version !== 1) fail('registry', 'unsupported version');
  const scenes = object(art.scenes, 'scenes'), boundScenes = object(bindings.scenes, 'bindings.scenes');
  for (const key of Object.keys(boundScenes)) if (!Object.hasOwn(scenes, key)) fail(key, 'extra binding scene');
  for (const [sceneId, rawScene] of Object.entries(scenes)) {
    name(sceneId, 'scene');
    const scene = object(rawScene, sceneId);
    keys(scene, ['background', 'handlers'], sceneId);
    const lines = ascii(scene.background, sceneId);
    if (!lines.some(line => line.length)) fail(sceneId, 'empty canvas');
    const handlers = list(scene.handlers, sceneId).map(raw => {
      const h = object(raw, sceneId);
      keys(h, ['id', 'row', 'col', 'width', 'height', 'glyph', 'poses'], sceneId);
      name(h.id, sceneId);
      for (const field of ['row', 'col', 'width', 'height']) {
        if (!Number.isInteger(h[field]) || (h[field] as number) < (field === 'width' || field === 'height' ? 1 : 0)) fail(sceneId, `invalid ${field}`);
      }
      const handler = h as Handler;
      // Existing scenes use ragged lines; the renderer pads them to canvas width.
      if (handler.row + handler.height > lines.length || handler.col + handler.width > Math.max(...lines.map(line => line.length))) fail(sceneId, `out-of-bounds handler ${handler.id}`);
      if (handler.glyph !== undefined) ascii(handler.glyph, `${sceneId}/${handler.id}`, handler.width, handler.height);
      if (handler.poses !== undefined) for (const [pose, glyph] of Object.entries(object(handler.poses, sceneId))) {
        name(pose, sceneId);
        ascii(glyph, `${sceneId}/${handler.id}/${pose}`, handler.width, handler.height);
      }
      return handler;
    });
    unique(handlers.map(h => h.id), sceneId);
    handlers.forEach((a, index) => {
      for (const b of handlers.slice(index + 1)) if (a.row < b.row + b.height && b.row < a.row + a.height && a.col < b.col + b.width && b.col < a.col + a.width) fail(sceneId, `overlapping handlers ${a.id}/${b.id}`);
    });
    if (!Object.hasOwn(boundScenes, sceneId)) fail(sceneId, 'missing binding scene');
    const bound = list(boundScenes[sceneId], sceneId).map(raw => {
      const b = object(raw, sceneId);
      keys(b, ['handler', 'id', 'environment', 'exit', 'actions', 'variants'], sceneId);
      name(b.handler, sceneId); name(b.id, sceneId);
      if (!b.environment && !b.exit) fail(sceneId, 'binding needs environment and/or exit');
      if (b.environment !== undefined) name(b.environment, sceneId);
      if (b.exit !== undefined) name(b.exit, sceneId);
      if (b.actions !== undefined) {
        const values = list(b.actions, sceneId);
        if (values.some(value => !actions.includes(value as string))) fail(sceneId, 'unknown generic action');
        unique(values as string[], sceneId);
      }
      const handler = handlers.find(h => h.id === b.handler);
      if (!handler) fail(sceneId, `unknown handler binding ${b.handler}`);
      const poses: string[] = [];
      if (b.variants !== undefined) for (const raw of list(b.variants, sceneId)) {
        const variant = object(raw, sceneId);
        keys(variant, ['requires', 'pose'], sceneId);
        requirement(variant.requires, sceneId); name(variant.pose, sceneId);
        if (!Object.hasOwn(handler.poses ?? {}, variant.pose)) fail(sceneId, `unknown pose ${variant.pose}`);
        poses.push(variant.pose);
      }
      unique(poses, sceneId);
      for (const pose of Object.keys(handler.poses ?? {})) if (!poses.includes(pose)) fail(sceneId, `missing pose binding ${pose}`);
      return b as Binding;
    });
    unique(bound.map(b => b.handler), sceneId);
    unique(bound.map(b => b.id), sceneId);
    for (const h of handlers) if (!bound.some(b => b.handler === h.id)) fail(sceneId, `missing handler binding ${h.id}`);
  }
  for (const [id, raw] of Object.entries(object(art.items, 'items'))) {
    name(id, 'item');
    const item = object(raw, id); keys(item, ['glyph'], id);
    const lines = ascii(item.glyph, id, 18, 9);
    if (!lines.some(line => line.trim())) fail(id, 'empty inventory glyph');
  }
}

/** Also usable by tools/tests to validate a proposed artist/coder pair in memory. */
export function createPresentation(rawArt: unknown, rawBindings: unknown) {
  validatePresentation(rawArt, rawBindings);
  // Own a snapshot: neither callers nor assembled chapter objects mutate assets.
  const art = structuredClone(rawArt) as Assets, bindings = structuredClone(rawBindings) as Bindings;
  function bindScene(sceneId: string): { art: string; artSpots: ArtSpot[] } {
    if (!Object.hasOwn(art.scenes, sceneId)) fail(sceneId, 'unknown scene');
    const scene = art.scenes[sceneId];
    return { art: scene.background, artSpots: bindings.scenes[sceneId].map(binding => {
      const handler = scene.handlers.find(h => h.id === binding.handler)!;
      const { row, col, width, height, glyph } = handler;
      return { id: binding.id, row, col, width, height,
        ...(binding.environment === undefined ? {} : { environment: binding.environment }),
        ...(binding.exit === undefined ? {} : { exit: binding.exit }),
        ...(binding.actions === undefined ? {} : { actions: [...binding.actions] }),
        ...(glyph === undefined ? {} : { glyph }),
        ...(binding.variants === undefined ? {} : { glyphVariants: binding.variants.map(variant => ({ requires: structuredClone(variant.requires), text: handler.poses![variant.pose] })) }),
      };
    }) };
  }
  function itemArt(itemId: string): string {
    if (!Object.hasOwn(art.items, itemId)) fail(itemId, 'unknown item');
    return art.items[itemId].glyph;
  }
  function itemArts(ids: readonly string[]): Record<string, string> { return Object.fromEntries(ids.map(id => [id, itemArt(id)])); }
  return { bindScene, itemArt, itemArts };
}

export const { bindScene, itemArt, itemArts } = createPresentation(artRegistry, bindingRegistry);
