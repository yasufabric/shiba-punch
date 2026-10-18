export const FIELD_W = 390;
export const FIELD_H = 844;
export const SHIBA_X = 195;
export const LANE_Y = 512;
export const SHIBA_Y = LANE_Y;
export const GAUGE_MAX = 6;
export const AIM_CONE = Math.PI / 5;
export const SPECIAL_REACH = 320;
export const PLAYER_HP = 5;
export const RUN_LENGTH = 180;
export const WAVE_MIXED_AT = 60;
export const WAVE_BOSS_AT = 150;
export const SUPER_HOLD = 1;
export const HIT_STOP = 0.05;
export const COMBO_WINDOW = 2.4;
export const PUNCH_REACH = 236;
export const BURST_COUNT = 5;
export const BURST_SPACING = 50;
export const BURST_EVERY = 2.55;
export const NORMAL_BASE = 10;
export const SUPER_BASE = 40;
export const CHAIN_BASE = 12;
export const CHAIN_PADDING = 16;

export const STORAGE_KEY = "shiba-punch";

export type Side = "left" | "right";
export type EnemyKind = "small" | "large" | "boss";
export type Behavior = "plain" | "fast" | "feint" | "shield" | "throw" | "boss";
export type EnemyPhase = "approach" | "telegraph" | "recover" | "blown" | "dead";
export type Wave = "small" | "mixed" | "boss" | "done";
export type PunchKind = "normal" | "super";
export type HitSource = "normal" | "super" | "chain" | "super-chain" | "blast";

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Progress {
  seenIntro: boolean;
  bestCombo: number;
  bestDamage: number;
  wins: number;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  side: Side;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  phase: EnemyPhase;
  telegraph: number;
  recover: number;
  vx: number;
  vy: number;
  spin: number;
  spinSpeed: number;
  radius: number;
  attackRange: number;
  speed: number;
  behavior: Behavior;
  feint: number;
  feinted: boolean;
  thrown: boolean;
  chainArmed: boolean;
  hitIds: number[];
  flash: number;
  blowDelay: number;
  intro: boolean;
}

export interface Floater {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  value: number;
}

export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

export type GameEvent =
  | { type: "punch"; kind: PunchKind; connected: boolean; beat: boolean }
  | { type: "clink" }
  | { type: "hurt" }
  | { type: "win" };

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface FrameInput {
  left: boolean;
  right: boolean;
  tap: boolean;
  /** Radians, 0 = east, positive = downward. Held while the finger is down. */
  aim?: number | null;
  special?: boolean;
}

export interface GameState {
  time: number;
  anim: number;
  hp: number;
  combo: number;
  comboTimer: number;
  bestCombo: number;
  bestDamage: number;
  wins: number;
  seenIntro: boolean;
  intro: boolean;
  phase: "play" | "win";
  enemies: Enemy[];
  floaters: Floater[];
  sparks: Spark[];
  events: GameEvent[];
  hitStop: number;
  shake: number;
  hurtT: number;
  flashT: number;
  beatT: number;
  invuln: number;
  punchSide: Side | null;
  punchAim: number;
  punchKind: PunchKind;
  punchT: number;
  punchDur: number;
  gauge: number;
  blastT: number;
  aim: number | null;
  charge: number;
  held: boolean;
  latch: boolean;
  shots: Shot[];
  chargeLeft: number;
  chargeRight: number;
  heldLeft: boolean;
  heldRight: boolean;
  latchLeft: boolean;
  latchRight: boolean;
  spawnTimer: number;
  burstIndex: number;
  bossSpawned: boolean;
  gloveT: number;
  nextId: number;
  storage: Storage;
}

export function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

export function comboMultiplier(combo: number): number {
  if (combo < 10) return 1;
  if (combo >= 30) return 5;
  const t = (combo - 10) / 20;
  return 2 + t * 3;
}

export function punchDamage(kind: "normal" | "super" | "chain", combo: number): number {
  const base = kind === "super" ? SUPER_BASE : kind === "chain" ? CHAIN_BASE : NORMAL_BASE;
  return Math.round(base * comboMultiplier(combo));
}

