import { drawGame, layoutPlayfield, type Layout } from "./draw";
import {
  FIELD_H,
  FIELD_W,
  SHIBA_X,
  SHIBA_Y,
  SUPER_HOLD,
  createGame,
  step,
  type FrameInput,
  type GameState,
  type Storage,
} from "./game";
import { setViewSize } from "./pixels";
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

/** Taps inside this radius of the shiba spend the gold ring. Outside it, the finger aims. */
const SPECIAL_RADIUS = 70;

interface TrackedPointer {
  x: number;
  y: number;
  seen: boolean;
  center: boolean;
}

class Controls {
  private readonly pointers = new Map<number, TrackedPointer>();
  private tap = false;
  private ghost: { aim: number; center: boolean } | null = null;
  private releaseGhost = false;
  private specialEdge = false;

  constructor(
    private readonly surface: HTMLCanvasElement,
    private readonly onPress: () => void,
  ) {
    surface.addEventListener("pointerdown", (event) => this.onDown(event), { passive: false });
    surface.addEventListener("pointermove", (event) => this.onMove(event), { passive: false });
    surface.addEventListener("pointerup", (event) => this.onUp(event));
    surface.addEventListener("pointercancel", (event) => this.onUp(event));
    surface.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  private pointOf(event: PointerEvent): { x: number; y: number } | null {
    const rect = this.surface.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = ((event.clientX - rect.left) / rect.width) * FIELD_W;
    const y = ((event.clientY - rect.top) / rect.height) * FIELD_H;
    if (x < 0 || y < 0 || x > FIELD_W || y > FIELD_H) return null;
    return { x, y };
  }

  private aimOf(x: number, y: number): number {
    return Math.atan2(y - SHIBA_Y, x - SHIBA_X);
  }

  private inRing(x: number, y: number): boolean {
    const dx = x - SHIBA_X;
    const dy = y - SHIBA_Y;
    return dx * dx + dy * dy <= SPECIAL_RADIUS * SPECIAL_RADIUS;
  }

  private onDown(event: PointerEvent): void {
    event.preventDefault();
    const point = this.pointOf(event);
    if (!point) return;
    const center = this.inRing(point.x, point.y);
    if (center || this.pointers.size >= 1) this.specialEdge = true;
    this.surface.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: point.x, y: point.y, seen: false, center });
    this.tap = true;
    this.onPress();
  }

  private onMove(event: PointerEvent): void {
    const pointer = this.pointers.get(event.pointerId);
    const point = this.pointOf(event);
    if (!pointer || !point) return;
    pointer.x = point.x;
    pointer.y = point.y;
  }

  private onUp(event: PointerEvent): void {
    const pointer = this.pointers.get(event.pointerId);
    this.pointers.delete(event.pointerId);
    if (!pointer || pointer.seen) return;
    this.ghost = { aim: this.aimOf(pointer.x, pointer.y), center: pointer.center };
  }

  private heldAim(): number | null {
    for (const pointer of this.pointers.values()) {
      if (pointer.center) continue;
      return this.aimOf(pointer.x, pointer.y);
    }
    return null;
  }

  private aimInput(aim: number, tap: boolean): FrameInput {
    return {
      left: Math.cos(aim) < 0,
      right: Math.cos(aim) >= 0,
      tap,
      aim,
    };
  }

  sample(): FrameInput {
    if (this.specialEdge) {
      this.specialEdge = false;
      this.tap = false;
      this.ghost = null;
      this.releaseGhost = false;
      for (const pointer of this.pointers.values()) pointer.seen = true;
      return { left: false, right: false, tap: true, aim: null, special: true };
    }
    if (this.ghost) {
      const ghost = this.ghost;
      this.ghost = null;
      this.tap = false;
      if (ghost.center) return { left: false, right: false, tap: true, aim: null, special: true };
      this.releaseGhost = true;
      const held = this.heldAim();
      return this.aimInput(held ?? ghost.aim, true);
    }
    if (this.releaseGhost) {
      this.releaseGhost = false;
      const held = this.heldAim();
      if (held === null) return { left: false, right: false, tap: false, aim: null };
      return this.aimInput(held, false);
    }
    for (const pointer of this.pointers.values()) pointer.seen = true;
    const tap = this.tap;
    this.tap = false;
    const aim = this.heldAim();
    if (aim === null) return { left: false, right: false, tap, aim: null };
    return this.aimInput(aim, tap);
  }
}

const controls = new Controls(canvas, () => sfx.unlock());

function blockBrowserGestures(): void {
  const stop = (event: Event): void => {
    event.preventDefault();
  };
  const names: readonly string[] = [
    "dblclick",
    "gesturestart",
    "gesturechange",
    "gestureend",
    "selectstart",
    "contextmenu",
  ];
  for (const name of names) window.addEventListener(name, stop, { passive: false });
  document.addEventListener("touchmove", stop, { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (event) => {
      const now = performance.now();
      if (now - lastTouchEnd < 300) event.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false },
  );
}

blockBrowserGestures();

function viewportBox(): { width: number; height: number; left: number; top: number } {
  const viewport = window.visualViewport;
  if (!viewport) {
    return { width: window.innerWidth, height: window.innerHeight, left: 0, top: 0 };
  }
  return {
    width: viewport.width,
    height: viewport.height,
    left: viewport.offsetLeft,
    top: viewport.offsetTop,
  };
}

function resize(): Layout {
  const box = viewportBox();
  const layout = layoutPlayfield(box.width, box.height);
  setViewSize(layout.width, layout.height);
  if (canvas.width !== layout.width) canvas.width = layout.width;
  if (canvas.height !== layout.height) canvas.height = layout.height;
  canvas.style.width = `${layout.width * layout.scale}px`;
  canvas.style.height = `${layout.height * layout.scale}px`;
  canvas.style.left = `${Math.round(box.left)}px`;
  canvas.style.top = `${Math.round(box.top)}px`;
  return layout;
}

function render(): void {
  resize();
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawGame(ctx, state, 0);
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
