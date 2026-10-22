import type { Default } from '../data/defaults.ts';
import type { Shell } from './sh.ts';

export const expand = (v: Default['value'], home: string) => (typeof v === 'string' ? v.replaceAll('$HOME', home) : v);

const hostArgs = (d: Default) => (d.currentHost ? ['-currentHost'] : []);
const domainArg = (d: Default) => (d.domain === 'NSGlobalDomain' && d.currentHost ? '-g' : d.domain);

/** Does `defaults read` output match the wanted value? */
export function matches(d: Default, raw: string | undefined, home: string): boolean {
  if (raw === undefined) return false;
  const v = raw.trim();
  const want = expand(d.value, home);
  switch (d.type) {
    case 'bool':
      return (v === '1' || v.toLowerCase() === 'true') === want;
    case 'int':
    case 'float':
      return Math.abs(Number(v) - Number(want)) < 1e-6;
    case 'string':
      return v === want;
  }
}

export async function read(sh: Shell, d: Default): Promise<string | undefined> {
  const r = await sh.capture('defaults', [...hostArgs(d), 'read', domainArg(d), d.key]);
  return r.ok ? r.stdout : undefined;
}

export function writeArgs(d: Default, home: string): string[] {
  const v = expand(d.value, home);
  const flag = { bool: '-bool', int: '-int', float: '-float', string: '-string' }[d.type];
  return [...hostArgs(d), 'write', domainArg(d), d.key, flag, String(v)];
}

/** Rows whose current value differs from the table */
export async function drifted(sh: Shell, rows: Default[], home: string): Promise<Default[]> {
  const current = await Promise.all(rows.map((d) => read(sh, d)));
  return rows.filter((d, i) => !matches(d, current[i], home));
}