export function waveAt(time: number): Wave {
  if (time < WAVE_MIXED_AT) return "small";
  if (time < WAVE_BOSS_AT) return "mixed";
  if (time < RUN_LENGTH) return "boss";
  return "done";
}

function finiteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function loadProgress(storage: Storage): Progress {
  const empty: Progress = { seenIntro: false, bestCombo: 0, bestDamage: 0, wins: 0 };
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return empty;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return empty;
    const record = parsed as Partial<Progress>;
    return {
      seenIntro: record.seenIntro === true,
      bestCombo: finiteNumber(record.bestCombo),
      bestDamage: finiteNumber(record.bestDamage),
      wins: Math.floor(finiteNumber(record.wins)),
    };
  } catch {
    return empty;
  }
}

function persist(state: GameState): void {
  const progress: Progress = {
    seenIntro: state.seenIntro,
    bestCombo: state.bestCombo,
    bestDamage: state.bestDamage,
    wins: state.wins,
  };
  state.storage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

interface KindStats {
  hp: number;
  speed: number;
  radius: number;
  attackRange: number;
  telegraph: number;
}

function kindStats(kind: EnemyKind): KindStats {
  switch (kind) {
    case "small":
      return { hp: NORMAL_BASE, speed: 92, radius: 24, attackRange: 78, telegraph: 0.58 };
    case "large":
      return { hp: SUPER_BASE, speed: 54, radius: 36, attackRange: 90, telegraph: 0.72 };
    case "boss":
      return { hp: 260, speed: 48, radius: 54, attackRange: 100, telegraph: 0.46 };
    default:
      return assertNever(kind);
  }
}

function blankState(storage: Storage, progress: Progress): GameState {
  return {
    time: 0,
    anim: 0,
    hp: PLAYER_HP,
    combo: 0,
    comboTimer: 0,
    bestCombo: progress.bestCombo,
    bestDamage: progress.bestDamage,
    wins: progress.wins,
    seenIntro: progress.seenIntro,
    intro: !progress.seenIntro,
    phase: "play",
    enemies: [],
    floaters: [],
    sparks: [],
    events: [],
    hitStop: 0,
    shake: 0,
    hurtT: 0,
    flashT: 0,
    beatT: 0,
    invuln: 0,
    punchSide: null,
    punchAim: 0,
    punchKind: "normal",
    punchT: 0,
    punchDur: 0.16,
    gauge: 0,
    blastT: 0,
    aim: null,
    charge: 0,
    held: false,
    latch: false,
    shots: [],
    chargeLeft: 0,
    chargeRight: 0,
    heldLeft: false,
    heldRight: false,
    latchLeft: false,
    latchRight: false,
    spawnTimer: 0.42,
    burstIndex: 0,
    bossSpawned: false,
    gloveT: 0,
    nextId: 1,
    storage,
  };
}

export interface SpawnSpec {
  kind: EnemyKind;
  side: Side;
  x: number;
  y?: number;
  hp?: number;
  speed?: number;
  attackRange?: number;
  phase?: EnemyPhase;
  intro?: boolean;
  behavior?: Behavior;
}

export function spawnEnemy(state: GameState, spec: SpawnSpec): Enemy {
  const stats = kindStats(spec.kind);
  const enemy: Enemy = {
    id: state.nextId++,
    kind: spec.kind,
    side: spec.side,
    x: spec.x,
    y: spec.y ?? LANE_Y,
    hp: spec.hp ?? stats.hp,
    maxHp: spec.hp ?? stats.hp,
    phase: spec.phase ?? "approach",
    telegraph: 0,
    recover: 0,
    vx: 0,
    vy: 0,
    spin: 0,
    spinSpeed: 0,
    radius: stats.radius,
    attackRange: spec.attackRange ?? stats.attackRange,
    speed: spec.speed ?? (spec.behavior === "fast" ? 156 : stats.speed),
    behavior: spec.behavior ?? "plain",
    feint: 0,
    feinted: false,
    thrown: false,
    chainArmed: false,
    hitIds: [],
    flash: 0,
    blowDelay: 0,
    intro: spec.intro === true,
  };
  state.enemies.push(enemy);
  return enemy;
}

export function createGame(storage: Storage): GameState {
  const progress = loadProgress(storage);
  const state = blankState(storage, progress);
  if (state.intro) {
    spawnEnemy(state, {
      kind: "small",
      side: "right",
      x: SHIBA_X + 124,
      speed: 36,
      intro: true,
    });
  }
  return state;
}

function resetRun(state: GameState): void {
  const fresh = createGame(state.storage);
  const storage = state.storage;
  Object.assign(state, fresh);
  state.storage = storage;
}

function away(enemy: Enemy): { x: number; y: number } {
  const dx = enemy.x - SHIBA_X;
  const dy = enemy.y - SHIBA_Y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function blow(enemy: Enemy, mode: "pop" | "sweep", delay: number): void {
  const out = away(enemy);
  const dir = out.x < 0 ? -1 : 1;
  enemy.phase = "blown";
  enemy.hp = Math.min(enemy.hp, 0);
  enemy.blowDelay = delay;
  enemy.spin = dir * (0.4 + (enemy.id % 5) * 0.35);
  if (mode === "sweep") {
    const dist = Math.hypot(enemy.x - SHIBA_X, enemy.y - SHIBA_Y);
    enemy.chainArmed = true;
    const speed = 120 + Math.max(0, 70 - dist) * 0.25;
    enemy.vx = out.x * speed;
    enemy.vy = out.y * speed - 80;
    enemy.spinSpeed = dir * 18;
  } else {
    enemy.chainArmed = false;
    enemy.vx = out.x * 70;
    enemy.vy = out.y * 40 - 300;
    enemy.spinSpeed = dir * 13;
  }
}

function spawnFloater(state: GameState, enemy: Enemy, value: number): void {
  const dir: number = enemy.side === "left" ? -1 : 1;
  const edge = dir === 1 ? FIELD_W + 24 : -24;
  state.floaters.push({
    x: enemy.x,
    y: enemy.y - enemy.radius - 18,
    vx: (edge - enemy.x) / 0.8,
    vy: -110 - (enemy.id % 3) * 18,
    life: 0.9,
    maxLife: 0.9,
    value,
  });
  if (state.floaters.length > 28) state.floaters.splice(0, state.floaters.length - 28);
}

function spawnSparks(state: GameState, enemy: Enemy, superHit: boolean): void {
  const count = superHit ? 10 : 6;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = superHit ? 220 : 140;
    state.sparks.push({
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.28,
      max: 0.28,
      color: i % 4 === 0 ? "#7a4a00" : i % 4 === 1 ? "#e0a200" : i % 4 === 2 ? "#ffe066" : "#fffbd1",
      size: (i % 3) + 1,
    });
  }
  if (state.sparks.length > 80) state.sparks.splice(0, state.sparks.length - 80);
}

function noteBest(state: GameState): void {
  let changed = false;
  if (state.combo > state.bestCombo) {
    state.bestCombo = state.combo;
    changed = true;
  }
  if (changed) persist(state);
}

function noteDamage(state: GameState, damage: number): void {
  if (damage > state.bestDamage) {
    state.bestDamage = damage;
    persist(state);
  }
}

function clearIntro(state: GameState): void {
  if (!state.intro) return;
  state.intro = false;
  state.seenIntro = true;
  state.spawnTimer = 0.32;
  persist(state);
}

function beginWin(state: GameState): void {
  if (state.phase === "win") return;
  state.phase = "win";
  state.wins += 1;
  state.gloveT = 0;
  state.events.push({ type: "win" });
  persist(state);
}

function frontalShield(enemy: Enemy): boolean {
  if (enemy.behavior !== "shield") return false;
  return true;
}

function applyHit(state: GameState, enemy: Enemy, source: HitSource): boolean {
  if (enemy.phase === "blown" || enemy.phase === "dead") return false;
  const superHit = source === "super" || source === "super-chain" || source === "blast";
  const blocked =
    frontalShield(enemy) && source !== "blast" && source !== "chain" && source !== "super-chain";
  if (blocked) {
    enemy.flash = 0.09;
    state.events.push({ type: "clink" });
    return false;
  }
  if (enemy.kind === "large" && !superHit) {
    enemy.flash = 0.09;
    state.events.push({ type: "clink" });
    return false;
  }

  state.combo += 1;
  state.comboTimer = COMBO_WINDOW;
  if ((source === "normal" || source === "super") && state.gauge < GAUGE_MAX) state.gauge += 1;
  noteBest(state);
  const damageKind = superHit ? "super" : source === "chain" ? "chain" : "normal";
  const damage = punchDamage(damageKind, state.combo);
  noteDamage(state, damage);
  enemy.hp -= damage;
  enemy.flash = 0.1;
  spawnFloater(state, enemy, damage);
  spawnSparks(state, enemy, superHit);
  if (state.combo % 3 === 0) state.beatT = 1;
  state.hitStop = HIT_STOP;
  state.shake = Math.max(state.shake, source === "super" ? 18 : state.combo % 3 === 0 ? 11 : 7);
  if (source === "super") state.flashT = Math.max(state.flashT, 0.07);
  if (enemy.intro) clearIntro(state);

  if (enemy.hp <= 0) {
    const sweep = source !== "normal";
    const delay = sweep ? Math.min(0.06, Math.abs(enemy.x - SHIBA_X) * 0.00012) : 0;
    blow(enemy, sweep ? "sweep" : "pop", delay);
    if (enemy.kind === "boss") beginWin(state);
  } else if (enemy.kind === "boss" && superHit) {
    enemy.phase = "recover";
    enemy.recover = 0.55;
    const out = away(enemy);
    enemy.x += out.x * 78;
    enemy.y += out.y * 78;
  } else {
    enemy.phase = "recover";
    enemy.recover = 0.2;
    const out = away(enemy);
    enemy.x += out.x * 26;
    enemy.y += out.y * 26;
  }
  return true;
}

export function wrapAngle(angle: number): number {
  const turn = Math.PI * 2;
  let wrapped = angle % turn;
  if (wrapped <= -Math.PI) wrapped += turn;
  if (wrapped > Math.PI) wrapped -= turn;
  return wrapped;
}

export function angleBetween(a: number, b: number): number {
  return Math.abs(wrapAngle(a - b));
}

function heldAngle(input: FrameInput): number | null {
  if (typeof input.aim === "number" && Number.isFinite(input.aim)) return input.aim;
  if (input.right) return 0;
  if (input.left) return Math.PI;
  return null;
}

function inCone(enemy: Enemy, angle: number, reach: number): boolean {
  if (enemy.phase === "blown" || enemy.phase === "dead") return false;
  const dx = enemy.x - SHIBA_X;
  const dy = enemy.y - SHIBA_Y;
  const dist = Math.hypot(dx, dy);
  if (dist > reach || dist < 6) return false;
  return angleBetween(Math.atan2(dy, dx), angle) <= AIM_CONE;
}

function nearestInCone(state: GameState, angle: number): Enemy | null {
  let best: Enemy | null = null;
  let bestDist = PUNCH_REACH;
  for (const enemy of state.enemies) {
    if (!inCone(enemy, angle, PUNCH_REACH)) continue;
    const dist = Math.hypot(enemy.x - SHIBA_X, enemy.y - SHIBA_Y);
    if (dist <= bestDist) {
      best = enemy;
      bestDist = dist;
    }
  }
  return best;
}

function applyPunch(state: GameState, angle: number, kind: PunchKind): void {
  if (state.phase !== "play") return;
  state.punchAim = angle;
  state.punchSide = Math.cos(angle) < 0 ? "left" : "right";
  state.punchKind = kind;
  state.punchDur = kind === "super" ? 0.3 : 0.16;
  state.punchT = state.punchDur;
  const target = nearestInCone(state, angle);
  let connected = false;
  let beat = false;
  if (target && applyHit(state, target, kind)) {
    connected = true;
    if (state.combo > 0 && state.combo % 3 === 0) beat = true;
  }
  state.shots = state.shots.filter((shot) => {
    const dx = shot.x - SHIBA_X;
    const dy = shot.y - SHIBA_Y;
    const dist = Math.hypot(dx, dy);
    if (dist > PUNCH_REACH) return true;
    if (angleBetween(Math.atan2(dy, dx), angle) > AIM_CONE) return true;
    return false;
  });
  if (kind === "super") {
    const chained = resolveChains(state);
    if (chained) connected = true;
  }
  state.events.push({ type: "punch", kind, connected, beat });
}

function applySpecial(state: GameState): void {
  if (state.phase !== "play" || state.gauge < GAUGE_MAX) return;
  state.gauge = 0;
  state.blastT = 0.32;
  state.punchAim = 0;
  state.punchSide = null;
  state.punchKind = "super";
  state.punchDur = 0.3;
  state.punchT = 0.3;
  state.shake = Math.max(state.shake, 18);
  state.flashT = Math.max(state.flashT, 0.08);
  let connected = false;
  for (const enemy of state.enemies) {
    if (Math.hypot(enemy.x - SHIBA_X, enemy.y - SHIBA_Y) > SPECIAL_REACH) continue;
    if (applyHit(state, enemy, "blast")) connected = true;
  }
  const chained = resolveChains(state);
  if (chained) connected = true;
  state.shots = [];
  state.events.push({ type: "punch", kind: "super", connected, beat: connected });
}

function overlaps(a: Enemy, b: Enemy): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const reach = a.radius + b.radius + CHAIN_PADDING;
  return dx * dx + dy * dy <= reach * reach;
}

