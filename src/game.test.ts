import { describe, expect, it } from "vitest";
import {
  BURST_COUNT,
  FIELD_W,
  LANE_Y,
  PLAYER_HP,
  RUN_LENGTH,
  SHIBA_X,
  STORAGE_KEY,
  SUPER_HOLD,
  WAVE_BOSS_AT,
  WAVE_MIXED_AT,
  type FrameInput,
  type GameState,
  type Progress,
  type Side,
  type Storage,
  comboMultiplier,
  createGame,
  createMemoryStorage,
  loadProgress,
  punchDamage,
  spawnEnemy,
  step,
  waveAt,
} from "./game";

const idle: FrameInput = { left: false, right: false, tap: false };

function writeProgress(storage: Storage, progress: Progress): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function resumed(progress: Partial<Progress> = {}): { storage: Storage; state: GameState } {
  const storage = createMemoryStorage();
  writeProgress(storage, {
    seenIntro: true,
    bestCombo: 0,
    bestDamage: 0,
    wins: 0,
    ...progress,
  });
  return { storage, state: createGame(storage) };
}

function tap(state: GameState, side: Side): void {
  step(state, 1 / 60, {
    left: side === "left",
    right: side === "right",
    tap: true,
  });
  step(state, 1 / 60, idle);
}

describe("combo multiplier", () => {
  it("holds the 1× / 2× / 5× anchors and rises between them", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(9)).toBe(1);
    expect(comboMultiplier(10)).toBe(2);
    expect(comboMultiplier(20)).toBe(3.5);
    expect(comboMultiplier(30)).toBe(5);
    expect(comboMultiplier(48)).toBe(5);
    expect(comboMultiplier(11)).toBeGreaterThan(2);
    expect(comboMultiplier(11)).toBeLessThan(comboMultiplier(29));
    expect(comboMultiplier(29)).toBeLessThan(5);
  });

  it("applies the 10-combo and 30-combo anchors to landed hits", () => {
    const { storage, state } = resumed();
    state.spawnTimer = 999;
    const enemy = spawnEnemy(state, {
      kind: "small",
      side: "right",
      x: SHIBA_X + 90,
      hp: 5000,
      speed: 0,
      attackRange: 0,
    });
    state.combo = 9;
    state.comboTimer = 5;
    tap(state, "right");
    expect(state.combo).toBe(10);
    expect(enemy.hp).toBe(5000 - punchDamage("normal", 10));
    expect(state.floaters.at(-1)?.value).toBe(20);
    expect(state.floaters.at(-1)?.vx).toBeGreaterThan(0);

    state.combo = 29;
    state.comboTimer = 5;
    step(state, SUPER_HOLD, { left: false, right: true, tap: false });
    expect(state.combo).toBe(30);
    expect(state.bestCombo).toBe(30);
    expect(state.bestDamage).toBe(punchDamage("super", 30));
    expect(loadProgress(storage)).toMatchObject({ bestCombo: 30, bestDamage: 200 });
  });
});

describe("punch aim", () => {
  it("hits only the side that was punched", () => {
    const { state } = resumed();
    state.spawnTimer = 999;
    const left = spawnEnemy(state, {
      kind: "small",
      side: "left",
      x: SHIBA_X - 90,
      speed: 0,
      attackRange: 0,
    });
    const right = spawnEnemy(state, {
      kind: "small",
      side: "right",
      x: SHIBA_X + 90,
      speed: 0,
      attackRange: 0,
    });
    const rightHp = right.hp;

    tap(state, "left");
    expect(left.hp).toBeLessThanOrEqual(0);
    expect(left.phase).toBe("blown");
    expect(right.hp).toBe(rightHp);
    expect(right.phase).toBe("approach");
    expect(state.floaters.some((floater) => floater.vx < 0)).toBe(true);

    tap(state, "right");
    expect(right.hp).toBeLessThanOrEqual(0);
    expect(right.phase).toBe("blown");
  });
});

