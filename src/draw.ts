import {
  FIELD_H,
  FIELD_W,
  LANE_Y,
  PLAYER_HP,
  RUN_LENGTH,
  SHIBA_X,
  SUPER_HOLD,
  WAVE_BOSS_AT,
  type Enemy,
  type EnemyKind,
  type GameState,
  type Side,
} from "./game";

export interface Layout {
  scale: number;
  x: number;
  y: number;
}

export function layoutPlayfield(cssW: number, cssH: number): Layout {
  const scale = Math.min(cssW / FIELD_W, cssH / FIELD_H);
  return {
    scale,
    x: (cssW - FIELD_W * scale) / 2,
    y: (cssH - FIELD_H * scale) / 2,
  };
}

const STARS: readonly { x: number; y: number; s: number }[] = [
  { x: 28, y: 48, s: 4 },
  { x: 150, y: 70, s: 2 },
  { x: 210, y: 36, s: 4 },
  { x: 250, y: 96, s: 2 },
  { x: 320, y: 52, s: 4 },
  { x: 356, y: 120, s: 2 },
  { x: 96, y: 160, s: 2 },
  { x: 180, y: 140, s: 2 },
  { x: 40, y: 210, s: 2 },
  { x: 300, y: 180, s: 2 },
];

interface CatLook {
  palette: Record<string, string>;
  pixel: number;
}

function catLook(kind: EnemyKind): CatLook {
  switch (kind) {
    case "small":
      return {
        pixel: 4,
        palette: {
          K: "#1c130f",
          G: "#8d94a3",
          D: "#555c6b",
          L: "#e7e9f0",
          E: "#67c85a",
          A: "#f3a8b8",
          W: "#fff7ea",
        },
      };
    case "large":
      return {
        pixel: 5,
        palette: {
          K: "#1c130f",
          G: "#4a4460",
          D: "#2c2740",
          L: "#d9d3c4",
          E: "#ffd24a",
          A: "#ff6a4a",
          W: "#fff7ea",
        },
      };
    case "boss":
      return {
        pixel: 6,
        palette: {
          K: "#1c130f",
          G: "#2a2a32",
          D: "#14141a",
          L: "#f6f1e6",
          E: "#ffbf1a",
          A: "#ff3b30",
          W: "#fff7ea",
        },
      };
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

const SHIBA_PALETTE: Record<string, string> = {
  K: "#1c130f",
  O: "#ef7a2f",
  D: "#c45116",
  C: "#f6d7a4",
  W: "#fff7ea",
  P: "#f2a394",
  B: "#1c130f",
};

const SHIBA_ROWS = [
  "........KKK....KKK........",
  ".......KOOOK..KOOOK.......",
  ".......KOPOK..KOPOK.......",
  "......KOOOOOOOOOOOOK......",
  ".....KOOOOCCCCCCCCOOK.....",
  "....KOOOOOCCCCCCCCOOOK....",
  "....KOOOCWWCCWWCCCCCOOK...",
  "....KOOOCWWCCWWCCCCCOOK...",
  "....KOOOWBBWWBBWCCCCCOK...",
  "....KOOOCCCCCCCCCCCCCOK...",
  "....KOOOCWWWCCCCCCCCCOK...",
  ".....KOOCWWWCCCCCCCCOK....",
  ".....KKOCCCCCCCCCCCCOKK...",
  "......KOOCCCCCCCCCCOOK....",
  "......KDOOOOOOOOOOOODK....",
  ".......KKDOOOOOOOODKK.....",
  ".........KOOOOOOOOOK......",
  "........KOOK....KOOK......",
  "........KDDK....KDDK......",
  ".........KK......KK.......",
];

const CAT_ROWS = [
  "............KK............",
  "...........KGGK...........",
  "..........KGGGGK..........",
  ".........KKGGGGKK.........",
  "........KGGGGGGGGK........",
  ".......KGGEEGGGGGGK.......",
  ".......KGGGGGGGGGGGK......",
  "........KGGGGGGGGGGGK.....",
  "....KKK..KKGGGGGKKKGK.....",
  "...KGGGK...KKKKK.KGGK.....",
  "...KGGGK.........KKKK.....",
  "....KKKK..................",
  "...KLLK...................",
  "...KKKK...................",
];

const GLOVE_ROWS = [
  ".KKKKK.",
  "KWHHHRK",
  "KRRRRRK",
  "KRRRRRK",
  "KRDDDRK",
  "KRDDDRK",
  ".KUUUUK",
  "..KKKK.",
];

const GLOVE_PALETTE: Record<string, string> = {
  K: "#1c130f",
  R: "#e23434",
  D: "#a42024",
  H: "#ffd0cc",
  W: "#fff7ea",
  U: "#f4f0e8",
};

function stamp(
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  x: number,
  y: number,
  pixel: number,
  palette: Record<string, string>,
  flipX = false,
): void {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const height = rows.length;
  const left = Math.round(x - (width * pixel) / 2);
  const top = Math.round(y - (height * pixel) / 2);
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex] ?? "";
    for (let col = 0; col < width; col++) {
      const sourceCol = flipX ? width - 1 - col : col;
      const color = palette[row[sourceCol] ?? ""];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(left + col * pixel, top + rowIndex * pixel, pixel, pixel);
    }
  }
}