function resolveChains(state: GameState): boolean {
  let any = false;
  let guard = 0;
  let progressed = true;
  while (progressed && guard < 10) {
    progressed = false;
    guard += 1;
    const flyers = state.enemies.filter((enemy) => enemy.phase === "blown" && enemy.chainArmed);
    for (const flyer of flyers) {
      for (const other of state.enemies) {
        if (other.id === flyer.id) continue;
        if (other.phase === "blown" || other.phase === "dead") continue;
        if (flyer.hitIds.includes(other.id)) continue;
        if (!overlaps(flyer, other)) continue;
        flyer.hitIds.push(other.id);
        const source: HitSource = other.kind === "large" || other.kind === "boss" ? "super-chain" : "chain";
        if (applyHit(state, other, source)) {
          any = true;
          progressed = true;
          if (state.combo > 0 && state.combo % 3 === 0) state.beatT = 1;
        }
      }
    }
  }
  return any;
}

function mirrorCharge(state: GameState): void {
  const charging = state.held && !state.latch;
  const left = charging && state.aim !== null && Math.cos(state.aim) < 0;
  const right = charging && state.aim !== null && Math.cos(state.aim) >= 0;
  state.heldLeft = left;
  state.heldRight = right;
  state.chargeLeft = left ? state.charge : 0;
  state.chargeRight = right ? state.charge : 0;
  state.latchLeft = left && state.latch;
  state.latchRight = right && state.latch;
}

