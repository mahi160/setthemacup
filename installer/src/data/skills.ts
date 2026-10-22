/**
 * Typed view of skills.json. Skills install with
 * `npx skills add <repo> --skill … -g --agent pi` into ~/.agents/skills (outside this repo).
 */
import { loadManifest } from './manifest.ts';

export type { SkillSource } from './manifest.ts';

export const skills = loadManifest().skills;

/** Pinned so a CLI change can't silently alter installs */
export const SKILLS_CLI = 'skills@1.7.4';
