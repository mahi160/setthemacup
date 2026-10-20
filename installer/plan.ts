import { parseArgs } from 'node:util';
import type { Step } from './types.ts';

export interface Args {
  yes: boolean;
  dryRun: boolean;
  list: boolean;
  sync: boolean;
  help: boolean;
  only: string[];
  skip: string[];
}

const ids = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

export function parse(argv: string[]): Args {
  const { values } = parseArgs({
    args: argv,
    options: {
      yes: { type: 'boolean', short: 'y', default: false },
      'dry-run': { type: 'boolean', short: 'n', default: false },
      list: { type: 'boolean', short: 'l', default: false },
      sync: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
      only: { type: 'string' },
      skip: { type: 'string' },
    },
    strict: true,
  });
  return {
    yes: values.yes,
    dryRun: values['dry-run'],
    list: values.list,
    sync: values.sync,
    help: values.help,
    only: ids(values.only),
    skip: ids(values.skip),
  };
}

/** Steps to run, in registry order. Required steps always run. Throws on unknown ids. */
export function select(steps: Step[], { only, skip }: Pick<Args, 'only' | 'skip'>): Step[] {
  const known = new Set(steps.map((s) => s.id));
  const unknown = [...only, ...skip].filter((id) => !known.has(id));
  if (unknown.length) throw new Error(`unknown step: ${unknown.join(', ')} (known: ${[...known].join(', ')})`);
  return steps.filter((s) => s.required || ((!only.length || only.includes(s.id)) && !skip.includes(s.id)));
}

export const HELP = `setup — install and configure this Mac

Usage: setup [options]

  -y, --yes          run everything, no checklist or prompts
  -n, --dry-run      show what would run; change nothing
  -l, --list         show each step and whether it's done
      --sync         update the package/skill lists from what you installed or
                     removed by hand (runs daily; -n to preview)
      --only a,b     run only these steps (Homebrew always runs)
      --skip a,b     run everything except these
  -h, --help         this help

Steps: homebrew, cli, dotfiles, git, nvim, ai, extras, flowd, apps, macos
Details: https://mahi160.github.io/setthemacup/`;
