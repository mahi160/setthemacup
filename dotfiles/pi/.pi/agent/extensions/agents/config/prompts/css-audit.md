# CSS Audit

Audit and rewrite one CSS file plus the markup (html/jsx/tsx) that uses it. Goal: correct, minimal, modern, boringly consistent CSS.

## Process

1. **Locate.** Task gives a CSS file path (or a component path — find its CSS). Find the paired markup: same basename (`Button.css` ↔ `Button.jsx`/`.tsx`/`.html`), or `grep` the CSS's class/selector names across the repo if no same-name file exists.
2. **Read both.** CSS file in full. Markup file(s) that reference its classes.
3. **Audit CSS** against every rule below. List violations before touching anything.
4. **Audit markup**: classes defined in CSS but never used in markup (dead), classes used in markup but never defined (broken), inline `style=`/`style={{}}` that duplicates or should move into a CSS class.
5. **Rewrite** the CSS file in place with `edit`. Fix markup only for dead/broken classes and inline-style extraction — never change component logic, props, or structure.
6. **Report** a short summary (see Output).

## Rules

**Property order** — group, blank line between groups, this order:
1. Positioning (`position`, `inset`, `inset-block`, `inset-inline`, `z-index`)
2. Display/flex/grid (`display`, `flex-*`, `grid-*`, `align-*`, `justify-*`, `gap`)
3. Box model (`inline-size`, `block-size`, `margin-*`, `padding-*`, `border-*`)
4. Typography (`font-*`, `line-height`, `text-*`, `letter-spacing`)
5. Visual (`background`, `color`, `box-shadow`, `opacity`)
6. Motion (`transition`, `transform`, `will-change`)
7. Misc (`cursor`, `pointer-events`, everything else)

**Modern CSS, Baseline 2022 target** — nesting, `:has()`, container queries are newer than that; use anyway if it deletes real complexity (a wrapper class, a media query), never just for style. Prefer `:is()`/`:where()`, `gap`, `aspect-ratio`, `clamp()` — those are safe.

**Logical properties only** — `inline-size`/`block-size` not `width`/`height` (unless the element is intentionally axis-fixed, e.g. an icon), `margin-inline`/`margin-block` not `margin-left`/`top`, `inset-*` not `top`/`left`/`right`/`bottom`.

**Units** — `rem` for every length that should scale with user font-size (spacing, font-size, sizing). `px` only for hairlines (1px borders) or where a fixed device pixel is the actual intent. Unitless `line-height`, `z-index`, `opacity`, `flex`/`grid` track counts.

**Spacing scale** — every non-`font-size` `rem` value must be a multiple of `0.25rem` (4px step: `0.25`, `0.5`, `0.75`, `1`, `1.25`, ...). `font-size` is exempt — `0.875rem`, `1.125rem` etc. are fine. Off-scale value found (e.g. `0.3rem`, `1.4rem`) → round to the nearest step unless the exact value is load-bearing (matches a border width, an icon's intrinsic size).

**Colors** — zero hardcoded hex/rgb/hsl in this file. Every color is `var(--token-name)`. Token missing from the repo's existing CSS variable set → flag it, don't invent a new naming scheme; match whatever convention (`--color-*`, `--thm-*`, etc.) the repo already uses.

**Nesting** — max 2 levels deep (parent → child, child → pseudo/modifier). Never 3+. Flatten anything deeper into a new top-level selector.

**Class names** — match the file's existing convention (BEM, kebab-case utility, CSS Modules camelCase — detect, don't impose). Flag names that are typo'd, redundant (`.button-button`), or non-descriptive (`.div1`, `.wrap2`).

**Minimal CSS** — delete duplicate rules, delete rules with no matching selector in markup, merge selectors with identical declarations (`.a, .b { ... }`), collapse a single-use custom property back to a literal only if it's truly one-off.

**Flex/grid over media queries** — a `flex-wrap`, `grid-template-columns: repeat(auto-fit, minmax(...))`, or `clamp()` that removes a breakpoint entirely is always the better fix. Keep a media query only where flex/grid genuinely can't express the change (e.g. hiding an element, swapping layout direction).

**Transition over animation** — `@keyframes`/`animation` only for something that must run without a state change (loading spinner, infinite loop). State-driven visual changes (hover, open/closed, focus) use `transition`.

## Output

```
## CSS Audit: <file>

### Fixed
- <rule> — <what changed>, ...

### Markup
- <dead/broken class or inline-style extraction>, or "no changes needed"

### Flagged (not auto-fixed)
- <ambiguous case needing a human call, e.g. missing color token> — or "none"
```
