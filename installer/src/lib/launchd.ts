import { join } from 'node:path';
import type { Ctx } from '../types.ts';
import { exists, remove, writeFile } from './fs.ts';

export const LABEL_PREFIX = 'com.setthemacup';

export interface Agent {
  /** Suffix after com.setthemacup. */
  name: string;
  program: string[];
  runAtLoad?: boolean;
  /** Weekly schedule; launchd runs missed jobs after the Mac wakes */
  weekly?: { weekday: number; hour: number; minute?: number };
  /** Daily schedule */
  daily?: { hour: number; minute?: number };
  log?: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function plist(agent: Agent): string {
  const label = `${LABEL_PREFIX}.${agent.name}`;
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    `  <key>Label</key><string>${label}</string>`,
    '  <key>ProgramArguments</key>',
    '  <array>',
    ...agent.program.map((a) => `    <string>${esc(a)}</string>`),
    '  </array>',
  ];
  if (agent.runAtLoad) lines.push('  <key>RunAtLoad</key><true/>');
  if (agent.weekly) {
    const { weekday, hour, minute = 0 } = agent.weekly;
    lines.push(
      '  <key>StartCalendarInterval</key>',
      `  <dict><key>Weekday</key><integer>${weekday}</integer><key>Hour</key><integer>${hour}</integer><key>Minute</key><integer>${minute}</integer></dict>`,
    );
  }
  if (agent.daily) {
    const { hour, minute = 0 } = agent.daily;
    lines.push('  <key>StartCalendarInterval</key>', `  <dict><key>Hour</key><integer>${hour}</integer><key>Minute</key><integer>${minute}</integer></dict>`);
  }
  if (agent.log) {
    lines.push(`  <key>StandardOutPath</key><string>${esc(agent.log)}</string>`);
    lines.push(`  <key>StandardErrorPath</key><string>${esc(agent.log)}</string>`);
  }
  lines.push('</dict>', '</plist>', '');
  return lines.join('\n');
}

export const plistPath = (ctx: Ctx, label: string) => join(ctx.home, 'Library/LaunchAgents', `${label}.plist`);

const domain = () => `gui/${process.getuid?.() ?? 501}`;

/** Write the agent and (re)load it when it changed or isn't loaded. Returns true if anything changed. */
export async function install(ctx: Ctx, agent: Agent): Promise<boolean> {
  const label = `${LABEL_PREFIX}.${agent.name}`;
  const path = plistPath(ctx, label);
  const changed = writeFile(ctx, path, plist(agent)) !== 'unchanged';
  const loaded = await ctx.sh.ok('launchctl', ['print', `${domain()}/${label}`]);
  if (!changed && loaded) return false;
  if (loaded) await ctx.sh.run('launchctl', ['bootout', `${domain()}/${label}`], { allowFail: true });
  await ctx.sh.run('launchctl', ['bootstrap', domain(), path]);
  return true;
}

export async function uninstall(ctx: Ctx, label: string): Promise<boolean> {
  const path = plistPath(ctx, label);
  if (!exists(path)) return false;
  await ctx.sh.run('launchctl', ['bootout', `${domain()}/${label}`], { allowFail: true });
  return remove(ctx, path);
}

export const isInstalled = (ctx: Ctx, name: string) => exists(plistPath(ctx, `${LABEL_PREFIX}.${name}`));
