import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Ctx } from '../types.ts';

export interface StowOptions {
  /** Link files one by one so the target dir stays real (tools write into it) */
  noFolding?: boolean;
}

export interface StowPlan {
  /** Links stow would create */
  links: number;
  /** $HOME-relative paths of real files in the way */
  conflicts: string[];
}

const args = (ctx: Ctx, pkg: string, opts: StowOptions) => [
  `--dir=${join(ctx.repo, 'dotfiles')}`,
  `--target=${ctx.home}`,
  ...(opts.noFolding ? ['--no-folding'] : []),
];

/**
 * Parse `stow -n -v` output. Conflicts look like either of:
 *   * existing target is neither a link nor a directory: .zshrc
 *   * cannot stow ../x over existing target .gitconfig since neither a link nor a directory …
 */
export function parsePlan(output: string): StowPlan {
  const conflicts = new Set<string>();
  let links = 0;
  for (const line of output.split('\n')) {
    if (/^LINK: /.test(line)) links++;
    const a = line.match(/existing target is [^:]+: (.+)$/);
    const b = line.match(/over existing target (.+?) since /);
    const path = a?.[1] ?? b?.[1];
    if (path) conflicts.add(path.trim());
  }
  return { links, conflicts: [...conflicts] };
}

export async function plan(ctx: Ctx, pkg: string, opts: StowOptions = {}): Promise<StowPlan> {
  const r = await ctx.sh.capture('stow', [...args(ctx, pkg, opts), '-n', '-v', pkg]);
  return parsePlan(`${r.stdout}\n${r.stderr}`);
}

/** Move conflicting real files to ~/.setup-backup/<date>/ (paths kept), then stow. */
export async function stow(ctx: Ctx, pkg: string, opts: StowOptions = {}): Promise<string> {
  const { links, conflicts } = await plan(ctx, pkg, opts);
  if (!links && !conflicts.length) return 'linked';
  const day = new Date().toISOString().slice(0, 10);
  for (const rel of conflicts) {
    const from = join(ctx.home, rel);
    const to = join(ctx.home, '.setup-backup', day, rel);
    if (!existsSync(from)) continue;
    ctx.log.write(`${ctx.dryRun ? '[dry-run] ' : ''}backup ${from} -> ${to}`);
    if (!ctx.dryRun) {
      mkdirSync(dirname(to), { recursive: true });
      renameSync(from, existsSync(to) ? `${to}.${Date.now()}` : to);
    }
    ctx.backups.push(`~/${rel}`);
  }
  await ctx.sh.run('stow', [...args(ctx, pkg, opts), pkg]);
  return conflicts.length ? `linked, backed up ${conflicts.join(', ')}` : 'linked';
}