function processAim(state: GameState, input: FrameInput, dt: number): void {
  if (input.special) {
    state.held = false;
    state.charge = 0;
    state.latch = false;
    state.aim = null;
    mirrorCharge(state);
    applySpecial(state);
    return;
  }
  const angle = heldAngle(input);
  const down = angle !== null;
  const was = state.held;
  if (down && angle !== null) {
    if (!was) {
      state.charge = 0;
      state.latch = false;
    }
    state.held = true;
    state.aim = angle;
    if (!state.latch) {
      state.charge += dt;
      if (state.charge >= SUPER_HOLD) {
        state.latch = true;
        applyPunch(state, angle, "super");
      }
    }
  } else if (was && !state.latch) {
    const punchAngle = state.aim ?? 0;
    state.held = false;
    state.charge = 0;
    state.latch = false;
    state.aim = null;
    applyPunch(state, punchAngle, "normal");
  } else {
    state.held = false;
    state.charge = 0;
    state.latch = false;
    state.aim = null;
  }
  mirrorCharge(state);
}

function hurtPlayer(state: GameState): boolean {
  if (state.invuln > 0 || state.phase !== "play") return false;
  state.hp -= 1;
  state.combo = 0;
  state.comboTimer = 0;
  state.shake = Math.max(state.shake, 13);
  state.hitStop = HIT_STOP;
  state.invuln = 0.48;
  if (state.hp <= 0) {
    resetRun(state);
    state.hurtT = 0.3;
    state.events.push({ type: "hurt" });
    return true;
  }
  state.hurtT = 0.22;
  state.events.push({ type: "hurt" });
  return false;
}