let scratch: HTMLCanvasElement | null = null;

function scratchContext(width: number, height: number): CanvasRenderingContext2D {
  if (!scratch) scratch = document.createElement("canvas");
  if (scratch.width !== width || scratch.height !== height) {
    scratch.width = width;
    scratch.height = height;
  }
  const context = scratch.getContext("2d");
  if (!context) throw new Error("scratch canvas unsupported");
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, width, height);
  return context;
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function pixelCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  pixel = 4,
): void {
  ctx.fillStyle = color;
  for (let y = -radius; y <= radius; y += pixel) {
    for (let x = -radius; x <= radius; x += pixel) {
      if (x * x + y * y <= radius * radius) ctx.fillRect(cx + x, cy + y, pixel, pixel);
    }
  }
}

const GLYPHS: Record<string, readonly string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
};

function drawGlyphs(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  scale: number,
  color: string,
): void {
  let cursor = x;
  for (const char of text) {
    const rows = GLYPHS[char];
    if (!rows) continue;
    rows.forEach((row, rowIndex) => {
      for (let col = 0; col < row.length; col++) {
        if (row[col] === "1") px(ctx, cursor + col * scale, y + rowIndex * scale, scale, scale, color);
      }
    });
    cursor += 4 * scale;
  }
}

function drawNumber(
  ctx: CanvasRenderingContext2D,
  value: number,
  x: number,
  y: number,
  scale: number,
  color: string,
): void {
  const text = String(Math.max(0, Math.round(value)));
  const width = text.length * 4 * scale;
  const left = x - width / 2;
  for (const [ox, oy] of [
    [scale, 0],
    [-scale, 0],
    [0, scale],
    [0, -scale],
  ] as const) {
    drawGlyphs(ctx, text, left + ox, y + oy, scale, "#3a2208");
  }
  drawGlyphs(ctx, text, left, y, scale, color);
}

function drawBackground(ctx: CanvasRenderingContext2D, anim: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, 640);
  sky.addColorStop(0, "#14102c");
  sky.addColorStop(0.45, "#3b2464");
  sky.addColorStop(1, "#6d3d58");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, FIELD_W, 620);

  pixelCircle(ctx, 86, 128, 36, "#ffe6b2");
  pixelCircle(ctx, 70, 118, 30, "#1a1434");

  for (const star of STARS) {
    const twinkle = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(anim * 2 + star.x));
    ctx.globalAlpha = twinkle;
    px(ctx, star.x, star.y, star.s, star.s, "#fff4cc");
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#5a3b2c";
  for (let x = 16; x < FIELD_W; x += 36) {
    px(ctx, x, 430, 8, 46, "#5a3b2c");
    px(ctx, x - 6, 426, 20, 8, "#6d4a36");
  }
  px(ctx, 8, 452, FIELD_W - 16, 6, "#6d4a36");

  ctx.fillStyle = "#2a4a34";
  ctx.fillRect(0, 600, FIELD_W, FIELD_H - 600);
  for (let y = 612; y < FIELD_H; y += 16) {
    ctx.fillStyle = y % 32 === 0 ? "#24523a" : "#1e422e";
    ctx.fillRect(0, y, FIELD_W, 8);
  }
  ctx.fillStyle = "#6a4632";
  pixelCircle(ctx, SHIBA_X, 628, 120, "#6a4632", 8);
  pixelCircle(ctx, SHIBA_X, 628, 78, "#7c5340", 8);

  for (let i = 0; i < 5; i++) {
    const fx = 40 + ((i * 73 + Math.floor(anim * 18 + i * 20)) % 320);
    const fy = 560 + ((i * 41) % 50);
    const alpha = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(anim * 3 + i));
    ctx.globalAlpha = alpha;
    px(ctx, fx, fy, 4, 4, "#ffe28a");
  }
  ctx.globalAlpha = 1;
}

