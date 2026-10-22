#!/usr/bin/env node
/**
 * setthemacup installer. Entry: `setup` (bin/setup) or bootstrap.sh.
 * Each step in steps/ reports its status (check) and is safe to re-run (run).
 */
import * as p from '@clack/prompts';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { styleText } from 'node:util';
import { brewEnv, ensureFormulae, hasBrew, install } from './lib/brew.ts';
import { Logger } from './lib/log.ts';
import { PRIVATE_ENV, loadPrivateEnv } from './lib/private.ts';
import { adoptSecretFile, checkSudoPassword, storeSecret } from './lib/secrets.ts';
import { Shell } from './lib/sh.ts';
import { pushPrivate, sync } from './lib/sync.ts';
import { HELP, parse, select, type Args } from './plan.ts';
import { steps } from './steps/index.ts';
import type { Ctx, State, Status, Step } from './types.ts';

const REPO = resolve(import.meta.dirname, '../..');
const HOME = homedir();
const DOCS_URL = 'https://mahi160.github.io/setthemacup/';

const green = (s: string) => styleText('green', s);
const yellow = (s: string) => styleText('yellow', s);
const red = (s: string) => styleText('red', s);
const dim = (s: string) => styleText('dim', s);
const bold = (s: string) => styleText('bold', s);

const BADGE: Record<State, (detail?: string) => string> = {
  done: (d) => green(`✓ ${d ?? 'done'}`),
  partial: (d) => yellow(`◐ ${d ?? 'partly done'}`),
  missing: (d) => dim(`○ ${d ?? 'not set up'}`),
};

/** Tools installed by bootstrap.sh / earlier steps, visible to every child process. */
function setupPath(): void {
  process.env.SETTHEMACUP = REPO;
  // sudo prompts from child processes (cask .pkg installers) become a native dialog
  // instead of a terminal prompt hidden behind the spinner
  process.env.SUDO_ASKPASS = join(REPO, 'installer/src/lib/askpass');
  process.env.PNPM_HOME ??= join(HOME, 'Library/pnpm');
  const dirs = [join(HOME, '.local/bin'), join(process.env.PNPM_HOME, 'bin'), join(HOME, '.local/share/fnm/aliases/default/bin'), join(HOME, '.local/share/fnm'), dirname(process.execPath)];
  const path = (process.env.PATH ?? '/usr/bin:/bin').split(':');
  process.env.PATH = [...dirs.filter((d) => !path.includes(d)), ...path].join(':');
  if (hasBrew()) brewEnv();
}

function bail(message = 'Cancelled.'): never {
  p.cancel(message);
  process.exit(1);
}

async function ask<T>(prompt: Promise<T>): Promise<Exclude<T, symbol>> {
  const value = await prompt;
  if (p.isCancel(value)) bail();
  return value as Exclude<T, symbol>;
}

/** Private values, if already on this Mac. A new Mac gets them in the Private settings step. */
function privateEnv(args: Args): Record<string, string> {
  if (existsSync(PRIVATE_ENV)) return loadPrivateEnv();
  if (!args.list) p.log.info('No private settings on this Mac yet — the Private settings step restores them from GitHub (or asks once).');
  return {};
}

/** `setup --sync`: also the daily LaunchAgent, so no prompts and a notification instead of UI. */
async function runSync(sh: Shell, dryRun: boolean): Promise<void> {
  const { summary: lists, baseline } = await sync(sh, { dryRun });
  const priv = await pushPrivate(sh, { dryRun });
  if (baseline) console.log('sync: baseline recorded — changes are tracked from now on');
  const summary = [lists, priv].filter(Boolean).join(' · ');
  if (!summary) return console.log(baseline ? '' : 'sync: no changes');
  console.log(`sync${dryRun ? ' (dry run)' : ''}: ${summary}`);
  if (dryRun) return;
  const message = lists ? `${summary}. Review and commit ~/.setup.` : `${summary} (pushed to your private repo).`;
  const notifier = await sh.capture('terminal-notifier', ['-title', 'setthemacup', '-message', message, '-group', 'setthemacup-sync']);
  if (!notifier.ok) await sh.capture('osascript', ['-e', `display notification ${JSON.stringify(message)} with title "setthemacup"`]);
}

/**
 * Ask for the Mac password once and keep it for this run (lib/secrets.ts), so sudo prompts
 * later on (Homebrew, .pkg installs, nvram) are answered by lib/askpass without you.
 */
