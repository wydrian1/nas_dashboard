import { awakening } from './chapters/awakening.ts';
import type { Chapter, Requirement, GameState } from './types.ts';

// Append AI-authored chapters here; never replace published IDs or old chapters.
export const CHAPTERS: Chapter[] = [awakening];
export function createCatalog(chapters: Chapter[]) {
  const scenes: Chapter['scenes'] = {}, items: Record<string, string> = {}, owners: Record<string, string> = {}, ruleOwners: Record<string, string> = {};
  const chapterIds = new Set<string>();
  for (const chapter of chapters) {
    if (chapterIds.has(chapter.id)) throw new Error('Duplikált fejezetazonosító.');
    chapterIds.add(chapter.id);
    for (const [id, name] of Object.entries(chapter.items)) {
      if (id in items) throw new Error('Duplikált tárgyazonosító.');
      items[id] = name;
    }
    for (const [id, scene] of Object.entries(chapter.scenes)) {
      if (id in scenes || new Set(scene.rules.map(rule => rule.id)).size !== scene.rules.length) throw new Error('Duplikált helyszín vagy művelet.');
      scenes[id] = { ...scene, rules: [...scene.rules] }; owners[id] = chapter.title;
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
  }
  const flags = new Set<string>();
  const milestoneIds = new Set<string>(['awakening:wake']);
  for (const scene of Object.values(scenes)) {
    for (const rule of scene.rules) {
      if (rule.moveTo && !Object.hasOwn(scenes, rule.moveTo)) throw new Error('Ismeretlen célhelyszín.');
      for (const item of [...rule.addItems ?? [], ...rule.removeItems ?? [], ...rule.requires?.items ?? [], ...rule.requires?.withoutItems ?? []]) if (!(item in items)) throw new Error('Ismeretlen tárgy.');
      for (const flag of [...rule.addFlags ?? [], ...rule.requires?.flags ?? [], ...rule.requires?.withoutFlags ?? []]) flags.add(flag);
      if (rule.milestone) {
        if (milestoneIds.has(rule.milestone.id)) throw new Error('Duplikált mérföldkő.');
        milestoneIds.add(rule.milestone.id);
      }
    }
    for (const flag of [...scene.requires?.flags ?? [], ...scene.requires?.withoutFlags ?? []]) flags.add(flag);
  }
  return { scenes, items, owners, ruleOwners, flags };
}
export const CATALOG = createCatalog(CHAPTERS);
export type AdventureCatalog = ReturnType<typeof createCatalog>;
export function meets(state: GameState, requirement?: Requirement) {
  return !requirement || (requirement.flags ?? []).every(flag => state.flags.includes(flag)) &&
    (requirement.withoutFlags ?? []).every(flag => !state.flags.includes(flag)) &&
    (requirement.items ?? []).every(item => state.inventory.includes(item)) &&
    (requirement.withoutItems ?? []).every(item => !state.inventory.includes(item));
}
