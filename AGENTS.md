# Shiba Punch (しばパンチ)

Portrait phone game. One three-minute run. The shiba stands still and punches dogs that walk in from the left and right.

## Commands

```bash
npm install
npm run dev      # http://localhost:5173/shiba-punch/
npm test         # game rules
npm run build    # typecheck + static site in dist/
npm run preview  # serve dist/
```

`npm test` must pass before a change is done. The dev server base path is `/shiba-punch/`.

## Architecture

- `src/game.ts` — pure rules and simulation. No DOM, canvas, or audio. `step(state, dt, input)` is the only way time moves. Vitest imports this file alone.
- `src/draw.ts` — Canvas 2D pixel rendering.
- `src/sfx.ts` — original Web Audio synthesis. No audio files.
- `src/main.ts` — loop, pointer input, localStorage adapter.

Combat numbers, waves, punches, chains, HP, and records live in `src/game.ts`. Rendering reads state and does not decide rules.

## Rules worth preserving

- Tap the side an enemy comes from. A press shorter than 1 second is a normal punch. Holding 1 second is a super punch.
- Combo multiplier: below 10 is 1×, 10 is 2×, 30 is 5×, linear between 10 and 30, then 5×.
- Large enemies take no damage from normal punches. A super punch defeats them. Blown bodies pass damage into enemies they overlap.
- Waves: 0–60s small dogs, 60–150s small plus large, 150–180s one boss. Time-up or HP 0 retries immediately. Beating the boss records a win.
- First launch spawns one dog on the right and the hint finger. After that punch lands, `localStorage` key `shiba-punch` remembers `seenIntro`. The same record stores `bestCombo`, `bestDamage`, and `wins`.
- The prototype has one glove. `wins` is the collection counter for later gloves. Do not draw the other three.

## Constraints

- Vite + TypeScript. Runtime dependencies are not allowed. `vite`, `typescript`, and `vitest` stay in `devDependencies`.
- Canvas 2D only. Original pixel art and original shibas and dogs only.
- GitHub Pages base path is `/shiba-punch/`.
- No paid services, ads, IAP, secrets, or third-party assets.
