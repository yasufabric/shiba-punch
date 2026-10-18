import {
  LANE_Y,
  PLAYER_HP,
  RUN_LENGTH,
  SHIBA_X,
  WAVE_BOSS_AT,
  type Enemy,
  type EnemyKind,
  type GameState,
  type Side,
} from "./game";
import { DANGER, OUTLINE, PALETTE, WHITE, chargeGold } from "./palette";
import {
  flipH,
  rotateQuarter,
  spanX,
  spanY,
  viewHeight,
  viewWidth,
  viewX,
  viewY,
  type Sprite,
} from "./pixels";
import {
  arm,
  bulldog,
  chihuahua,
  dachshund,
  dash,
  finger,
  font,
  fontPop,
  glove,
  gloveWin,
  mastiff,
  moon,
  pawOff,
  pawOn,
  shadowBoss,
  shadowLarge,
  shadowShiba,
  shadowSmall,
  shibaIdle,
  skyBands,
  skyStars,
  skyline,
  sparkGolds,
  stBernard,
  star,
} from "./sprites";

export interface Layout {
  scale: number;
  width: number;
  height: number;
  x: number;
  y: number;
}

/** Internal pixels = viewport / integer scale, covering the viewport with no margin. */
export function layoutPlayfield(cssW: number, cssH: number): Layout {
  const scale = 2;
  const viewW = Math.max(scale, Math.round(cssW));
  const viewH = Math.max(scale, Math.round(cssH));
  return {
    scale,
    width: Math.max(1, Math.ceil(viewW / scale)),
    height: Math.max(1, Math.ceil(viewH / scale)),
    x: 0,
    y: 0,
  };
}

/** Feet sit this many pixels below the logic center, on the ground line. */
const FOOT_DROP = 22;

interface Ink {
  flash: boolean;
  telegraph: boolean;
  gold: 0 | 1 | null;
}

const PLAIN: Ink = { flash: false, telegraph: false, gold: null };

function colorAt(index: number, ink: Ink): number {
  if (index < 0) return -1;
  if (index === OUTLINE) return ink.telegraph ? DANGER : OUTLINE;
  if (ink.flash) return WHITE;
  if (ink.gold === 1) return chargeGold(index, 1);
  return index;
}

function fillAt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, index: number): void {
  const color = PALETTE[index];
  if (!color || w <= 0 || h <= 0) return;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function blit(ctx: CanvasRenderingContext2D, picture: Sprite, left: number, top: number, ink: Ink): void {
  ctx.imageSmoothingEnabled = false;
  const x0 = Math.round(left);
  const y0 = Math.round(top);
  for (let y = 0; y < picture.h; y++) {
    for (let x = 0; x < picture.w; x++) {
      const index = colorAt(picture.pixels[y * picture.w + x] ?? -1, ink);
      const color = index < 0 ? undefined : PALETTE[index];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x0 + x, y0 + y, 1, 1);
    }
  }
}

function place(picture: Sprite, cx: number, cy: number): { x: number; y: number } {
  return {
    x: cx - Math.floor(picture.w / 2),
    y: cy + FOOT_DROP - picture.h,
  };
}

const SMALL_DOGS: readonly (readonly Sprite[])[] = [chihuahua, dachshund, bulldog];