async function acquireSudo(): Promise<void> {
  let file = adoptSecretFile(process.env.SETTHEMACUP_SECRET_FILE);
  if (file && !checkSudoPassword(readFileSync(file, 'utf8').trimEnd())) file = undefined;
  for (let tries = 0; !file && tries < 3; tries++) {
    const password = await ask(
      p.password({
        message: tries ? 'That password did not work. Your Mac password:' : 'Your Mac password (used for installs and system settings, kept only for this run)',
        validate: (v) => (v ? undefined : 'Required'),
      }),
    );
    if (checkSudoPassword(password)) file = storeSecret('sudo', password);
  }
  if (!file) bail('Could not verify your password.');
  process.env.SETTHEMACUP_SECRET_FILE = file;
  // Keep the sudo ticket fresh; -A answers through askpass, so this never waits on a prompt
  let refreshing = false;
  setInterval(() => {
    if (refreshing) return;
    refreshing = true;
    spawn('sudo', ['-A', '-v'], { stdio: 'ignore' }).on('close', () => (refreshing = false));
  }, 50_000).unref();
}

/** GitHub logins (gh auth login --web) open in Brave, never Safari: install it before the questions. */
const BRAVE = '/Applications/Brave Browser.app';
async function loginBrowser(ctx: Ctx): Promise<void> {
  if (!existsSync(BRAVE)) await install(ctx, 'cask', ['brave-browser'], 'Install Brave for the GitHub login');
  if (existsSync(BRAVE) || ctx.dryRun) process.env.GH_BROWSER = "open -a 'Brave Browser'";
}

interface Outcome {
  step: Step;
  failed: string[];
  error?: string;
}

