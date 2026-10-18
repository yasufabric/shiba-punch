import { describe, expect, it } from "vitest";
import drawSource from "./draw.ts?raw";
import { layoutPlayfield } from "./draw";
import gameSource from "./game.ts?raw";
import { FIELD_W, SHIBA_X } from "./game";
import htmlSource from "../index.html?raw";
import mainSource from "./main.ts?raw";
import paletteSource from "./palette.ts?raw";
import { OUTLINE, PALETTE } from "./palette";
import pixelsSource from "./pixels.ts?raw";
import { PIXEL_H, PIXEL_W, flipH, rotateQuarter, toPx, type Sprite } from "./pixels";
import sfxSource from "./sfx.ts?raw";
import spritesSource from "./sprites.ts?raw";
import {
  bossCat,
  everySprite,
  font,
  fontPop,
  glove,
  largeCat,
  outlinedSprites,
  shibaIdle,
  skyBands,
  skyline,
  smallCat,
  sparkGolds,
} from "./sprites";

const ALLOWED = new Set(PALETTE.map((color) => color.toLowerCase()));

const SOURCES: readonly { name: string; source: string }[] = [
  { name: "draw.ts", source: drawSource },
  { name: "game.ts", source: gameSource },
  { name: "main.ts", source: mainSource },
  { name: "palette.ts", source: paletteSource },
  { name: "pixels.ts", source: pixelsSource },
  { name: "sfx.ts", source: sfxSource },
  { name: "sprites.ts", source: spritesSource },
  { name: "index.html", source: htmlSource },
];

function hexColors(source: string): string[] {
  return source.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g) ?? [];
}

function edgeIsOutline(picture: Sprite): boolean {
  for (let y = 0; y < picture.h; y++) {
    for (let x = 0; x < picture.w; x++) {
      const index = picture.pixels[y * picture.w + x] ?? -1;
      if (index < 0) continue;
      let edge = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= picture.w || ny >= picture.h || (picture.pixels[ny * picture.w + nx] ?? -1) < 0) {
          edge = true;
        }
      }
      if (edge && index !== OUTLINE) return false;
    }
  }
  return true;
}

describe("palette", () => {
  it("draws sprites, font, effects, background, and UI with only the closed palette", () => {
    for (const picture of everySprite()) {
      for (const index of picture.pixels) {
        if (index < 0) continue;
        const color = PALETTE[index];
        expect(color, `index ${index}`).toBeTruthy();
        expect(ALLOWED.has((color ?? "").toLowerCase())).toBe(true);
      }
    }
    for (const band of skyBands) expect(ALLOWED.has((PALETTE[band.color] ?? "").toLowerCase())).toBe(true);
    for (const block of skyline) expect(ALLOWED.has((PALETTE[block.color] ?? "").toLowerCase())).toBe(true);
    for (const gold of sparkGolds) expect(ALLOWED.has((PALETTE[gold] ?? "").toLowerCase())).toBe(true);
    expect(new Set(PALETTE).size).toBe(PALETTE.length);
  });

  it("rejects hex, rgb, alpha, and gradients outside the palette in the game sources", () => {
    for (const file of SOURCES) {
      for (const color of hexColors(file.source)) {
        expect(ALLOWED.has(color.toLowerCase()), `${file.name} ${color}`).toBe(true);
      }
      expect(file.source, file.name).not.toMatch(/rgba?\s*\(/);
      expect(file.source, file.name).not.toMatch(/hsla?\s*\(/);
      expect(file.source, file.name).not.toMatch(/globalAlpha/);
      expect(file.source, file.name).not.toMatch(/createLinearGradient|createRadialGradient/);
      expect(file.source, file.name).not.toMatch(/\.scale\s*\(/);
      expect(file.source, file.name).not.toMatch(/\.rotate\s*\(/);
      expect(file.source, file.name).not.toMatch(/\.translate\s*\(/);
    }
    expect(drawSource).toContain("imageSmoothingEnabled = false");
    expect(mainSource).toContain("imageSmoothingEnabled = false");
    expect(htmlSource).toContain("image-rendering: pixelated");
  });

  it("keeps character outlines on the outer edge", () => {
    for (const picture of outlinedSprites()) expect(edgeIsOutline(picture)).toBe(true);
  });
});

describe("pixel grid", () => {
  it("uses a 195×422 buffer and presents 390×844 at 2×", () => {
    expect(PIXEL_W).toBe(195);
    expect(PIXEL_H).toBe(422);
    expect(toPx(SHIBA_X)).toBe(97);
    expect(toPx(0)).toBe(0);
    expect(toPx(FIELD_W - 1)).toBe(194);
    expect(layoutPlayfield(390, 844)).toEqual({ scale: 2, x: 0, y: 0 });
  });

  it("sizes shiba, cats, boss, and the damage font on whole pixels", () => {
    for (const picture of shibaIdle) expect(picture).toMatchObject({ w: 48, h: 48 });
    for (const picture of smallCat) expect(picture).toMatchObject({ w: 32, h: 32 });
    for (const picture of largeCat) expect(picture).toMatchObject({ w: 48, h: 48 });
    for (const picture of bossCat) expect(picture).toMatchObject({ w: 80, h: 80 });
    for (const picture of Object.values(font)) expect(picture).toMatchObject({ w: 8, h: 10 });
    for (const picture of Object.values(fontPop)) expect(picture).toMatchObject({ w: 12, h: 15 });
  });

  it("pops an 8×10 glyph to 12×15 by 3/2 nearest neighbor", () => {
    const source = font["8"];
    const popped = fontPop["8"];
    expect(source).toBeTruthy();
    expect(popped).toBeTruthy();
    if (!source || !popped) return;
    for (let y = 0; y < popped.h; y++) {
      const sy = Math.floor((y * source.h) / popped.h);
      for (let x = 0; x < popped.w; x++) {
        const sx = Math.floor((x * source.w) / popped.w);
        expect(popped.pixels[y * popped.w + x]).toBe(source.pixels[sy * source.w + sx]);
      }
    }
  });

  it("flips and turns sprites on whole pixels", () => {
    let turned = glove;
    for (let step = 0; step < 4; step++) turned = rotateQuarter(turned, 1);
    expect([...turned.pixels]).toEqual([...glove.pixels]);
    expect([...flipH(flipH(glove)).pixels]).toEqual([...glove.pixels]);
  });
});