function pointOnRay(dir: number, distance: number): { x: number; y: number } {
  const angle = dir * (Math.PI / 4);
  return {
    x: SHIBA_X + Math.cos(angle) * distance,
    y: SHIBA_Y + Math.sin(angle) * distance,
  };
}

function smallBehavior(index: number): Behavior {
  const order: readonly Behavior[] = ["fast", "feint", "shield", "feint", "fast"];
  return order[index] ?? "fast";
}

function spawnBurst(state: GameState, dir: number, wave: "small" | "mixed"): void {
  for (let i = 0; i < BURST_COUNT; i++) {
    const kind: EnemyKind = wave === "mixed" && i === BURST_COUNT - 1 ? "large" : "small";
    const at = pointOnRay(dir, 200 + i * BURST_SPACING);
    const behavior: Behavior = kind === "large" ? "throw" : smallBehavior(i);
    spawnEnemy(state, {
      kind,
      side: at.x >= SHIBA_X ? "right" : "left",
      x: at.x,
      y: at.y,
      behavior,
      speed: behavior === "fast" ? 156 : undefined,
    });
  }
  state.burstIndex += 1;
}

function spawnBoss(state: GameState): void {
  for (const enemy of state.enemies) {
    if (enemy.phase === "blown" || enemy.phase === "dead") continue;
    blow(enemy, "pop", 0);
  }
  const dir = state.burstIndex % 8;
  const at = pointOnRay(dir, 250);
  spawnEnemy(state, {
    kind: "boss",
    side: at.x >= SHIBA_X ? "right" : "left",
    x: at.x,
    y: at.y,
    behavior: "boss",
  });
  state.bossSpawned = true;
  state.shake = Math.max(state.shake, 12);
}

