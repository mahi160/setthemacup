/**
 * Typed view of apps.json (Homebrew) and pnpm.json (pnpm globals). Edit the JSON;
 * the daily sync also adds/removes entries there. Tap-qualified names
 * (owner/tap/name) are tapped automatically before install.
 */
import { loadManifest } from './manifest.ts';

export type AppKind = 'formula' | 'cask';

export interface App {
  name: string;
  kind: AppKind;
  category: string;
  desc: string;
}

const manifest = loadManifest();

export const apps: App[] = [
  ...manifest.formulae.map((p) => ({ ...p, kind: 'formula' as const })),
  ...manifest.casks.map((p) => ({ ...p, kind: 'cask' as const })),
];

export const pnpmGlobals = manifest.pnpm;

export const names = (kind: AppKind) => apps.filter((a) => a.kind === kind).map((a) => a.name);

/** owner/tap of every tap-qualified package */
export const taps = (kind: AppKind) =>
  [...new Set(apps.filter((a) => a.kind === kind && a.name.split('/').length === 3).map((a) => a.name.split('/').slice(0, 2).join('/')))];
