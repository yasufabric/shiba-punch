import { drawGame, layoutPlayfield } from "./draw";
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
    const layout = layoutPlayfield(rect.width, rect.height);
    const x = (event.clientX - rect.left - layout.x) / layout.scale;
    const y = (event.clientY - rect.top - layout.y) / layout.scale;
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

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
  canvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
}

function render(): void {
  resize();
  const dpr = canvas.width / Math.max(1, window.innerWidth);
  const layout = layoutPlayfield(window.innerWidth, window.innerHeight);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#100c16";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * layout.scale, 0, 0, dpr * layout.scale, dpr * layout.x, dpr * layout.y);
  ctx.imageSmoothingEnabled = false;
  drawGame(ctx, state, safeTop() / layout.scale);
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