function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, lift: number): void {
  const alpha = Math.max(0, 0.32 - lift / 360);
  if (alpha <= 0.02) return;
  ctx.fillStyle = `rgba(12, 8, 16, ${alpha})`;
  const rx = Math.max(8, radius * 0.7 - lift * 0.05);
  pixelCircle(ctx, x, y, rx, ctx.fillStyle, 4);
}

function paintGlove(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
  stamp(ctx, GLOVE_ROWS, x, y, Math.max(3, Math.round(4 * scale)), GLOVE_PALETTE);
}

function drawShiba(ctx: CanvasRenderingContext2D, state: GameState): void {
  const punching = state.punchT > 0 && state.punchSide !== null;
  const extend = punching ? Math.sin((1 - state.punchT / state.punchDur) * Math.PI) : 0;
  const dir: number = state.punchSide === "left" ? -1 : 1;
  const reach = state.punchKind === "super" ? 112 : 74;
  const bob = state.phase === "win" ? -8 + Math.round(Math.sin(state.anim * 8) * 4) : Math.round(Math.sin(state.anim * 2.2) * 2);
  const lean = punching ? dir * 6 * extend : 0;
  const x = SHIBA_X + lean;
  const y = LANE_Y + bob;
  const hurt = state.hurtT > 0 && Math.floor(state.anim * 24) % 2 === 0;

  drawShadow(ctx, SHIBA_X, 640, 36, Math.max(0, LANE_Y - y));
  const palette = hurt ? { ...SHIBA_PALETTE, O: "#fff4ea", D: "#f6d7a4", C: "#fff7ea" } : SHIBA_PALETTE;
  stamp(ctx, SHIBA_ROWS, x, y - 8, 4, palette);
  const tail = Math.round(Math.sin(state.anim * 2.4) * 4);
  stamp(
    ctx,
    ["KKK", "ODO", "KWK"],
    x + 46,
    y - 18 + tail,
    4,
    { K: "#1c130f", O: "#ef7a2f", D: "#c45116", W: "#fff7ea" },
  );

  const gloveY = y + 16;
  const idleLeft = x - 46;
  const idleRight = x + 46;
  const punchX = x + dir * (46 + extend * reach);
  const leftX = punching && state.punchSide === "left" ? punchX : idleLeft;
  const rightX = punching && state.punchSide === "right" ? punchX : idleRight;
  const gloveScale = punching && state.punchKind === "super" ? 1.15 : 1;
  if (extend > 0.55 && state.punchSide) {
    ctx.fillStyle = "rgba(255, 244, 220, 0.8)";
    for (let i = 0; i < 4; i++) {
      const mx = x + dir * (30 + i * 16);
      px(ctx, mx, gloveY - 16 + i * 6, 12, 4, "rgba(255,244,220,0.9)");
    }
  }
  paintGlove(ctx, leftX, gloveY, state.punchSide === "left" ? gloveScale : 1);
  paintGlove(ctx, rightX, gloveY, state.punchSide === "right" ? gloveScale : 1);

  drawCharge(ctx, state, "left", leftX, gloveY);
  drawCharge(ctx, state, "right", rightX, gloveY);
}

function drawCharge(ctx: CanvasRenderingContext2D, state: GameState, side: Side, x: number, y: number): void {
  const charge = side === "left" ? state.chargeLeft : state.chargeRight;
  const latched = side === "left" ? state.latchLeft : state.latchRight;
  if (charge <= 0 || latched) return;
  const t = Math.min(1, charge / SUPER_HOLD);
  const dir: number = side === "left" ? -1 : 1;
  const count = Math.max(1, Math.round(t * 7));
  for (let i = 0; i < count; i++) {
    const alpha = 0.35 + 0.65 * (i / 7);
    ctx.globalAlpha = alpha;
    px(ctx, x + dir * (18 + i * 8), y - 18 + (i % 2) * 6, 6, 6, i === count - 1 ? "#fff1a8" : "#ffd15a");
  }
  ctx.globalAlpha = 1;
}

