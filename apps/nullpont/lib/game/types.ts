export type StoryEntry = { id: string; chapter: string; title: string; text: string; turn: number };
export type GameState = {
  version: 2; room: string; focus?: string[]; inventory: string[]; flags: string[]; discoveries: string[];
  journal: string[]; book: StoryEntry[]; message: string; turns: number;
};
export type GameAction = { id: string; label: string; kind: 'look' | 'take' | 'use' | 'combine' | 'talk' | 'attack' | 'move' | 'submit' };
export type Target = { kind: 'environment' | 'item' | 'exit'; id: string };
export type PlayerCommand = { verb: GameAction['kind'] | 'back'; target?: Target; item?: string; topic?: string; input?: string; levels?: number };
export type SceneInput = { id: string; label: string; prompt: string; maxLength?: number; format?: 'digits' | 'text'; requires?: Requirement };
export type ArtSpot = { id: string; environment?: string; exit?: string; row: number; col: number; width: number; height: number; glyph?: string; glyphVariants?: StateText[]; actions?: ('look' | 'take' | 'talk' | 'attack' | 'use')[] };
export type Requirement = { flags?: string[]; withoutFlags?: string[]; items?: string[]; withoutItems?: string[]; discoveries?: string[] };
// First matching variant wins; only the selected text reaches the player view.
export type StateText = { requires: Requirement; text: string };
export type Rule = GameAction & {
  requires?: Requirement; message: string; messageVariants?: StateText[]; addFlags?: string[]; removeFlags?: string[];
  addItems?: string[]; removeItems?: string[]; moveTo?: string; focusTo?: string; notes?: string[];
  milestone?: { id: string; title: string; text: string };
  discover?: string[]; interaction?: PlayerCommand; portable?: boolean;
};
export type Chapter = {
  id: string; title: string; items: Record<string, string>;
  itemDescriptions?: Record<string, string>;
  itemArt?: Record<string, string>;
  goals?: { text: string; requires: Requirement; rooms?: string[] }[];
  scenes: Record<string, { title: string; description: string; descriptionVariants?: StateText[]; art: string; detailOf?: string; inputs?: SceneInput[]; requires?: Requirement; rules: Rule[];
    artSpots?: ArtSpot[];
    arrivalDiscoveries?: string[];
    environment?: { id: string; label: string; description?: string; descriptionVariants?: StateText[]; requires?: Requirement }[];
    exits?: { id: string; label: string; requires?: Requirement }[];
    topics?: { id: string; label: string; target: string; requires?: Requirement }[];
  }>;
  connections?: { from: string; rules: Rule[]; exits?: { id: string; label: string; requires?: Requirement }[]; artSpots?: ArtSpot[] }[];
};