async function main(): Promise<void> {
  let args: Args;
  try {
    args = parse(process.argv.slice(2));
  } catch (err) {
    console.error(`${(err as Error).message}\n\n${HELP}`);
    process.exit(2);
  }
  if (args.help) return console.log(HELP);
  if (process.platform !== 'darwin') bail('setthemacup only supports macOS.');

  setupPath();
  const log = new Logger(join(REPO, 'logs'));
  const sh = new Shell(log, args.dryRun);

  if (args.sync) return runSync(sh, args.dryRun);

  p.intro(`${bold(' setthemacup ')}${args.dryRun ? yellow(' dry run — nothing will change') : ''}`);

  const env = privateEnv(args);
  let failures: string[] = [];
  const ctx: Ctx = {
    repo: REPO,
    home: HOME,
    dryRun: args.dryRun,
    yes: args.yes,
    env,
    sh,
    log,
    backups: [],
    async task(title, fn) {
      const s = p.spinner();
      s.start(title);
      log.write(`-- ${title}`);
      const progress = (message: string) => {
        const clean = message.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').replace(/\s+/g, ' ').trim();
        if (!clean) return;
        const room = Math.max(20, (process.stdout.columns || 100) - title.length - 12);
        s.message(`${title} ${dim(`· ${clean.length > room ? `${clean.slice(0, room - 1)}…` : clean}`)}`);
      };
      try {
        const detail = await fn(progress);
        s.stop(`${title}${detail ? dim(` — ${detail}`) : ''}`);
        return true;
      } catch (err) {
        const [first, ...rest] = String((err as Error).message ?? err).split('\n');
        s.error(`${title} — ${red(first ?? 'failed')}`);
        if (rest.length) p.log.message(dim(rest.join('\n')));
        log.write(`  ! ${title}: ${(err as Error).stack ?? err}`);
        failures.push(title);
        return false;
      }
    },
    async interactive(title, fn) {
      p.log.step(title);
      log.write(`-- ${title} (interactive)`);
      return fn();
    },
    async confirm(message, initial = true) {
      if (args.yes) return initial;
      return ask(p.confirm({ message, initialValue: initial }));
    },
    warn(message) {
      p.log.warn(message);
      log.write(`  warn: ${message}`);
    },
  };

  const s = p.spinner();
  s.start('Checking this Mac');
  const status = new Map<string, Status>();
  await Promise.all(
    steps.map(async (step) => {
      status.set(step.id, await step.check(ctx).catch((e: Error): Status => ({ state: 'missing', detail: `check failed: ${e.message}` })));
    }),
  );
  s.stop('Checked');

  if (args.list) {
    const width = Math.max(...steps.map((st) => st.id.length));
    p.note(steps.map((st) => `${st.id.padEnd(width)}  ${st.title.padEnd(18)} ${BADGE[status.get(st.id)!.state](status.get(st.id)!.detail)}`).join('\n'), 'Steps');
    p.outro(`Run one: setup --only <id>   ·   Details: ${DOCS_URL}`);
    return;
  }

  let plan: Step[];
  try {
    plan = select(steps, args);
  } catch (err) {
    bail((err as Error).message);
  }
  if (!args.yes && !args.only.length && !args.skip.length) {
    p.note(
      [
        'Homebrew, then the items you pick below. Everything is safe to re-run:',
        'finished items are skipped, real files are backed up, never overwritten.',
        '',
        `Full details: ${DOCS_URL}`,
      ].join('\n'),
      'What this does',
    );
    const optional = plan.filter((st) => !st.required);
    const picked = await ask(
      p.multiselect({
        message: `Choose what to set up ${dim('(Homebrew always runs)')}`,
        options: optional.map((st) => ({ value: st.id, label: st.title, hint: `${st.summary}  ${BADGE[status.get(st.id)!.state](status.get(st.id)!.detail)}` })),
        initialValues: optional.map((st) => st.id),
        required: false,
      }),
    );
    plan = plan.filter((st) => st.required || picked.includes(st.id));
  }

  // ── Questions first: everything that needs a person, then the rest runs on its own ──
  const restartWhenDone =
    !args.yes && !args.dryRun && plan.some((st) => st.id === 'macos') && (await ctx.confirm('Restart automatically when everything is done?', false));
  if (!args.dryRun) await acquireSudo();

  const outcomes: Outcome[] = [];
  const runStep = async (step: Step, n: number) => {
    p.log.step(bold(`${n}/${plan.length}  ${step.title}`));
    log.section(step.title);
    failures = [];
    let error: string | undefined;
    try {
      if (step.requires?.length && hasBrew()) await ensureFormulae(ctx, step.requires);
      await step.run(ctx);
    } catch (err) {
      error = (err as Error).message.split('\n')[0];
      p.log.error(`${step.title}: ${error}`);
      log.write(`  ! ${(err as Error).stack}`);
    }
    outcomes.push({ step, failed: [...failures], error });
    if (step.required && (error || failures.length)) bail(`${step.title} failed — nothing else can run. Log: ${log.path}`);
  };

  // Required steps (Homebrew) first: the questions below need gh from Homebrew
  const required = plan.filter((st) => st.required);
  for (const step of required) await runStep(step, plan.indexOf(step) + 1);

  const asking = plan.filter((st) => st.prepare);
  const skipRun = new Set<string>();
  if (asking.length) {
    if (hasBrew()) {
      await ensureFormulae(ctx, ['gh', 'git']);
      await loginBrowser(ctx);
    }
    p.log.step(bold('Questions'));
    log.section('Questions');
    for (const step of asking) {
      try {
        await step.prepare!(ctx);
      } catch (err) {
        const error = (err as Error).message.split('\n')[0];
        p.log.error(`${step.title}: ${error}`);
        log.write(`  ! prepare ${step.title}: ${(err as Error).stack}`);
        outcomes.push({ step, failed: [], error });
        skipRun.add(step.id);
      }
    }
  }
  const rest = plan.filter((st) => !st.required && !skipRun.has(st.id));
  if (!args.yes && rest.length) p.log.success(bold("That's every question. The rest runs on its own — you can walk away."));

  for (const step of rest) await runStep(step, plan.indexOf(step) + 1);

  const lines = outcomes.map(({ step, failed, error }) =>
    failed.length || error ? red(`✗ ${step.title}`) + dim(` — ${[...failed, error].filter(Boolean).join('; ')}`) : green(`✓ ${step.title}`),
  );
  if (ctx.backups.length) lines.push('', `Backed up to ~/.setup-backup/: ${ctx.backups.join(', ')}`);
  p.note(lines.join('\n'), 'Summary');

  if (args.dryRun) {
    const cmds = sh.planned;
    p.note(cmds.length ? cmds.slice(0, 40).map((c) => dim(c)).join('\n') + (cmds.length > 40 ? `\n… ${cmds.length - 40} more in the log` : '') : 'Nothing to do.', `Would run ${cmds.length} commands`);
    p.outro(`Log: ${log.path.replace(HOME, '~')}`);
    return;
  }

  const next: string[] = [];
  for (const { step } of outcomes) next.push(...((await step.nextSteps?.(ctx)) ?? []));
  next.push('`setup --list` shows what is installed; `setup --only <id>` re-runs one step');
  writeFileSync(join(REPO, 'logs/next-steps.md'), `# What's next\n\n${next.map((n) => `- [ ] ${n}`).join('\n')}\n`);
  p.note(next.map((n) => `☐ ${n}`).join('\n'), "What's next");

  const failedAny = outcomes.some((o) => o.failed.length || o.error);
  if (restartWhenDone && !failedAny) {
    p.log.info('Restarting in 10 seconds (Ctrl-C to cancel)…');
    await new Promise((r) => setTimeout(r, 10_000));
    spawnSync('osascript', ['-e', 'tell application "System Events" to restart']);
  } else if (restartWhenDone) {
    p.log.warn('Not restarting: some steps failed. Check the summary above, then restart when ready.');
  }
  p.outro(`${failedAny ? yellow('Finished with errors.') : green('All set.')} Checklist: logs/next-steps.md · Log: ${log.path.replace(HOME, '~')}`);
}

main().catch((err: Error) => {
  p.log.error(err.stack ?? String(err));
  process.exit(1);
});
