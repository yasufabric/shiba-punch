export const PIXEL_W = 195;
export const PIXEL_H = 422;

/** Map a 390×844 logic coordinate onto the 195×422 pixel grid. */
export function toPx(logical: number): number {
  return Math.floor(logical / 2);
}

export interface Sprite {
  readonly w: number;
  readonly h: number;
  readonly pixels: readonly number[];
}

export function nearestScale(sprite: Sprite, dw: number, dh: number): Sprite {
  const pixels = new Array<number>(dw * dh);
  for (let y = 0; y < dh; y++) {
    const sy = Math.floor((y * sprite.h) / dh);
    for (let x = 0; x < dw; x++) {
      const sx = Math.floor((x * sprite.w) / dw);
      pixels[y * dw + x] = sprite.pixels[sy * sprite.w + sx] ?? -1;
    }
  }
  return { w: dw, h: dh, pixels };
}

export function flipH(sprite: Sprite): Sprite {
  const pixels = new Array<number>(sprite.w * sprite.h);
  for (let y = 0; y < sprite.h; y++) {
    for (let x = 0; x < sprite.w; x++) {
      pixels[y * sprite.w + (sprite.w - 1 - x)] = sprite.pixels[y * sprite.w + x] ?? -1;
    }
  }
  return { w: sprite.w, h: sprite.h, pixels };
}

export function rotateQuarter(sprite: Sprite, quarter: number): Sprite {
  const turns = ((quarter % 4) + 4) % 4;
  if (sprite.w !== sprite.h) throw new Error("rotateQuarter expects a square sprite");
  if (turns === 0) return sprite;
  const size = sprite.w;
  const pixels = new Array<number>(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = x;
      let dy = y;
      if (turns === 1) {
        dx = size - 1 - y;
        dy = x;
      } else if (turns === 2) {
        dx = size - 1 - x;
        dy = size - 1 - y;
      } else {
        dx = y;
        dy = size - 1 - x;
      }
      pixels[dy * size + dx] = sprite.pixels[y * size + x] ?? -1;
    }
  }
  return { w: size, h: size, pixels };
}