function paintCat(ctx: CanvasRenderingContext2D, enemy: Enemy, anim: number): void {
  const look = catLook(enemy.kind);
  const bob = enemy.phase === "approach" ? Math.round(Math.sin(anim * 14 + enemy.id) * 2) : 0;
  stamp(ctx, CAT_ROWS, 0, bob, look.pixel, look.palette);
  if (enemy.kind === "large") {
    px(ctx, 8, -4 + bob, look.pixel * 3, look.pixel, look.palette.D ?? "#2c2740");
  }
  if (enemy.kind === "boss") {
    px(ctx, -8, 6 + bob, look.pixel * 5, look.pixel, look.palette.A ?? "#ff3b30");
    px(ctx, 4, 10 + bob, look.pixel * 2, look.pixel * 2, look.palette.A ?? "#ff3b30");
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, state: GameState): void {
  const look = catLook(enemy.kind);
  const lift = Math.max(0, LANE_Y - enemy.y);
  const shadowRadius = 16 + look.pixel * 2;
  if (enemy.phase !== "blown") drawShadow(ctx, enemy.x, 648, shadowRadius, 0);
  else drawShadow(ctx, enemy.x, 648, shadowRadius, lift);

  const blink = enemy.phase === "telegraph" && Math.floor(state.anim * 16) % 2 === 0;
  const tint = blink || enemy.flash > 0 ? "rgba(255,246,246,0.84)" : null;
  const size = Math.ceil(28 * look.pixel + 24);
  const local = scratchContext(size, size);
  local.save();
  local.translate(size / 2, size / 2);
  local.scale(enemy.side === "right" ? -1 : 1, 1);
  paintCat(local, enemy, state.anim);
  local.restore();
  if (tint) {
    local.globalCompositeOperation = "source-atop";
    local.fillStyle = tint;
    local.fillRect(0, 0, size, size);
    local.globalCompositeOperation = "source-over";
  }

  ctx.save();
  ctx.translate(Math.round(enemy.x), Math.round(enemy.y));
  if (enemy.phase === "blown") {
    const step = Math.PI / 8;
    ctx.rotate(Math.round(enemy.spin / step) * step);
  } else if (enemy.phase === "telegraph") {
    ctx.translate((Math.floor(state.anim * 30) % 2) * 2 - 1, 0);
  }
  ctx.drawImage(scratch ?? local.canvas, -size / 2, -size / 2);
  ctx.restore();
}

function drawFinger(ctx: CanvasRenderingContext2D, anim: number): void {
  const pulse = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(anim * 6));
  const x = 318;
  const y = 700 + Math.round(Math.sin(anim * 5) * 6);
  ctx.fillStyle = `rgba(255, 214, 90, ${pulse})`;
  pixelCircle(ctx, x, y - 8, 34, ctx.fillStyle, 4);
  const rows = [
    "00110",
    "00110",
    "00110",
    "00110",
    "11110",
    "11111",
    "11111",
    "01111",
    "00110",
  ];
  rows.forEach((row, rowIndex) => {
    for (let col = 0; col < row.length; col++) {
      if (row[col] === "1") px(ctx, x - 16 + col * 8, y - 28 + rowIndex * 8, 8, 8, "#fff7ea");
    }
  });
  px(ctx, x - 18, y - 30, 44, 4, "#1c130f");
}

function drawPaw(ctx: CanvasRenderingContext2D, x: number, y: number, filled: boolean): void {
  const fur = filled ? "#ffe0c8" : "#3a3140";
  const pad = filled ? "#ff7d88" : "#2a2230";
  px(ctx, x, y, 6, 6, fur);
  px(ctx, x + 8, y - 2, 6, 6, fur);
  px(ctx, x + 16, y, 6, 6, fur);
  px(ctx, x + 3, y + 8, 16, 12, fur);
  px(ctx, x + 7, y + 12, 8, 6, pad);
}

function drawHudGlove(ctx: CanvasRenderingContext2D, x: number, y: number, wins: number, anim: number): void {
  paintGlove(ctx, x, y, 0.85);
  if (wins > 0) {
    const spark = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(anim * 6));
    ctx.globalAlpha = spark;
    px(ctx, x + 12, y - 16, 4, 4, "#fff1a8");
    px(ctx, x + 16, y - 12, 4, 4, "#ffd15a");
    ctx.globalAlpha = 1;
  }
}

