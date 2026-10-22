import { statSync } from 'node:fs';
import { join } from 'node:path';
import type { Ctx } from '../types.ts';
import { exists } from './fs.ts';

export const SWIFT_BINS = ['set-display-resolution'];

export const binPath = (ctx: Ctx, name: string) => join(ctx.home, '.local/bin', name);
const srcPath = (ctx: Ctx, name: string) => join(ctx.repo, 'installer/swift', `${name}.swift`);

export function isStale(ctx: Ctx, name: string): boolean {
  const bin = binPath(ctx, name);
  return !exists(bin) || statSync(srcPath(ctx, name)).mtimeMs > statSync(bin).mtimeMs;
}

/** Compile installer/swift/<name>.swift to ~/.local/bin/<name> when the source is newer. */
export async function compile(ctx: Ctx, name: string): Promise<boolean> {
  if (!isStale(ctx, name)) return false;
  await ctx.sh.run('swiftc', ['-O', srcPath(ctx, name), '-o', binPath(ctx, name)]);
  return true;
}