function moveEnemies(state: GameState, dt: number): boolean {
  for (const enemy of state.enemies) {
    enemy.flash = Math.max(0, enemy.flash - dt);
    switch (enemy.phase) {
      case "approach": {
        const dx = SHIBA_X - enemy.x;
        const dy = SHIBA_Y - enemy.y;
        const dist = Math.hypot(dx, dy) || 1;
        let moving = enemy.behavior === "fast" ? Math.max(enemy.speed, 150) : enemy.speed;
        if (enemy.behavior === "feint" && enemy.attackRange > 0) {
          if (enemy.feint > 0) {
            enemy.feint -= dt;
            moving = -Math.max(70, enemy.speed);
          } else if (!enemy.feinted && dist < 170) {
            enemy.feint = 0.45;
            enemy.feinted = true;
          }
        }
        if (enemy.behavior === "throw" && enemy.attackRange > 0 && !enemy.thrown && dist < 180) {
          enemy.thrown = true;
          state.shots.push({
            x: enemy.x,
            y: enemy.y,
            vx: (dx / dist) * 240,
            vy: (dy / dist) * 240,
            life: 1.6,
          });
        }
        enemy.x += (dx / dist) * moving * dt;
        enemy.y += (dy / dist) * moving * dt;
        const next = Math.hypot(SHIBA_X - enemy.x, SHIBA_Y - enemy.y);
        if (enemy.attackRange > 0 && enemy.feint <= 0 && next <= enemy.attackRange) {
          const out = away(enemy);
          enemy.x = SHIBA_X + out.x * enemy.attackRange;
          enemy.y = SHIBA_Y + out.y * enemy.attackRange;
          enemy.phase = "telegraph";
          enemy.telegraph = enemy.behavior === "fast" ? 0.28 : kindStats(enemy.kind).telegraph;
        }
        break;
      }
      case "telegraph": {
        enemy.telegraph -= dt;
        if (enemy.telegraph <= 0) {
          const dist = Math.abs(enemy.x - SHIBA_X);
          enemy.phase = "recover";
          enemy.recover = enemy.kind === "boss" ? 0.34 : 0.42;
          enemy.x += enemy.side === "left" ? -34 : 34;
          if (dist <= enemy.attackRange + 16 && hurtPlayer(state)) return true;
        }
        break;
      }
      case "recover": {
        enemy.recover -= dt;
        if (enemy.recover <= 0) enemy.phase = "approach";
        break;
      }
      case "blown": {
        enemy.spin += enemy.spinSpeed * dt;
        if (enemy.blowDelay > 0) {
          enemy.blowDelay -= dt;
          break;
        }
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
        enemy.vy += (enemy.chainArmed ? 60 : 40) * dt;
        break;
      }
      case "dead":
        break;
      default:
        return assertNever(enemy.phase);
    }
  }
  return false;
}

