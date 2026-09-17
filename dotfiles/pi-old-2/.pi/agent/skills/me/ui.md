# UI

`~/Documents/Coding/Projects/ui-dude/taste.md` exists → read it first, every rule there is a hard default (see the `ui-taste` skill). Big new surface or a full redesign → use the `impeccable` skill instead of this file.

## Before pixels

1. **POV in one sentence.** "Dense terminal, monospace, no chrome." "Editorial, lots of air, one accent." No POV → no design, just defaults.
2. **Two named references.** Real products you're stealing from, and the one move you're stealing from each. "Modern and clean" is not a reference.
3. **Mode.** Persuade (act) · Operate (task) · Read (understand) · Experience (look). Mode decides density, not taste.

## Tokens first

One neutral ramp, one accent, one radius, one shadow, `0.25rem` spacing base, type scale, two font families max, three weights max.
Every value in the UI traces to a token. A value with no source is a value you invented — replace it.
Dark mode via tokens, or not at all.

## Rules

- One grid. Consistent gaps. Everything aligns to something.
- Prose 60–75ch. Numbers tabular and right-aligned.
- Motion ≤200ms, one easing, on state change only, `prefers-reduced-motion` respected.
- States designed, all of them: empty (with the action), loading (skeleton in the real layout), error (what happened + what to do), success, disabled, `:focus-visible`.
- a11y floor: keyboard reachable, visible focus, real labels, 4.5:1 contrast, 44px targets, never color as the only signal.
- Density is a choice. Pick it and hold it across the screen.

## Banned (AI slop tells)

Centered hero + gradient blob + "Elevate your X" · purple→pink gradients · glassmorphism cards · the 3-card feature row with generic icons · emoji as icons · `rounded-3xl` + `shadow-2xl` on everything · "✨ AI-powered" pill · placeholder/filler copy · mixed radii and off-scale spacing · full-page centered spinner as the loading state · a toast for every action · 6 weights and 2 accents · grey-on-grey text · entry animation on every element.

## Unique

One signature move, applied everywhere: a grid, a type pairing, a color relationship, extreme density, one interaction. Five gimmicks is not a style — it's noise. Name the signature in one line when you hand the UI over.
