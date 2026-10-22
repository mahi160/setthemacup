import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BREW } from '../lib/brew.ts';
import { exists, isSymlinkTo, link, remove } from '../lib/fs.ts';
import * as launchd from '../lib/launchd.ts';
import { SWIFT_BINS, compile, isStale } from '../lib/swift.ts';
import type { Ctx, Step } from '../types.ts';

const helpers = (ctx: Ctx) => readdirSync(join(ctx.repo, 'bin')).filter((f) => !f.startsWith('.'));
const localBin = (ctx: Ctx, name: string) => join(ctx.home, '.local/bin', name);

/** Copies and binaries the old shell setup put in ~/.local/bin */
const OBSOLETE_BINS = ['tmux-battery', 'tmux-cpu', 'nowplaying-mediaremote'];
/** LaunchAgents from the old setup, replaced by com.setthemacup.* */
const OBSOLETE_AGENT_PREFIXES = ['com.mahi.'];

interface Share {
  name: string;
  url: string;
}

const shares = (ctx: Ctx): Share[] =>
  (ctx.env.SMB_SHARES ?? '')
    .split(/\s+/)
    .filter((p) => p.includes('='))
    .map((p) => ({ name: p.slice(0, p.indexOf('=')), url: p.slice(p.indexOf('=') + 1) }))
    .filter((s) => /^[\w.-]+$/.test(s.name) && /^smb:\/\/[\w.@:/-]+$/.test(s.url));

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** Weekly jobs; Sunday = 0 */
const jobs = (ctx: Ctx): launchd.Agent[] => [
  {
    name: 'pi-prune',
    program: [join(ctx.repo, 'bin/pi-prune')],
    weekly: { weekday: 0, hour: 3 },
    log: '/tmp/setthemacup-pi-prune.log',
  },
  {
    name: 'fnm-clean',
    program: ['/usr/bin/find', join(ctx.home, '.local/state/fnm_multishells'), '-mindepth', '1', '-maxdepth', '1', '-mtime', '+7', '-exec', 'rm', '-rf', '{}', '+'],
    weekly: { weekday: 0, hour: 4 },
  },
  {
    name: 'sync',
    // Daily: fold manual installs/removals into the manifests, then notify
    program: [join(ctx.home, '.local/share/fnm/aliases/default/bin/node'), join(ctx.repo, 'installer/src/index.ts'), '--sync'],
    daily: { hour: 12 },
    log: '/tmp/setthemacup-sync.log',
  },
  {
    name: 'maintenance',
    // Cleanup only: no unattended upgrades. launchd has no shell PATH, hence absolute paths.
    program: [
      '/bin/bash',
      '-c',
      `${BREW} cleanup --prune=all -s; ${BREW} autoremove; "${join(ctx.home, '.local/share/fnm/aliases/default/bin/pnpm')}" store prune`,
    ],
    weekly: { weekday: 0, hour: 5 },
    log: '/tmp/setthemacup-maintenance.log',
  },
];

