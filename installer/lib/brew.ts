import { existsSync } from 'node:fs';
import type { Ctx } from '../types.ts';
import { plural } from './fs.ts';
import type { Shell } from './sh.ts';

export const BREW_PREFIX = '/opt/homebrew';
export const BREW = `${BREW_PREFIX}/bin/brew`;

/** Make brew (and what it installs) visible to this process and its children. */
export function brewEnv(): void {
  for (const dir of [`${BREW_PREFIX}/sbin`, `${BREW_PREFIX}/bin`]) {
    if (!process.env.PATH?.split(':').includes(dir)) process.env.PATH = `${dir}:${process.env.PATH}`;
  }
  process.env.HOMEBREW_PREFIX = BREW_PREFIX;
  process.env.HOMEBREW_NO_ENV_HINTS = '1';
  process.env.HOMEBREW_NO_ANALYTICS = '1';
}

export const hasBrew = () => existsSync(BREW);

export type Kind = 'formula' | 'cask';

/** Short names of installed packages (taps stripped). */
export async function installed(sh: Shell, kind: Kind): Promise<Set<string>> {
  const r = await sh.capture(BREW, ['list', kind === 'cask' ? '--cask' : '--formula', '-1']);
  return new Set(r.stdout.split('\n').filter(Boolean));
}

export const shortName = (name: string) => name.split('/').pop()!;

export async function missing(sh: Shell, kind: Kind, names: string[]): Promise<string[]> {
  if (!hasBrew()) return names;
  const have = await installed(sh, kind);
  return names.filter((n) => !have.has(shortName(n)));
}

let updated = false;

/** `brew update` once per run; later calls skip auto-update. */
export async function update(ctx: Ctx): Promise<void> {
  if (updated) return;
  await ctx.task('Update Homebrew', async () => {
    await ctx.sh.run(BREW, ['update', '--quiet']);
  });
  updated = true;
  process.env.HOMEBREW_NO_AUTO_UPDATE = '1';
}

/** Third-party taps must be tapped explicitly before Homebrew installs from them. */
export async function tap(ctx: Ctx, taps: string[]): Promise<void> {
  if (!taps.length) return;
  const have = new Set((await ctx.sh.capture(BREW, ['tap'])).stdout.split('\n'));
  const todo = taps.filter((t) => !have.has(t));
  if (!todo.length) return;
  await ctx.task(`Tap ${todo.join(', ')}`, async () => {
    for (const t of todo) await ctx.sh.run(BREW, ['tap', t]);
  });
}

/**
 * Install whatever is missing in one batched call (parallel downloads).
 * If the batch fails, retry one by one so a single bad package can't block the rest.
 */
export async function install(ctx: Ctx, kind: Kind, names: string[], title: string): Promise<void> {
  const todo = await missing(ctx.sh, kind, names);
  if (!todo.length) {
    await ctx.task(title, async () => `all ${names.length} installed`);
    return;
  }
  await ctx.task(`${title}: ${plural(todo.length, 'package')}`, async () => {
    const flag = kind === 'cask' ? ['--cask'] : ['--formula'];
    const batch = await ctx.sh.run(BREW, ['install', ...flag, ...todo], { allowFail: true });
    if (batch.ok) return todo.join(', ');
    const failed: string[] = [];
    for (const name of await missing(ctx.sh, kind, todo)) {
      const r = await ctx.sh.run(BREW, ['install', ...flag, name], { allowFail: true });
      if (!r.ok) failed.push(name);
    }
    if (failed.length) throw new Error(`failed: ${failed.join(', ')} (see log)`);
  });
}

/** Formulae a step depends on, installed before it runs. */
export async function ensureFormulae(ctx: Ctx, names: string[]): Promise<void> {
  if (!names.length || !(await missing(ctx.sh, 'formula', names)).length) return;
  await update(ctx);
  await install(ctx, 'formula', names, `Install ${names.join(', ')}`);
}