describe("large enemies", () => {
  it("ignores a normal punch and dies to a super punch", () => {
    const { state } = resumed();
    state.spawnTimer = 999;
    const large = spawnEnemy(state, {
      kind: "large",
      side: "right",
      x: SHIBA_X + 100,
      speed: 0,
      attackRange: 0,
    });
    const hp = large.hp;
    tap(state, "right");
    expect(large.hp).toBe(hp);
    expect(large.phase).toBe("approach");
    expect(state.combo).toBe(0);
    expect(state.events.some((event) => event.type === "clink")).toBe(true);

    step(state, SUPER_HOLD, { left: false, right: true, tap: false });
    expect(large.hp).toBeLessThanOrEqual(0);
    expect(large.phase).toBe("blown");
    expect(large.chainArmed).toBe(true);
  });
});

describe("chain collisions", () => {
  it("deals damage when a blown enemy overlaps another", () => {
    const { state } = resumed();
    state.spawnTimer = 999;
    const flyer = spawnEnemy(state, {
      kind: "small",
      side: "right",
      x: SHIBA_X + 140,
      y: LANE_Y,
      hp: 1,
      speed: 0,
      attackRange: 0,
    });
    flyer.phase = "blown";
    flyer.chainArmed = true;
    flyer.vx = 0;
    flyer.vy = 0;
    const target = spawnEnemy(state, {
      kind: "small",
      side: "right",
      x: flyer.x + 36,
      y: LANE_Y,
      hp: 100,
      speed: 0,
      attackRange: 0,
    });

    step(state, 1 / 60, idle);
    expect(target.hp).toBe(100 - punchDamage("chain", 1));
    expect(state.combo).toBe(1);
    expect(state.floaters.at(-1)?.value).toBe(punchDamage("chain", 1));
  });

  it("lets one super punch blow away a connected line", () => {
    const { state } = resumed();
    state.spawnTimer = 999;
    const cats = [0, 1, 2, 3].map((index) =>
      spawnEnemy(state, {
        kind: "small",
        side: "right",
        x: 250 + index * 48,
        speed: 0,
        attackRange: 0,
      }),
    );
    step(state, SUPER_HOLD, { left: false, right: true, tap: false });
    for (const cat of cats) {
      expect(cat.phase).toBe("blown");
      expect(cat.hp).toBeLessThanOrEqual(0);
    }
  });
});

describe("wave boundaries", () => {
  it("switches at 60s, 150s, and 180s", () => {
    expect(waveAt(0)).toBe("small");
    expect(waveAt(59.999)).toBe("small");
    expect(waveAt(WAVE_MIXED_AT)).toBe("mixed");
    expect(waveAt(149.999)).toBe("mixed");
    expect(waveAt(WAVE_BOSS_AT)).toBe("boss");
    expect(waveAt(RUN_LENGTH - 0.001)).toBe("boss");
    expect(waveAt(RUN_LENGTH)).toBe("done");
  });

  it("spawns only small enemies before 60s and mixes in a large enemy at 60s", () => {
    const early = resumed().state;
    early.time = 20;
    early.spawnTimer = 0.01;
    step(early, 0.02, idle);
    expect(early.enemies).toHaveLength(BURST_COUNT);
    expect(early.enemies.every((enemy) => enemy.kind === "small")).toBe(true);

    const late = resumed().state;
    late.time = WAVE_MIXED_AT;
    late.spawnTimer = 0.01;
    step(late, 0.02, idle);
    expect(late.enemies.filter((enemy) => enemy.kind === "small")).toHaveLength(BURST_COUNT - 1);
    expect(late.enemies.filter((enemy) => enemy.kind === "large")).toHaveLength(1);
  });

  it("spawns one boss at 150s and retries the instant the clock hits 180s", () => {
    const { state } = resumed({ wins: 1 });
    state.time = WAVE_BOSS_AT - 0.05;
    state.spawnTimer = 999;
    step(state, 0.1, idle);
    expect(state.time).toBeGreaterThanOrEqual(WAVE_BOSS_AT);
    expect(state.enemies.filter((enemy) => enemy.kind === "boss")).toHaveLength(1);
    const bossId = state.enemies.find((enemy) => enemy.kind === "boss")?.id;
    step(state, 0.5, idle);
    expect(state.enemies.filter((enemy) => enemy.kind === "boss" && enemy.id === bossId)).toHaveLength(1);

    const timeout = resumed({ wins: 2, bestCombo: 9 }).state;
    timeout.time = RUN_LENGTH - 0.2;
    timeout.hp = 2;
    timeout.spawnTimer = 999;
    timeout.bossSpawned = true;
    step(timeout, 0.5, idle);
    expect(timeout.time).toBe(0);
    expect(timeout.hp).toBe(PLAYER_HP);
    expect(timeout.phase).toBe("play");
    expect(timeout.wins).toBe(2);
    expect(timeout.bestCombo).toBe(9);
    expect(timeout.intro).toBe(false);
  });
});

