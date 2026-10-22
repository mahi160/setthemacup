import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Ctx } from '../types.ts';

export const exists = (path: string): boolean => existsSync(path);

export const readText = (path: string): string | undefined =>
  existsSync(path) ? readFileSync(path, 'utf8') : undefined;

export const isSymlinkTo = (link: string, target: string): boolean => {
  try {
    return lstatSync(link).isSymbolicLink() && readlinkSync(link) === target;
  } catch {
    return false;
  }
};

export type WriteResult = 'created' | 'updated' | 'unchanged';

/** Write a generated file only when its content differs. Honors --dry-run. */
export function writeFile(ctx: Ctx, path: string, content: string, mode?: number): WriteResult {
  const current = readText(path);
  if (current === content) return 'unchanged';
  const result: WriteResult = current === undefined ? 'created' : 'updated';
  ctx.log.write(`${ctx.dryRun ? '[dry-run] ' : ''}write ${path} (${result})`);
  if (!ctx.dryRun) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    if (mode !== undefined) chmodSync(path, mode);
  }
  return result;
}

/** Point `link` at `target`, replacing a stale link or a copied file. Honors --dry-run. */
export function link(ctx: Ctx, target: string, path: string): boolean {
  if (isSymlinkTo(path, target)) return false;
  ctx.log.write(`${ctx.dryRun ? '[dry-run] ' : ''}link ${path} -> ${target}`);
  if (!ctx.dryRun) {
    mkdirSync(dirname(path), { recursive: true });
    rmSync(path, { force: true });
    symlinkSync(target, path);
  }
  return true;
}

export function remove(ctx: Ctx, path: string): boolean {
  if (!existsSync(path) && !isBrokenLink(path)) return false;
  ctx.log.write(`${ctx.dryRun ? '[dry-run] ' : ''}remove ${path}`);
  if (!ctx.dryRun) rmSync(path, { force: true, recursive: true });
  return true;
}

const isBrokenLink = (path: string): boolean => {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
};

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
