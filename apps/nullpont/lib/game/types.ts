export type StoryEntry = { id: string; chapter: string; title: string; text: string; turn: number };
export type GameState = {
  version: 2; room: string; inventory: string[]; flags: string[]; discoveries: string[];
  journal: string[]; book: StoryEntry[]; message: string; turns: number;
};
export type GameAction = { id: string; label: string; kind: 'look' | 'take' | 'use' | 'combine' | 'talk' | 'attack' | 'move' };
export type Target = { kind: 'environment' | 'item' | 'exit'; id: string };
export type PlayerCommand = { verb: GameAction['kind']; target?: Target; item?: string; topic?: string };
export type Requirement = { flags?: string[]; withoutFlags?: string[]; items?: string[]; withoutItems?: string[]; discoveries?: string[] };
export type Rule = GameAction & {
  requires?: Requirement; message: string; addFlags?: string[];
  addItems?: string[]; removeItems?: string[]; moveTo?: string; notes?: string[];
  milestone?: { id: string; title: string; text: string };
  discover?: string[]; interaction?: PlayerCommand;
};
export type Chapter = {
  id: string; title: string; items: Record<string, string>;
  itemDescriptions?: Record<string, string>;
  scenes: Record<string, { title: string; description: string; art: string; requires?: Requirement; rules: Rule[];
    environment?: { id: string; label: string; requires?: Requirement }[];
    exits?: { id: string; label: string; requires?: Requirement }[];
    topics?: { id: string; label: string; target: string; requires?: Requirement }[];
  }>;
  connections?: { from: string; rules: Rule[]; exits?: { id: string; label: string; requires?: Requirement }[] }[];
};
