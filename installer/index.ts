#!/usr/bin/env node
/**
 * setthemacup installer. Entry: `setup` (bin/setup) or bootstrap.sh.
 * Each step in steps/ reports its status (check) and is safe to re-run (run).
 */
import * as p from '@clack/prompts';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { styleText } from 'node:util';
import { brewEnv, ensureFormulae, hasBrew } from './lib/brew.ts';
import { Logger } from './lib/log.ts';
import { FIELDS, PRIVATE_ENV, loadPrivateEnv, renderPrivateEnv } from './lib/private.ts';
import { Shell } from './lib/sh.ts';
import { sync } from './lib/sync.ts';
import { HELP, parse, select, type Args } from './plan.ts';
import { steps } from './steps/index.ts';
import type { Ctx, State, Status, Step } from './types.ts';

const REPO = resolve(import.meta.dirname, '..');
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

/** First run on a new Mac: collect the private values that must never live in the repo. */
async function ensurePrivateEnv(args: Args): Promise<Record<string, string>> {
  if (existsSync(PRIVATE_ENV)) return loadPrivateEnv();
  if (args.yes || args.list) {
    p.log.warn(`No ${PRIVATE_ENV.replace(HOME, '~')} — git identity, work setup, SMB and flowd are skipped.`);
    return {};
  }
  p.note(
    `Personal values (git identity, work folder, private repos) are kept out of this public repo.\nThey're saved to ${PRIVATE_ENV.replace(HOME, '~')} — edit it any time.`,
    'Private settings',
  );
  const values: Record<string, string> = {};
  for (const f of FIELDS) {
    const answer = await ask(
      p.text({
        message: f.message,
        initialValue: f.initial?.replace('$HOME', HOME) ?? '',
        validate: (v) => (f.required && !v?.trim() ? 'Required' : undefined),
      }),
    );
    values[f.key] = answer.trim();
  }
  if (!args.dryRun) {
    mkdirSync(dirname(PRIVATE_ENV), { recursive: true });
    writeFileSync(PRIVATE_ENV, renderPrivateEnv(values), { mode: 0o600 });
    return loadPrivateEnv();
  }
  return values;
}

/** `setup --sync`: also the daily LaunchAgent, so no prompts and a notification instead of UI. */
async function runSync(sh: Shell, dryRun: boolean): Promise<void> {
  const { summary, baseline } = await sync(sh, { dryRun });
  if (baseline) return console.log('sync: baseline recorded — changes are tracked from now on');
  if (!summary) return console.log('sync: no changes');
  console.log(`sync${dryRun ? ' (dry run)' : ''}: ${summary}`);
  if (dryRun) return;
  const message = `${summary}. Review and commit ~/.setup.`;
  const notifier = await sh.capture('terminal-notifier', ['-title', 'setthemacup', '-message', message, '-group', 'setthemacup-sync']);
  if (!notifier.ok) await sh.capture('osascript', ['-e', `display notification ${JSON.stringify(message)} with title "setthemacup"`]);
}

function keepSudoAlive(): void {
  p.log.info('Your password is needed once (Homebrew, system settings).');
  if (spawnSync('sudo', ['-v'], { stdio: 'inherit' }).status !== 0) bail('sudo is required.');
  setInterval(() => spawn('sudo', ['-n', '-v'], { stdio: 'ignore' }), 50_000).unref();
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

  const env = await ensurePrivateEnv(args);
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
      try {
        const detail = await fn();
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

  if (!args.dryRun) keepSudoAlive();

  const outcomes: Outcome[] = [];
  for (const [i, step] of plan.entries()) {
    p.log.step(bold(`${i + 1}/${plan.length}  ${step.title}`));
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
  }

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
  if (!failedAny && outcomes.some((o) => o.step.id === 'macos') && !args.yes) {
    if (await ctx.confirm('Restart now so every setting applies?', false)) {
      spawnSync('osascript', ['-e', 'tell application "System Events" to restart']);
    }
  }
  p.outro(`${failedAny ? yellow('Finished with errors.') : green('All set.')} Checklist: logs/next-steps.md · Log: ${log.path.replace(HOME, '~')}`);
}

main().catch((err: Error) => {
  p.log.error(err.stack ?? String(err));
  process.exit(1);
});
