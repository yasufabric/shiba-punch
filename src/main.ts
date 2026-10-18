import { drawGame, layoutPlayfield, type Layout } from "./draw";
import {
  FIELD_H,
  FIELD_W,
  SHIBA_X,
  SUPER_HOLD,
  createGame,
  step,
  type FrameInput,
  type GameState,
  type Side,
  type Storage,
} from "./game";
import { PIXEL_H, PIXEL_W } from "./pixels";
import { Sfx } from "./sfx";

const canvasNode = document.querySelector("canvas#game");
if (!(canvasNode instanceof HTMLCanvasElement)) throw new Error("missing game canvas");
const canvas: HTMLCanvasElement = canvasNode;
const view = canvas.getContext("2d");
if (!view) throw new Error("canvas unsupported");
const ctx: CanvasRenderingContext2D = view;

function browserStorage(): Storage {
  return {
    getItem(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Private mode can reject writes; the run still plays.
      }
    },
  };
}

const state: GameState = createGame(browserStorage());
const sfx = new Sfx();

declare global {
  interface Window {
    __SHIBA__?: GameState;
  }
}

if (import.meta.env.DEV) window.__SHIBA__ = state;

class Controls {
  private readonly pointers = new Map<number, { side: Side; seen: boolean }>();
  private tap = false;
  private ghost: Side | null = null;
  private releaseGhost = false;

  constructor(
    private readonly surface: HTMLCanvasElement,
    private readonly onPress: () => void,
  ) {
    surface.addEventListener("pointerdown", (event) => this.onDown(event), { passive: false });
    surface.addEventListener("pointerup", (event) => this.onUp(event));
    surface.addEventListener("pointercancel", (event) => this.onUp(event));
    surface.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  private sideOf(event: PointerEvent): Side | null {
    const rect = this.surface.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = ((event.clientX - rect.left) / rect.width) * FIELD_W;
    const y = ((event.clientY - rect.top) / rect.height) * FIELD_H;
    if (x < 0 || y < 0 || x > FIELD_W || y > FIELD_H) return null;
    return x < SHIBA_X ? "left" : "right";
  }

  private onDown(event: PointerEvent): void {
    event.preventDefault();
    const side = this.sideOf(event);
    if (!side) return;
    this.surface.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { side, seen: false });
    this.tap = true;
    this.onPress();
  }

  private onUp(event: PointerEvent): void {
    const pointer = this.pointers.get(event.pointerId);
    this.pointers.delete(event.pointerId);
    if (pointer && !pointer.seen) this.ghost = pointer.side;
  }

  private held(side: Side): boolean {
    for (const pointer of this.pointers.values()) {
      if (pointer.side === side) return true;
    }
    return false;
  }

  sample(): FrameInput {
    if (this.ghost) {
      const side = this.ghost;
      this.ghost = null;
      this.releaseGhost = true;
      this.tap = false;
      return {
        left: side === "left" || this.held("left"),
        right: side === "right" || this.held("right"),
        tap: true,
      };
    }
    if (this.releaseGhost) {
      this.releaseGhost = false;
      return { left: this.held("left"), right: this.held("right"), tap: false };
    }
    for (const pointer of this.pointers.values()) pointer.seen = true;
    const tap = this.tap;
    this.tap = false;
    return { left: this.held("left"), right: this.held("right"), tap };
  }
}

const controls = new Controls(canvas, () => sfx.unlock());

function safeTop(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--sat");
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

function resize(): Layout {
  const layout = layoutPlayfield(window.innerWidth, window.innerHeight);
  if (canvas.width !== PIXEL_W) canvas.width = PIXEL_W;
  if (canvas.height !== PIXEL_H) canvas.height = PIXEL_H;
  canvas.style.width = `${PIXEL_W * layout.scale}px`;
  canvas.style.height = `${PIXEL_H * layout.scale}px`;
  canvas.style.left = `${layout.x}px`;
  canvas.style.top = `${layout.y}px`;
  return layout;
}

function render(): void {
  const layout = resize();
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawGame(ctx, state, Math.round(safeTop() / layout.scale));
}

let last = performance.now();
let acc = 0;
const STEP = 1 / 60;
let charging = false;

function frame(now: number): void {
  const frameDt = Math.min(0.05, (now - last) / 1000);
  last = now;
  acc = Math.min(0.25, acc + frameDt);
  const input = controls.sample();
  let guard = 0;
  while (acc >= STEP && guard < 5) {
    step(state, STEP, input);
    sfx.play(state.events);
    acc -= STEP;
    guard += 1;
  }
  const nextCharging =
    (state.chargeLeft > 0 && state.chargeLeft < SUPER_HOLD && !state.latchLeft) ||
    (state.chargeRight > 0 && state.chargeRight < SUPER_HOLD && !state.latchRight);
  if (nextCharging !== charging) {
    charging = nextCharging;
    sfx.setCharging(charging);
  }
  render();
  requestAnimationFrame(frame);
}

resize();
render();
requestAnimationFrame(frame);