function framesFor(kind: EnemyKind, id: number): readonly Sprite[] {
  switch (kind) {
    case "small":
      return SMALL_DOGS[id % SMALL_DOGS.length] ?? chihuahua;
    case "large":
      return stBernard;
    case "boss":
      return mastiff;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

function shadowFor(kind: EnemyKind): Sprite {
  switch (kind) {
    case "small":
      return shadowSmall;
    case "large":
      return shadowLarge;
    case "boss":
      return shadowBoss;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

function quarterOf(spin: number): 0 | 1 | 2 | 3 {
  const wrapped = ((Math.round(spin / (Math.PI / 2)) % 4) + 4) % 4;
  switch (wrapped) {
    case 0:
      return 0;
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 3;
    default:
      return 0;
  }
}

function punchPhase(state: GameState): 0 | 1 | 2 | 3 | null {
  if (state.punchT <= 0 || state.punchSide === null) return null;
  const unit = state.punchDur > 0 ? (state.punchDur - state.punchT) / state.punchDur : 1;
  if (unit < 0.22) return 0;
  if (unit < 0.45) return 1;
  if (unit < 0.72) return 2;
  return 3;
}

function reachFor(phase: 0 | 1 | 2 | 3, kind: GameState["punchKind"]): number {
  const full = kind === "super" ? 28 : 18;
  switch (phase) {
    case 0:
      return -6;
    case 1:
      return full;
    case 2:
      return Math.round(full / 2);
    case 3:
      return 4;
    default: {
      const neverPhase: never = phase;
      return neverPhase;
    }
  }
}

function showHitFlash(flash: number): boolean {
  return flash > 0.04;
}

function showShibaFlash(hurtT: number): boolean {
  return hurtT > 0.24 || (hurtT > 0.16 && hurtT <= 0.22);
}

function shakeOf(state: GameState): { x: number; y: number } {
  if (state.shake <= 0) return { x: 0, y: 0 };
  const mag = Math.min(3, Math.max(1, Math.ceil(state.shake / 6)));
  const step = Math.floor(state.anim * 24) % 4;
  if (step === 0) return { x: mag, y: 0 };
  if (step === 1) return { x: 0, y: mag };
  if (step === 2) return { x: -mag, y: 0 };
  return { x: 0, y: -mag };
}

function drawBackground(ctx: CanvasRenderingContext2D, anim: number): void {
  const width = viewWidth();
  const height = viewHeight();
  fillAt(ctx, 0, 0, width, height, 18);
  for (const band of skyBands) {
    const y0 = spanY(band.y);
    const y1 = spanY(band.y + band.h);
    fillAt(ctx, 0, y0, width, Math.max(0, y1 - y0), band.color);
  }
  for (const block of skyline) {
    const x0 = spanX(block.x);
    const x1 = spanX(block.x + block.w);
    const y0 = spanY(block.y);
    const y1 = spanY(block.y + block.h);
    fillAt(ctx, x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0), block.color);
  }
  blit(ctx, moon, spanX(14), spanY(16), PLAIN);
  const twinkle = Math.floor(anim * 4);
  skyStars.forEach((starBit, index) => {
    const dim = (index + twinkle) % 5 === 0;
    const gold = sparkGolds[(index + twinkle) % sparkGolds.length] ?? 13;
    fillAt(ctx, spanX(starBit.x), spanY(starBit.y), starBit.s, starBit.s, dim ? 21 : gold);
  });
}

function drawShadowAt(ctx: CanvasRenderingContext2D, picture: Sprite, cx: number): void {
  const foot = viewY(LANE_Y) + FOOT_DROP;
  blit(ctx, picture, cx - Math.floor(picture.w / 2), foot - Math.floor(picture.h / 2), PLAIN);
}

function enemyPicture(enemy: Enemy, anim: number): Sprite {
  const frames = framesFor(enemy.kind, enemy.id);
  const walking = enemy.phase === "approach";
  const frame = walking ? Math.floor(anim * 12) % 4 : Math.floor(anim * 4) % 2;
  let picture = frames[enemy.phase === "blown" ? 0 : frame] ?? frames[0] ?? chihuahua[0];
  if (!picture) return chihuahua[0] ?? glove;
  if (enemy.side === "left") picture = flipH(picture);
  if (enemy.phase === "blown") picture = rotateQuarter(picture, quarterOf(enemy.spin));
  return picture;
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, state: GameState, shake: { x: number; y: number }): void {
  const telegraph = enemy.phase === "telegraph" && Math.floor(state.anim * 6) % 2 === 0;
  const lunge = telegraph ? (enemy.side === "left" ? 1 : -1) : 0;
  const cx = viewX(enemy.x) + shake.x + lunge;
  const cy = viewY(enemy.y) + shake.y;
  if (enemy.phase !== "blown" || cy > viewY(LANE_Y) - 24) {
    drawShadowAt(ctx, shadowFor(enemy.kind), cx);
  }
  const picture = enemyPicture(enemy, state.anim);
  const at = place(picture, cx, cy);
  blit(ctx, picture, at.x, at.y, {
    flash: showHitFlash(enemy.flash),
    telegraph,
    gold: null,
  });
  if (enemy.flash > 0) {
    const starFrame = enemy.flash > 0.066 ? 0 : enemy.flash > 0.033 ? 1 : 2;
    const burst = star[starFrame] ?? star[0];
    if (burst) blit(ctx, burst, cx - Math.floor(burst.w / 2), cy - Math.floor(burst.h / 2), PLAIN);
  }
}

function drawArm(ctx: CanvasRenderingContext2D, fromX: number, toX: number, y: number): void {
  const left = Math.min(fromX, toX);
  const right = Math.max(fromX, toX);
  for (let x = left; x < right; x += arm.w - 2) {
    blit(ctx, arm, x, y, PLAIN);
  }
}

function drawGlove(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  side: Side,
  cx: number,
  cy: number,
  phase: 0 | 1 | 2 | 3 | null,
): void {
  const dir: number = side === "left" ? -1 : 1;
  const punching = phase !== null && state.punchSide === side;
  const along = punching && phase !== null ? reachFor(phase, state.punchKind) : 0;
  const gx = cx + dir * (22 + along);
  const gy = cy + 8 + (punching && phase === 0 ? -3 : 0);
  const picture = side === "left" ? flipH(glove) : glove;
  const left = gx - Math.floor(picture.w / 2);
  const top = gy - Math.floor(picture.h / 2);
  if (Math.abs(along) > 4) {
    drawArm(ctx, cx + dir * 12, gx - dir * 6, gy - 2);
  }
  const charging =
    side === "left"
      ? state.chargeLeft > 0 && !state.latchLeft
      : state.chargeRight > 0 && !state.latchRight;
  const goldFrame = charging && Math.floor(state.anim * 8) % 2 === 1 ? 1 : 0;
  blit(ctx, picture, left, top, { flash: false, telegraph: false, gold: charging ? goldFrame : null });
  if (!charging) return;
  const bits: readonly { x: number; y: number; s: 1 | 2 }[] = [
    { x: -4, y: -6, s: 2 },
    { x: picture.w, y: -4, s: 2 },
    { x: picture.w - 2, y: picture.h - 2, s: 1 },
    { x: -2, y: picture.h, s: 1 },
  ];
  bits.forEach((bit, index) => {
    const color = sparkGolds[(index + goldFrame) % sparkGolds.length] ?? 13;
    fillAt(ctx, left + bit.x, top + bit.y, bit.s, bit.s, color);
  });
}

function drawShiba(ctx: CanvasRenderingContext2D, state: GameState, shake: { x: number; y: number }): void {
  const phase = punchPhase(state);
  const idleFrame = Math.floor(state.anim * 4) % 2;
  const body = shibaIdle[phase === null ? idleFrame : 0] ?? shibaIdle[0];
  if (!body) return;
  let bob = idleFrame === 1 ? 1 : 0;
  if (phase === 0) bob += 1;
  if (phase === 1) bob -= 1;
  const dir: number = state.punchSide === "left" ? -1 : 1;
  const lean = phase === 1 ? dir : phase === 0 ? -dir : 0;
  const cx = viewX(SHIBA_X) + shake.x + lean;
  const cy = viewY(LANE_Y) + shake.y + bob;
  drawShadowAt(ctx, shadowShiba, cx);
  const at = place(body, cx, cy);
  blit(ctx, body, at.x, at.y, { flash: showShibaFlash(state.hurtT), telegraph: false, gold: null });
  drawGlove(ctx, state, "left", cx, cy + 2, phase);
  drawGlove(ctx, state, "right", cx, cy + 2, phase);
}

function drawDigits(ctx: CanvasRenderingContext2D, value: number, cx: number, cy: number, pop: boolean): void {
  const text = String(Math.max(0, Math.round(value)));
  const glyphs: Sprite[] = [];
  for (const glyph of text) {
    const picture = pop ? fontPop[glyph] : font[glyph];
    if (picture) glyphs.push(picture);
  }
  if (glyphs.length === 0) return;
  const gap = 1;
  const width = glyphs.reduce((sum, picture) => sum + picture.w, 0) + gap * (glyphs.length - 1);
  let x = cx - Math.floor(width / 2);
  const y = cy - Math.floor((glyphs[0]?.h ?? 0) / 2);
  for (const picture of glyphs) {
    blit(ctx, picture, x, y, PLAIN);
    x += picture.w + gap;
  }
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState, inset: number): void {
  const top = 4 + inset;
  for (let i = 0; i < PLAYER_HP; i++) {
    const blink = state.invuln > 0 && i === state.hp - 1 && Math.floor(state.anim * 8) % 2 === 0;
    const filled = i < state.hp && !blink;
    const pip = filled ? pawOn : pawOff;
    blit(ctx, pip, 4 + i * (pip.w + 2), top, PLAIN);
  }

  const barX = 4;
  const barY = top + pawOn.h + 4;
  const barW = 104;
  const barH = 6;
  fillAt(ctx, barX, barY, barW, 1, OUTLINE);
  fillAt(ctx, barX, barY + barH - 1, barW, 1, OUTLINE);
  fillAt(ctx, barX, barY, 1, barH, OUTLINE);
  fillAt(ctx, barX + barW - 1, barY, 1, barH, OUTLINE);
  fillAt(ctx, barX + 1, barY + 1, barW - 2, barH - 2, 19);
  const remain = state.phase === "win" ? 1 : Math.max(0, 1 - state.time / RUN_LENGTH);
  const fillW = Math.max(0, Math.min(barW - 2, Math.round((barW - 2) * remain)));
  const bossTime = state.phase === "play" && state.time >= WAVE_BOSS_AT;
  if (fillW > 0) fillAt(ctx, barX + 1, barY + 1, fillW, barH - 2, bossTime ? 16 : 13);

  const width = viewWidth();
  const badge = glove;
  blit(ctx, badge, width - badge.w - 6, top, PLAIN);
  if (state.wins > 0) {
    const frame = Math.floor(state.anim * 8) % 2;
    const bits = [
      { x: width - 8, y: top - 2, s: 2 as const },
      { x: width - badge.w - 8, y: top + 2, s: 1 as const },
      { x: width - 10, y: top + badge.h - 2, s: 2 as const },
    ];
    bits.forEach((bit, index) => {
      fillAt(ctx, bit.x, bit.y, bit.s, bit.s, sparkGolds[(index + frame) % sparkGolds.length] ?? 14);
    });
  }

  if (state.combo >= 1 && state.phase === "play") {
    drawDigits(ctx, state.combo, Math.floor(viewWidth() / 2), top + pawOn.h + 18, state.beatT > 0.5);
  }
}

function drawWin(ctx: CanvasRenderingContext2D, state: GameState): void {
  const bob = Math.floor(state.gloveT * 4) % 2 === 0 ? 0 : -2;
  const cx = Math.floor(viewWidth() / 2);
  const cy = spanY(168) + bob;
  const frame = Math.floor(state.anim * 8) % 2 === 1 ? 1 : 0;
  const bits: readonly { x: number; y: number; s: 1 | 2 | 3 }[] = [
    { x: 0, y: -26, s: 2 },
    { x: 20, y: -16, s: 2 },
    { x: 26, y: 2, s: 3 },
    { x: 16, y: 20, s: 2 },
    { x: 0, y: 26, s: 2 },
    { x: -18, y: 18, s: 2 },
    { x: -26, y: 0, s: 3 },
    { x: -18, y: -16, s: 2 },
  ];
  bits.forEach((bit, index) => {
    fillAt(ctx, cx + bit.x, cy + bit.y, bit.s, bit.s, sparkGolds[(index + frame) % sparkGolds.length] ?? 13);
  });
  blit(ctx, gloveWin, cx - Math.floor(gloveWin.w / 2), cy - Math.floor(gloveWin.h / 2), {
    flash: false,
    telegraph: false,
    gold: frame,
  });
}

function drawFrame(ctx: CanvasRenderingContext2D, index: number): void {
  const width = viewWidth();
  const height = viewHeight();
  fillAt(ctx, 0, 0, width, 2, index);
  fillAt(ctx, 0, height - 2, width, 2, index);
  fillAt(ctx, 0, 0, 2, height, index);
  fillAt(ctx, width - 2, 0, 2, height, index);
}

export function drawGame(ctx: CanvasRenderingContext2D, state: GameState, insetTop: number): void {
  ctx.imageSmoothingEnabled = false;
  const shake = shakeOf(state);
  drawBackground(ctx, state.anim);

  const grounded = state.enemies.filter((enemy) => enemy.phase !== "blown");
  const flying = state.enemies.filter((enemy) => enemy.phase === "blown");
  for (const enemy of grounded) drawEnemy(ctx, enemy, state, shake);
  drawShiba(ctx, state, shake);
  for (const enemy of flying) drawEnemy(ctx, enemy, state, shake);

  state.sparks.forEach((spark, index) => {
    const size: 1 | 2 | 3 = spark.size >= 3 ? 3 : spark.size === 2 ? 2 : 1;
    const color = sparkGolds[(index + Math.floor(state.anim * 8)) % sparkGolds.length] ?? 13;
    fillAt(ctx, viewX(spark.x) + shake.x, viewY(spark.y) + shake.y, size, size, color);
  });

  if (state.enemies.some((enemy) => enemy.phase === "blown" && enemy.chainArmed)) {
    for (let i = 0; i < 6; i++) {
      const x = i % 2 === 0 ? 6 : viewWidth() - dash.w - 6;
      blit(ctx, dash, x, spanY(210 + i * 16), PLAIN);
    }
  }

  if (state.intro) {
    const hint = finger[Math.floor(state.anim * 4) % 2] ?? finger[0];
    if (hint) blit(ctx, hint, spanX(148) + shake.x, spanY(312) + shake.y, PLAIN);
  }

  for (const floater of state.floaters) {
    const pop = floater.life > floater.maxLife - 0.12;
    drawDigits(ctx, floater.value, viewX(floater.x) + shake.x, viewY(floater.y) + shake.y, pop);
  }

  if (state.flashT > 0) drawFrame(ctx, WHITE);
  if (state.hurtT > 0) drawFrame(ctx, Math.floor(state.anim * 12) % 2 === 0 ? DANGER : 15);

  drawHud(ctx, state, Math.max(0, Math.round(insetTop)));
  if (state.phase === "win") drawWin(ctx, state);
}
