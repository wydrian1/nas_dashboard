export type StoryEntry = { id: string; chapter: string; title: string; text: string; turn: number };
export type GameState = {
  version: 1; room: string; inventory: string[]; flags: string[];
  journal: string[]; book: StoryEntry[]; message: string; turns: number;
};
export type GameAction = { id: string; label: string; kind: 'look' | 'take' | 'use' | 'combine' | 'talk' | 'attack' | 'move' };
export type Requirement = { flags?: string[]; withoutFlags?: string[]; items?: string[]; withoutItems?: string[] };
export type Rule = GameAction & {
  requires?: Requirement; message: string; addFlags?: string[];
  addItems?: string[]; removeItems?: string[]; moveTo?: string; notes?: string[];
  milestone?: { id: string; title: string; text: string };
};
export type Chapter = {
  id: string; title: string; items: Record<string, string>;
  scenes: Record<string, { title: string; description: string; art: string; requires?: Requirement; rules: Rule[] }>;
  connections?: { from: string; rules: Rule[] }[];
};
