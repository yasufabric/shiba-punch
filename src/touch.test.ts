import { describe, expect, it } from "vitest";
import htmlSource from "../index.html?raw";
import mainSource from "./main.ts?raw";

describe("touch lock", () => {
  it("stops double-tap zoom, scroll, and the long-press callout", () => {
    expect(htmlSource).toMatch(/name="viewport"/);
    expect(htmlSource).toMatch(/width=device-width/);
    expect(htmlSource).toMatch(/initial-scale=1/);
    expect(htmlSource).toMatch(/minimum-scale=1/);
    expect(htmlSource).toMatch(/maximum-scale=1/);
    expect(htmlSource).toMatch(/user-scalable=no/);
    expect(htmlSource).toMatch(/touch-action:\s*none/);
    expect(htmlSource).toMatch(/-webkit-touch-callout:\s*none/);
    expect(htmlSource).toMatch(/-webkit-user-select:\s*none/);
    expect(htmlSource).toMatch(/user-select:\s*none/);
    expect(mainSource).toContain("dblclick");
    expect(mainSource).toContain("gesturestart");
    expect(mainSource).toContain("gesturechange");
    expect(mainSource).toContain("gestureend");
    expect(mainSource).toContain("selectstart");
    expect(mainSource).toContain('document.addEventListener("touchmove"');
    expect(mainSource).toContain("preventDefault");
  });
});
