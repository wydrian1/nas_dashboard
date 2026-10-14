import { awakening } from './chapters/awakening.ts';
import { archive } from './chapters/archive.ts';
import type { Chapter, Requirement, GameState } from './types.ts';

// Append AI-authored chapters here; never replace published IDs or old chapters.
export const CHAPTERS: Chapter[] = [awakening, archive];
export function createCatalog(chapters: Chapter[]) {
  const scenes: Chapter['scenes'] = {}, items: Record<string, string> = {}, itemDescriptions: Record<string, string> = {}, itemArt: Record<string, string> = {}, owners: Record<string, string> = {}, ruleOwners: Record<string, string> = {};
  const chapterIds = new Set<string>();
  for (const chapter of chapters) {
    if (chapterIds.has(chapter.id)) throw new Error('Duplikált fejezetazonosító.');
    chapterIds.add(chapter.id);
    for (const [id, name] of Object.entries(chapter.items)) {
      if (id in items) throw new Error('Duplikált tárgyazonosító.');
      items[id] = name;
    }
    for (const [id, description] of Object.entries(chapter.itemDescriptions ?? {})) {
      if (!Object.hasOwn(chapter.items, id)) throw new Error('Ismeretlen tárgyleírás.');
      itemDescriptions[id] = description;
    }
    for (const [id, art] of Object.entries(chapter.itemArt ?? {})) {
      if (!Object.hasOwn(chapter.items, id) || !art || /[^\x20-\x7e\n]/.test(art)) throw new Error('Érvénytelen tárgyrajz.');
      itemArt[id] = art;
    }
    for (const [id, scene] of Object.entries(chapter.scenes)) {
      if (id in scenes || new Set(scene.rules.map(rule => rule.id)).size !== scene.rules.length) throw new Error('Duplikált helyszín vagy művelet.');
      scenes[id] = { ...scene, rules: [...scene.rules], artSpots: scene.artSpots ? [...scene.artSpots] : undefined }; owners[id] = chapter.title;
      for (const rule of scene.rules) ruleOwners[`${id}:${rule.id}`] = chapter.title;
    }
  }
  // New exits can be attached to published rooms without rewriting old chapters.
  for (const chapter of chapters) for (const connection of chapter.connections ?? []) {
    if (!Object.hasOwn(scenes, connection.from)) throw new Error('Ismeretlen csatlakozási helyszín.');
    for (const rule of connection.rules) {
      if (scenes[connection.from].rules.some(existing => existing.id === rule.id)) throw new Error('Duplikált csatlakozási művelet.');
      scenes[connection.from].rules.push(rule);
      ruleOwners[`${connection.from}:${rule.id}`] = chapter.title;
    }
    const scene = scenes[connection.from];
    scene.exits = [...scene.exits ?? []];
    for (const exit of connection.exits ?? []) {
      if (scene.exits.some(existing => existing.id === exit.id)) throw new Error('Duplikált kijárat.');
      scene.exits.push(exit);
    }
    if (connection.artSpots?.length) scene.artSpots = [...scene.artSpots ?? [], ...connection.artSpots];
  }
  const flags = new Set<string>(), discoveries = new Set<string>();
  for (const scene of Object.values(scenes)) for (const entity of scene.environment ?? []) {
    if (discoveries.has(entity.id)) throw new Error('Duplikált környezeti elem.');
    discoveries.add(entity.id);
  }
  const milestoneIds = new Set<string>(['awakening:wake']);
  for (const [id, scene] of Object.entries(scenes)) {
    const seen = new Set<string>([id]);
    let parent = scene.detailOf;
    while (parent) {
      if (!Object.hasOwn(scenes, parent) || seen.has(parent)) throw new Error('Ismeretlen vagy ciklikus részlethelyszín.');
      seen.add(parent); parent = scenes[parent].detailOf;
      if (seen.size > 33) throw new Error('Túl mély részlethelyszín.');
    }
    if (scene.detailOf && (!scene.art || !scene.artSpots?.length)) throw new Error('Hiányzó részletrajz vagy ASCII-célpont.');
    if (scene.detailOf && !scenes[scene.detailOf].rules.some(rule => rule.focusTo === id)) throw new Error('Árva részlethelyszín.');
    const inputIds = new Set<string>();
    for (const input of scene.inputs ?? []) {
      if (inputIds.has(input.id) || !(scene.environment ?? []).some(entity => entity.id === input.id) || !input.label || !input.prompt || (input.maxLength !== undefined && (!Number.isSafeInteger(input.maxLength) || input.maxLength < 1 || input.maxLength > 256)) || (input.format !== undefined && !['digits','text'].includes(input.format))) throw new Error('Érvénytelen jelenetbevitel.');
      inputIds.add(input.id);
    }
    for (const rule of scene.rules) {
      if (rule.focusTo && (!Object.hasOwn(scenes, rule.focusTo) || scenes[rule.focusTo].detailOf !== id || rule.moveTo || rule.interaction?.verb !== 'look' || rule.interaction.target?.kind !== 'environment')) throw new Error('Érvénytelen részletcélpont.');
      if (rule.focusTo && !(scene.environment ?? []).some(entity => entity.id === rule.interaction?.target?.id)) throw new Error('Ismeretlen részletobjektum.');
      if (rule.moveTo && scenes[rule.moveTo]?.detailOf) throw new Error('Részlet nem lehet fizikai célhelyszín.');
      if (rule.interaction?.verb === 'submit') {
        const input = scene.inputs?.find(input => input.id === rule.interaction?.target?.id);
        const answer = rule.interaction.input;
        if (rule.kind !== 'submit' || rule.interaction.target?.kind !== 'environment' || !input || typeof answer !== 'string' || !answer || answer !== answer.trim() || answer.length > (input.maxLength ?? 80) || /[\x00-\x1f\x7f]/.test(answer) || (input.format === 'digits' && !/^\d+$/.test(answer))) throw new Error('Érvénytelen bevitelművelet.');
      } else if (rule.interaction?.input !== undefined || rule.kind === 'submit') throw new Error('Érvénytelen bevitelművelet.');
    }
  }
  for (const scene of Object.values(scenes)) {
    if (scene.arrivalDiscoveries && (new Set(scene.arrivalDiscoveries).size !== scene.arrivalDiscoveries.length || scene.arrivalDiscoveries.some(id => !(scene.environment ?? []).some(entity => entity.id === id)))) throw new Error('Érvénytelen érkezési felfedezés.');
    if (scene.artSpots) {
      const lines = scene.art.split('\n'), columns = Math.max(...lines.map(line => line.length)), ids = new Set<string>();
      for (const spot of scene.artSpots) {
        if (!spot.id || ids.has(spot.id) || ![spot.row, spot.col, spot.width, spot.height].every(Number.isSafeInteger) || spot.row < 0 || spot.col < 0 || spot.width < 1 || spot.height < 1 || spot.row + spot.height > lines.length || spot.col + spot.width > columns) throw new Error('Érvénytelen ASCII-célpont.');
        ids.add(spot.id);
        if ((!spot.environment && !spot.exit) || (spot.environment && !(scene.environment ?? []).some(entity => entity.id === spot.environment)) || (spot.exit && !(scene.exits ?? []).some(exit => exit.id === spot.exit))) throw new Error('Ismeretlen ASCII-célpont.');
        if (spot.glyph && (spot.glyph.split('\n').length > spot.height || spot.glyph.split('\n').some(line => line.length > spot.width) || /[^\x20-\x7e\n]/.test(spot.glyph))) throw new Error('Érvénytelen ASCII-részlet.');
        if (spot.actions?.some(action => !['look','take','talk','attack'].includes(action))) throw new Error('Érvénytelen képi akció.');
      }
      for (const entity of scene.environment ?? []) if (!scene.artSpots.some(spot => spot.environment === entity.id)) throw new Error('Hiányzó környezeti ASCII-célpont.');
      for (const exit of scene.exits ?? []) if (!scene.artSpots.some(spot => spot.exit === exit.id)) throw new Error('Hiányzó kijárati ASCII-célpont.');
    }
    for (const rule of scene.rules) {
      if (rule.moveTo && !Object.hasOwn(scenes, rule.moveTo)) throw new Error('Ismeretlen célhelyszín.');
      for (const item of [...rule.addItems ?? [], ...rule.removeItems ?? [], ...rule.requires?.items ?? [], ...rule.requires?.withoutItems ?? []]) if (!(item in items)) throw new Error('Ismeretlen tárgy.');
      for (const flag of [...rule.addFlags ?? [], ...rule.removeFlags ?? [], ...rule.requires?.flags ?? [], ...rule.requires?.withoutFlags ?? []]) flags.add(flag);
      for (const entity of [...rule.discover ?? [], ...rule.requires?.discoveries ?? []]) if (!discoveries.has(entity)) throw new Error('Ismeretlen felfedezés.');
      if (rule.milestone) {
        if (milestoneIds.has(rule.milestone.id)) throw new Error('Duplikált mérföldkő.');
        milestoneIds.add(rule.milestone.id);
      }
    }
    for (const flag of [...scene.requires?.flags ?? [], ...scene.requires?.withoutFlags ?? []]) flags.add(flag);
    for (const entity of [...scene.environment ?? [], ...scene.exits ?? [], ...scene.topics ?? [], ...scene.inputs ?? []]) {
      for (const flag of [...entity.requires?.flags ?? [], ...entity.requires?.withoutFlags ?? []]) flags.add(flag);
      for (const id of entity.requires?.discoveries ?? []) if (!discoveries.has(id)) throw new Error('Ismeretlen nézetfeltétel.');
      for (const item of [...entity.requires?.items ?? [], ...entity.requires?.withoutItems ?? []]) if (!Object.hasOwn(items, item)) throw new Error('Ismeretlen nézettárgy.');
    }
  }
  return { scenes, items, itemDescriptions, itemArt, owners, ruleOwners, flags, discoveries };
}
export const CATALOG = createCatalog(CHAPTERS);
export type AdventureCatalog = ReturnType<typeof createCatalog>;
export function meets(state: GameState, requirement?: Requirement) {
  return !requirement || (requirement.flags ?? []).every(flag => state.flags.includes(flag)) &&
    (requirement.withoutFlags ?? []).every(flag => !state.flags.includes(flag)) &&
    (requirement.items ?? []).every(item => state.inventory.includes(item)) &&
    (requirement.withoutItems ?? []).every(item => !state.inventory.includes(item)) &&
    (requirement.discoveries ?? []).every(id => state.discoveries.includes(id));
}