export const extras: Step = {
  id: 'extras',
  title: 'Extras',
  summary: 'Helper commands, Swift tools, Pokemon background, SMB auto-mount, weekly cleanup jobs',
  details: [
    'Links every file in bin/ into ~/.local/bin (dev, note, vpn, theme, pokemon-bg, setup, tmux widgets, …)',
    'Compiles installer/swift/*.swift into ~/.local/bin when the source changed',
    'Downloads a starter Pokemon for the Ghostty background and builds the pi notification icon',
    'One LaunchAgent per SMB share in private.env (mounts on login via Finder + Keychain)',
    'Weekly LaunchAgents: pi-prune, fnm multishell cleanup, brew/pnpm cache cleanup (replaces crontab)',
    'Daily `setup --sync`: anything you brew install, pnpm add -g or skills add by hand lands in the manifest (category Inbox); removals drop out; you get a notification and commit when ready',
  ],

  async check(ctx) {
    const todo: string[] = [];
    const unlinked = helpers(ctx).filter((h) => !isSymlinkTo(localBin(ctx, h), join(ctx.repo, 'bin', h)));
    if (unlinked.length) todo.push(`${unlinked.length} helpers`);
    if (SWIFT_BINS.some((b) => isStale(ctx, b))) todo.push('swift tools');
    if (!exists(join(ctx.home, 'Pictures/pokemon_bg/current.png'))) todo.push('background');
    for (const job of jobs(ctx)) if (!launchd.isInstalled(ctx, job.name)) todo.push(job.name);
    for (const s of shares(ctx)) if (!launchd.isInstalled(ctx, `mount.${slug(s.name)}`)) todo.push(`mount ${s.name}`);
    if (!todo.length) return { state: 'done', detail: 'all set' };
    return { state: unlinked.length === helpers(ctx).length ? 'missing' : 'partial', detail: `to do: ${todo.join(', ')}` };
  },

  async run(ctx) {
    await ctx.task('Link helpers into ~/.local/bin', async () => {
      const changed = helpers(ctx).filter((h) => link(ctx, join(ctx.repo, 'bin', h), localBin(ctx, h)));
      const removed = OBSOLETE_BINS.filter((b) => remove(ctx, localBin(ctx, b)));
      return [changed.length ? `linked ${changed.join(', ')}` : 'all linked', removed.length ? `removed ${removed.join(', ')}` : '']
        .filter(Boolean)
        .join('; ');
    });

    await ctx.task('Compile Swift tools', async () => {
      const built: string[] = [];
      for (const name of SWIFT_BINS) if (await compile(ctx, name)) built.push(name);
      return built.length ? built.join(', ') : 'up to date';
    });

    await ctx.task('Ghostty background', async () => {
      if (exists(join(ctx.home, 'Pictures/pokemon_bg/current.png'))) return 'already set (Alt+Q cycles)';
      const starter = [1, 4, 7, 152, 155, 158, 252, 255, 258][Math.floor(Math.random() * 9)]!;
      await ctx.sh.run(join(ctx.repo, 'bin/pokemon-bg'), [String(starter)]);
    });

    await ctx.task('pi notification icon', async () => {
      if (exists(join(ctx.home, '.local/share/pi/notify-icon.png'))) return 'exists';
      await ctx.sh.run(join(ctx.repo, 'bin/pi-notify-icon'));
    });

    await ctx.task('SMB auto-mount', async () => {
      const list = shares(ctx);
      for (const s of list) {
        const host = s.url.replace('smb://', '').split('/')[0]!;
        await launchd.install(ctx, {
          name: `mount.${slug(s.name)}`,
          program: ['/bin/bash', '-c', mountScript(s.url, host)],
          runAtLoad: true,
          log: `/tmp/setthemacup-mount-${slug(s.name)}.log`,
        });
      }
      return list.length ? list.map((s) => s.name).join(', ') : 'none in private.env';
    });

    await ctx.task('Scheduled jobs', async () => {
      for (const job of jobs(ctx)) await launchd.install(ctx, job);
      // Old crontab entries and LaunchAgents from the shell setup
      const cron = await ctx.sh.capture('crontab', ['-l']);
      const kept = cron.stdout.split('\n').filter((l) => !/pi-prune|fnm_multishells|fnm-clean/.test(l));
      if (cron.ok && kept.length !== cron.stdout.split('\n').length) {
        await ctx.sh.run('crontab', ['-'], { input: kept.join('\n') });
      }
      const agents = join(ctx.home, 'Library/LaunchAgents');
      for (const f of exists(agents) ? readdirSync(agents) : []) {
        if (OBSOLETE_AGENT_PREFIXES.some((p) => f.startsWith(p)) && f.endsWith('.plist')) {
          await launchd.uninstall(ctx, f.replace(/\.plist$/, ''));
          remove(ctx, join(agents, f.replace(/\.plist$/, '.sh')));
        }
      }
      return jobs(ctx).map((j) => j.name).join(', ');
    });
  },

  nextSteps: (ctx) => [
    ...(shares(ctx).length ? ['SMB: the first mount asks for the password — tick "Remember in Keychain"'] : []),
    'VPN: `vpn` → pick a gateway → finish SSO in the browser; then check `scutil --dns`',
  ],
};

/** Wait for the host, then mount through Finder so credentials come from the Keychain. */
const mountScript = (url: string, host: string) =>
  [
    `mount | grep -qF '${host}' && exit 0`,
    `for i in 1 2 3 4 5 6; do ping -c1 -W2 '${host}' >/dev/null 2>&1 && break; sleep 5; done`,
    `osascript -e 'mount volume "${url}"'`,
  ].join('; ');