describe("hp and retry", () => {
  it("loses one HP when a telegraph finishes and retries immediately at zero", () => {
    const { state } = resumed({ bestCombo: 6, bestDamage: 40, wins: 2 });
    state.spawnTimer = 999;
    const enemy = spawnEnemy(state, {
      kind: "small",
      side: "left",
      x: SHIBA_X - 70,
      speed: 0,
      attackRange: 90,
    });
    enemy.phase = "telegraph";
    enemy.telegraph = 0.04;

    step(state, 0.1, idle);
    expect(state.hp).toBe(PLAYER_HP - 1);
    expect(state.combo).toBe(0);
    expect(state.phase).toBe("play");

    state.hp = 1;
    state.invuln = 0;
    state.hitStop = 0;
    enemy.phase = "telegraph";
    enemy.telegraph = 0.04;
    enemy.x = SHIBA_X - 70;
    step(state, 0.1, idle);
    expect(state.hp).toBe(PLAYER_HP);
    expect(state.time).toBe(0);
    expect(state.enemies).toHaveLength(0);
    expect(state.bestCombo).toBe(6);
    expect(state.bestDamage).toBe(40);
    expect(state.wins).toBe(2);
    expect(state.intro).toBe(false);
  });
});

describe("saved records", () => {
  it("reloads best combo and best damage from storage", () => {
    const { storage, state } = resumed();
    state.spawnTimer = 999;
    spawnEnemy(state, {
      kind: "small",
      side: "left",
      x: SHIBA_X - 80,
      hp: 9000,
      speed: 0,
      attackRange: 0,
    });
    state.combo = 29;
    state.comboTimer = 5;
    step(state, SUPER_HOLD, { left: true, right: false, tap: false });
    expect(loadProgress(storage)).toEqual({
      seenIntro: true,
      bestCombo: 30,
      bestDamage: 200,
      wins: 0,
    });

    const next = createGame(storage);
    expect(next.bestCombo).toBe(30);
    expect(next.bestDamage).toBe(200);
    expect(next.intro).toBe(false);
    expect(next.floaters.some((floater) => floater.vx < 0)).toBe(false);
  });

  it("advances the glove record when the boss is defeated and keeps it on the next run", () => {
    const { storage, state } = resumed();
    state.spawnTimer = 999;
    state.time = 160;
    state.bossSpawned = true;
    spawnEnemy(state, {
      kind: "boss",
      side: "right",
      x: SHIBA_X + 90,
      hp: 1,
      speed: 0,
      attackRange: 0,
    });
    tap(state, "right");
    expect(state.phase).toBe("win");
    expect(state.wins).toBe(1);
    expect(loadProgress(storage).wins).toBe(1);

    step(state, 1 / 60, { left: false, right: false, tap: true });
    expect(state.phase).toBe("play");
    expect(state.wins).toBe(1);
    expect(state.hp).toBe(PLAYER_HP);
    expect(loadProgress(storage).wins).toBe(1);
  });
});

describe("first-run hint", () => {
  it("puts one cat on the right until that side is punched, then remembers", () => {
    const storage = createMemoryStorage();
    const state = createGame(storage);
    expect(loadProgress(storage).seenIntro).toBe(false);
    expect(state.intro).toBe(true);
    expect(state.enemies).toHaveLength(1);
    expect(state.enemies[0]?.side).toBe("right");
    expect(state.enemies[0]?.x).toBeGreaterThan(SHIBA_X);
    expect(state.enemies[0]?.x).toBeLessThan(FIELD_W);

    tap(state, "left");
    expect(state.intro).toBe(true);
    expect(loadProgress(storage).seenIntro).toBe(false);

    tap(state, "right");
    expect(state.intro).toBe(false);
    expect(loadProgress(storage).seenIntro).toBe(true);
    expect(state.bestCombo).toBeGreaterThanOrEqual(1);
    expect(state.bestDamage).toBeGreaterThanOrEqual(punchDamage("normal", 1));

    const next = createGame(storage);
    expect(next.intro).toBe(false);
    expect(next.enemies).toHaveLength(0);
  });
});
