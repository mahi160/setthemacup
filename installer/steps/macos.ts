import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { defaults, manualSettings, type Default } from '../data/defaults.ts';
import { drifted, writeArgs } from '../lib/defaults.ts';
import { exists } from '../lib/fs.ts';
import * as launchd from '../lib/launchd.ts';
import { binPath, compile } from '../lib/swift.ts';
import type { Ctx, Step } from '../types.ts';

const PLISTBUDDY = '/usr/libexec/PlistBuddy';
/** Applies keyboard-shortcut changes without a logout */
const ACTIVATE_SETTINGS = '/System/Library/PrivateFrameworks/SystemAdministration.framework/Resources/activateSettings';
/** Spotlight's "Show Spotlight search" shortcut (id 64): ⌘Space, disabled */
const SPOTLIGHT_OFF =
  '<dict><key>enabled</key><false/><key>value</key><dict><key>parameters</key><array><integer>32</integer><integer>49</integer><integer>1048576</integer></array><key>type</key><string>standard</string></dict></dict>';
const HOTKEYS = (ctx: Ctx) => join(ctx.home, 'Library/Preferences/com.apple.symbolichotkeys.plist');
/** Caps Lock (0x39) → Left Control (0xE0) */
const CAPS_TO_CONTROL = '{"UserKeyMapping":[{"HIDKeyboardModifierMappingSrc":0x700000039,"HIDKeyboardModifierMappingDst":0x7000000E0}]}';

const groups = () => [...new Set(defaults.map((d) => d.group))];

async function spotlightHotkeyOff(ctx: Ctx): Promise<boolean> {
  const r = await ctx.sh.capture(PLISTBUDDY, ['-c', 'Print :AppleSymbolicHotKeys:64:enabled', HOTKEYS(ctx)]);
  return r.ok && r.stdout.trim() === 'false';
}

export const macos: Step = {
  id: 'macos',
  title: 'macOS settings',
  summary: `${defaults.length} system defaults (Dock, Finder, keyboard, trackpad, …), Caps Lock → Control, display scaling`,
  details: [
    `Applies the defaults table in installer/data/defaults.ts (${groups().join(', ')}); only drifted values are written`,
    'Restarts only the affected apps (Dock, Finder, SystemUIServer)',
    'Frees ⌘Space from Spotlight for Tinycast',
    'Caps Lock → Control via a hidutil LaunchAgent (no Karabiner)',
    'No startup chime (nvram, needs sudo)',
    'Display scaling "More Space": the largest HiDPI mode of the built-in display',
  ],

  async check(ctx) {
    const off = await drifted(ctx.sh, defaults, ctx.home);
    const extra: string[] = [];
    if (!(await spotlightHotkeyOff(ctx))) extra.push('⌘Space');
    if (!launchd.isInstalled(ctx, 'caps-to-control')) extra.push('Caps Lock');
    if (!off.length && !extra.length) return { state: 'done', detail: `${defaults.length}/${defaults.length} applied` };
    return {
      state: off.length > defaults.length / 2 ? 'missing' : 'partial',
      detail: `${defaults.length - off.length}/${defaults.length} applied${extra.length ? `; to do: ${extra.join(', ')}` : ''}`,
    };
  },

  async run(ctx) {
    const off = await drifted(ctx.sh, defaults, ctx.home);
    const restart = new Set<string>();
    for (const group of groups()) {
      const rows = off.filter((d) => d.group === group);
      await ctx.task(`Defaults: ${group}`, async () => {
        if (!rows.length) return 'already applied';
        const skipped: Default[] = [];
        for (const d of rows) {
          const r = await ctx.sh.run('defaults', writeArgs(d, ctx.home), { allowFail: d.optional });
          if (!r.ok) skipped.push(d);
          else if (d.restart) restart.add(d.restart);
        }
        if (skipped.length) ctx.warn(`${skipped.map((d) => d.desc).join(', ')}: needs Full Disk Access for your terminal (or set it in System Settings)`);
        return `${rows.length - skipped.length} changed`;
      });
    }

    await ctx.task('Free ⌘Space for Tinycast', async () => {
      if (await spotlightHotkeyOff(ctx)) return 'already free';
      // A fresh Mac has no entry 64 yet, so write the whole entry (⌘Space, disabled) instead of editing it
      await ctx.sh.run('defaults', ['write', 'com.apple.symbolichotkeys', 'AppleSymbolicHotKeys', '-dict-add', '64', SPOTLIGHT_OFF]);
      await ctx.sh.run(ACTIVATE_SETTINGS, ['-u'], { allowFail: true });
    });

    await ctx.task('Caps Lock → Control', async () => {
      await launchd.install(ctx, { name: 'caps-to-control', program: ['/usr/bin/hidutil', 'property', '--set', CAPS_TO_CONTROL], runAtLoad: true });
      await ctx.sh.run('/usr/bin/hidutil', ['property', '--set', CAPS_TO_CONTROL]);
    });

    await ctx.task('No startup chime', async () => {
      const r = await ctx.sh.capture('nvram', ['StartupMute']);
      if (r.stdout.includes('%01')) return 'already muted';
      await ctx.sh.run('sudo', ['-A', 'nvram', 'StartupMute=%01']);
    });

    await ctx.task('Remove empty ~/Public and ~/Sites', async () => {
      const removed: string[] = [];
      for (const dir of ['Public', 'Sites']) {
        const path = join(ctx.home, dir);
        if (exists(path) && readdirSync(path).filter((f) => f !== '.localized').length === 0) {
          await ctx.sh.run('rm', ['-rf', path]);
          removed.push(dir);
        }
      }
      return removed.length ? removed.join(', ') : 'nothing to remove';
    });

    await ctx.task('Display scaling: More Space', async () => {
      await compile(ctx, 'set-display-resolution');
      const bin = binPath(ctx, 'set-display-resolution');
      if (ctx.dryRun && !exists(bin)) return 'would apply the largest HiDPI mode';
      const [current, largest] = await Promise.all([ctx.sh.capture(bin, ['--current']), ctx.sh.capture(bin, ['--largest'])]);
      if (current.stdout.trim() === largest.stdout.trim()) return `already ${current.stdout.trim()}`;
      await ctx.sh.run(bin);
      return largest.stdout.trim();
    });

    await ctx.task('Restart affected apps', async () => {
      for (const app of restart) await ctx.sh.run('killall', [app], { allowFail: true });
      return restart.size ? [...restart].join(', ') : 'none needed';
    });
  },

  nextSteps: () => ['Log out or restart: Spaces, key repeat and menu bar spacing apply after that', ...manualSettings.map((s) => `System Settings → ${s}`)],
};
