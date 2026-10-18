/** Closed set of colors the game is allowed to draw. */
export const PALETTE = [
  "#6b2e12",
  "#a8521e",
  "#e08a3c",
  "#f6c27a",
  "#8a7f86",
  "#c9c0c4",
  "#fffaf0",
  "#2b1d3a",
  "#5a3f7a",
  "#9a7ccf",
  "#d8c8f0",
  "#7a4a00",
  "#e0a200",
  "#ffe066",
  "#fffbd1",
  "#8a0f3a",
  "#ff3d7f",
  "#ffb3cf",
  "#0b0f1e",
  "#18213d",
  "#2c3a63",
  "#4a5d8f",
  "#120b10",
] as const;

export type PaletteIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22;

export const C = {
  shibaDeep: PALETTE[0],
  shibaShadow: PALETTE[1],
  shibaFur: PALETTE[2],
  shibaLight: PALETTE[3],
  creamShadow: PALETTE[4],
  cream: PALETTE[5],
  white: PALETTE[6],
  enemyDeep: PALETTE[7],
  enemyShadow: PALETTE[8],
  enemyFur: PALETTE[9],
  enemyLight: PALETTE[10],
  goldDeep: PALETTE[11],
  gold: PALETTE[12],
  goldLight: PALETTE[13],
  goldPale: PALETTE[14],
  dangerDeep: PALETTE[15],
  danger: PALETTE[16],
  dangerLight: PALETTE[17],
  night0: PALETTE[18],
  night1: PALETTE[19],
  night2: PALETTE[20],
  night3: PALETTE[21],
  outline: PALETTE[22],
} as const;

export const OUTLINE: PaletteIndex = 22;
export const WHITE: PaletteIndex = 6;
export const DANGER: PaletteIndex = 16;

const GOLD: readonly PaletteIndex[] = [11, 12, 13, 14];

/** Two-frame charge glow: every gold jumps two steps so the cluster pulses. */
export function chargeGold(index: number, frame: 0 | 1): number {
  if (frame === 0) return index;
  const pos = GOLD.indexOf(index as PaletteIndex);
  if (pos < 0) return index;
  return GOLD[(pos + 2) % GOLD.length] ?? index;
}

export const INK: Readonly<Record<string, number>> = {
  ".": -1,
  "1": 0,
  "2": 1,
  "3": 2,
  "4": 3,
  "5": 4,
  "6": 5,
  "7": 6,
  "8": 7,
  "9": 8,
  a: 9,
  b: 10,
  c: 11,
  d: 12,
  e: 13,
  f: 14,
  g: 15,
  h: 16,
  i: 17,
  j: 18,
  k: 19,
  l: 20,
  m: 21,
  o: 22,
};