function cleanup(state: GameState): void {
  state.enemies = state.enemies.filter((enemy) => {
    if (enemy.phase !== "blown") return enemy.phase !== "dead";
    if (enemy.y < -170 || enemy.y > FIELD_H + 90) return false;
    if (enemy.x < -170 || enemy.x > FIELD_W + 170) return false;
    return true;
  });
}

function updateJuice(state: GameState, dt: number): void {
  state.anim += dt;
  state.shake = Math.max(0, state.shake - dt * 42);
  state.hurtT = Math.max(0, state.hurtT - dt);
  state.flashT = Math.max(0, state.flashT - dt);
  state.beatT = Math.max(0, state.beatT - dt * 3.2);
  state.punchT = Math.max(0, state.punchT - dt);
  state.blastT = Math.max(0, state.blastT - dt);
  state.gloveT += dt;
  if (state.invuln > 0) state.invuln = Math.max(0, state.invuln - dt);
  for (const floater of state.floaters) {
    floater.x += floater.vx * dt;
    floater.y += floater.vy * dt;
    floater.life -= dt;
  }
  state.floaters = state.floaters.filter((floater) => floater.life > 0);
  for (const spark of state.sparks) {
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.life -= dt;
  }
  state.sparks = state.sparks.filter((spark) => spark.life > 0);
}

function moveShots(state: GameState, dt: number): boolean {
  const next: Shot[] = [];
  for (const shot of state.shots) {
    shot.life -= dt;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    if (shot.life <= 0) continue;
    if (shot.x < -40 || shot.y < -40 || shot.x > FIELD_W + 40 || shot.y > FIELD_H + 40) continue;
    const dist = Math.hypot(shot.x - SHIBA_X, shot.y - SHIBA_Y);
    if (dist <= 28) {
      if (hurtPlayer(state)) return true;
      continue;
    }
    next.push(shot);
  }
  state.shots = next;
  return false;
}

function simulate(state: GameState, dt: number): void {
  if (moveEnemies(state, dt)) return;
  if (moveShots(state, dt)) return;
  if (state.phase !== "play") return;
  resolveChains(state);
  if (state.phase !== "play") return;
  cleanup(state);
  if (state.intro) return;

  state.time += dt;
  const wave = waveAt(state.time);
  switch (wave) {
    case "done":
      resetRun(state);
      state.hurtT = 0.3;
      return;
    case "boss":
      if (!state.bossSpawned) spawnBoss(state);
      break;
    case "small":
    case "mixed":
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        const dir = state.burstIndex % 8;
        spawnBurst(state, dir, wave);
        state.spawnTimer = BURST_EVERY;
      }
      break;
    default:
      assertNever(wave);
  }
  if (state.combo > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
  }
}

const NO_INPUT: FrameInput = { left: false, right: false, tap: false };

export function step(state: GameState, dt: number, input: FrameInput = NO_INPUT): void {
  if (!(dt > 0)) return;
  state.events.length = 0;

  if (state.phase === "win") {
    updateJuice(state, dt);
    moveEnemies(state, dt);
    cleanup(state);
    if (input.tap) resetRun(state);
    return;
  }

  processAim(state, input, dt);
  if (state.phase !== "play") {
    updateJuice(state, dt);
    return;
  }
  updateJuice(state, dt);
  if (state.phase !== "play") return;
  if (state.hitStop > 0) {
    const frozen = Math.min(dt, state.hitStop);
    state.hitStop -= frozen;
    const rest = dt - frozen;
    if (rest > 0) simulate(state, rest);
    return;
  }
  simulate(state, dt);
}
