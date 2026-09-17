# Code

## Before writing

Read the two nearest neighbours and their tests. Repo style beats this file — always.
Grep for the util before writing it. It usually exists.
Touch the minimum. No adjacent cleanup, no drive-by renames.

## General

- Names: full words. `count` not `cnt`. Booleans `is/has/can`. Functions are verbs.
- One job per function. Early return. No flag params. ~40 lines is the smell line.
- Errors: fail loud at the boundary. No empty `catch`, no fake fallback, no silent default, no `?.` used as error handling.
- Validate untrusted input once, at the trust boundary. Trust it after.
- Derive state, never sync it. Two sources of truth = a bug with a schedule.
- No `any`, `as`, `!`. Model the real shape; let the rest infer. Union over boolean pairs.
- New file only when a second consumer exists. Colocate until then.
- Comments: only a non-obvious why. Deliberate shortcut → `// ponytail: <ceiling>, upgrade to <X> when <Y>`.

## Both frameworks

- Data comes from the route, not the component: loader / server load. Mutations are server functions or form actions. No `fetch` on mount.
- Native `<form>` + `FormData`, progressively enhanced. Controlled inputs only when per-keystroke behavior is needed.
- URL is state. Filters, tabs, pagination, open panel → search params, validated at the route.
- Server data is a cache, not client state. Never copy it into local state.
- Empty / loading / error / partial are designed branches with their own file or block, not `?.` chains.
- Keyed lists, stable ids. Never index on a reorderable list.
- Semantic elements. A button is a `button`. No `div role="button"`.
- Props flat and named. No spreading except a deliberate passthrough wrapper.

## React (TanStack Start)

- `createServerFn` for anything touching a secret, a DB, or the filesystem. Nothing else runs server-only by accident.
- Route `loader` + `validateSearch`. `useQuery` for what the loader can't cover.
- `useEffect` only for: subscribe, imperative browser API, sync to something outside React. Every effect has cleanup.
- No effect for derived data. No `useMemo`/`useCallback` without a measured cost.
- Fragment over wrapper div. Early return or `&&` — never a nested ternary in JSX.

## Svelte (SvelteKit)

- Runes: `$state` for local, `$derived` for anything computed. `$effect` is the last resort and always has teardown.
- `+page.server.ts` load and form actions. `use:enhance` on every form. No store where a rune, a prop, or the URL works.
- `+error.svelte` / `+layout.svelte` own the error and shell states.
- `$props()` destructured, `{#each items as item (item.id)}`, `{#await}` only when the loader can't stream it.
- Component `<style>` is scoped and preferred; tokens live in `app.css`.

## CSS

Full-file cleanup → run `/css-audit`. Writing new CSS, these are the rules:

- Logical properties only: `inline-size`/`block-size`, `margin-inline`, `padding-block`, `inset-*`. `width`/`height` only for axis-fixed things (icons).
- `rem` everywhere, spacing on a `0.25rem` step. `px` only for hairlines. Unitless line-height/z-index/opacity.
- Colors: `var(--token)` only. Zero hex in a component. Token missing → flag it, match the repo's naming, don't invent a scheme.
- Nesting max 2 levels. Deeper → new top-level selector.
- Property order, blank line between groups: position → layout/flex/grid → box → type → visual → motion → misc.
- `flex-wrap`, `repeat(auto-fit, minmax())`, `clamp()` over a media query. Keep a breakpoint only when layout genuinely can't be expressed.
- `transition` for state changes. `@keyframes` only for motion with no state change (spinner).
- No comments. Delete the ones that restate the selector.

## Break it (before saying done)

Answer these for every meaningful change:
1. What changed? 2. Why? 3. What can break? 4. What am I assuming? 5. What happens on failure? 6. Simpler way? 7. Where's the check?

Then run the inputs that hurt — only the ones that can actually happen here:
empty · null · `0` · `""` · huge · unicode/emoji · double submit · double click · slow network · offline · 500 · expired auth · concurrent edit · back button · refresh mid-flow · same job re-run · timezone/DST · retry after timeout · partial write.

Each one: fixed, or written down as `accepted: <risk>`. Silence is not an answer.

## Check

Non-trivial logic (branch, loop, parser, money, auth) leaves the smallest runnable thing that fails when the logic breaks — one test in the repo's existing framework, or an `assert`-based self-check if there's no framework. No new test framework, no fixtures, no suite per function. Trivial one-liners get nothing.