function drawUi(ctx: CanvasRenderingContext2D, state: GameState, insetTop: number): void {
  const top = 24 + insetTop;
  for (let i = 0; i < PLAYER_HP; i++) {
    const flicker = state.invuln > 0 && i === state.hp && Math.floor(state.anim * 18) % 2 === 0;
    drawPaw(ctx, 18 + i * 28, top, i < state.hp && !flicker);
  }

  const barX = 18;
  const barY = top + 32;
  const barW = 230;
  px(ctx, barX, barY, barW, 8, "#2a2034");
  const remain = state.phase === "win" ? 1 : Math.max(0, 1 - state.time / RUN_LENGTH);
  const fill = Math.max(0, Math.round(barW * remain));
  const color = state.time >= WAVE_BOSS_AT ? "#ff5a3c" : "#ffd15a";
  if (fill > 0) px(ctx, barX, barY, fill, 8, color);

  drawHudGlove(ctx, FIELD_W - 42, top + 16, state.wins, state.anim);

  if (state.combo >= 1 && state.phase === "play") {
    const scale = 6 + state.beatT * 5 + Math.min(3, state.combo / 15);
    const color = state.combo >= 30 ? "#fff1a8" : state.combo >= 10 ? "#ffd15a" : "#fff7ea";
    drawNumber(ctx, state.combo, SHIBA_X, top + 52, scale, color);
  }

  if (state.phase === "win") {
    ctx.fillStyle = "rgba(16, 10, 24, 0.35)";
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    const bounce = Math.abs(Math.sin(state.gloveT * 5));
    const gy = 390 - bounce * 24;
    ctx.save();
    ctx.translate(SHIBA_X, gy);
    ctx.scale(2.4, 2.4);
    paintGlove(ctx, 0, 0, 1);
    ctx.restore();
    for (let i = 0; i < 8; i++) {
      const angle = state.gloveT * 2 + (i * Math.PI) / 4;
      const radius = 70 + (i % 2) * 16;
      px(ctx, SHIBA_X + Math.cos(angle) * radius, gy + Math.sin(angle) * radius * 0.6, 6, 6, "#ffd15a");
    }
  }
}

function drawSpeedLines(ctx: CanvasRenderingContext2D, state: GameState): void {
  const flying = state.enemies.some((enemy) => enemy.phase === "blown" && enemy.chainArmed);
  if (!flying) return;
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 7; i++) {
    const y = 430 + i * 22;
    const width = 36 + (i % 3) * 28;
    const side = i % 2 === 0 ? 0 : FIELD_W - width;
    px(ctx, side, y, width, 4, "#fff6ea");
  }
  ctx.globalAlpha = 1;
}

export function drawGame(ctx: CanvasRenderingContext2D, state: GameState, insetTop: number): void {
  ctx.clearRect(-8, -8, FIELD_W + 16, FIELD_H + 16);
  drawBackground(ctx, state.anim);

  const mag = state.shake;
  const sx = mag > 0 ? Math.round(Math.sin(state.anim * 90) * mag) : 0;
  const sy = mag > 0 ? Math.round(Math.cos(state.anim * 70) * mag * 0.6) : 0;
  ctx.save();
  ctx.translate(sx, sy);

  if (state.intro) {
    const alpha = 0.05 + 0.05 * (0.5 + 0.5 * Math.sin(state.anim * 5));
    const wash = ctx.createLinearGradient(SHIBA_X, 0, FIELD_W, 0);
    wash.addColorStop(0, "rgba(255, 209, 90, 0)");
    wash.addColorStop(1, `rgba(255, 209, 90, ${alpha})`);
    ctx.fillStyle = wash;
    ctx.fillRect(SHIBA_X, 0, FIELD_W - SHIBA_X, FIELD_H);
  }

  const grounded = state.enemies.filter((enemy) => enemy.phase !== "blown");
  const flying = state.enemies.filter((enemy) => enemy.phase === "blown");
  for (const enemy of grounded) drawEnemy(ctx, enemy, state);
  drawShiba(ctx, state);
  for (const enemy of flying) drawEnemy(ctx, enemy, state);

  for (const spark of state.sparks) {
    ctx.globalAlpha = Math.max(0, spark.life / spark.max);
    px(ctx, spark.x, spark.y, spark.size, spark.size, spark.color);
  }
  ctx.globalAlpha = 1;

  drawSpeedLines(ctx, state);
  if (state.intro) drawFinger(ctx, state.anim);

  for (const floater of state.floaters) {
    const alpha = Math.max(0, floater.life / floater.maxLife);
    ctx.globalAlpha = alpha;
    const scale = floater.value >= 40 ? 5 : 4;
    drawNumber(ctx, floater.value, floater.x, floater.y, scale, "#ffd15a");
  }
  ctx.globalAlpha = 1;

  if (state.flashT > 0) {
    ctx.fillStyle = `rgba(255, 248, 230, ${state.flashT * 5})`;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  }
  if (state.hurtT > 0) {
    ctx.fillStyle = `rgba(180, 24, 40, ${state.hurtT * 1.4})`;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  }
  ctx.restore();

  drawUi(ctx, state, insetTop);
}
