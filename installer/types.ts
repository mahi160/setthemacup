import type { Logger } from './lib/log.ts';
import type { Shell } from './lib/sh.ts';

export type State = 'done' | 'partial' | 'missing';

export interface Status {
  state: State;
  /** Short human summary, e.g. "3 of 19 missing" */
  detail?: string;
}

export interface Ctx {
  repo: string;
  home: string;
  dryRun: boolean;
  /** --yes: no prompts; confirms take their default */
  yes: boolean;
  /** Values from ~/.config/setthemacup/private.env (reloaded once the Private settings step restores it) */
  env: Record<string, string>;
  sh: Shell;
  log: Logger;
  /**
   * Run one sub-action behind a spinner. Failures are recorded, never thrown.
   * `progress` updates the spinner line; pass it as `onLine` to stream a command's output.
   */
  task(title: string, fn: (progress: (message: string) => void) => Promise<string | void>): Promise<boolean>;
  /** Run something that needs the terminal (passwords, browser logins). Throws on failure. */
  interactive<T>(title: string, fn: () => Promise<T>): Promise<T>;
  confirm(message: string, initial?: boolean): Promise<boolean>;
  warn(message: string): void;
  /** Files moved aside during this run, listed in the summary */
  backups: string[];
}

export interface Step {
  id: string;
  title: string;
  /** One line for the checklist and the docs page */
  summary: string;
  /** What the step does, one bullet each (docs page) */
  details: string[];
  /** Always runs; a failure aborts the whole run */
  required?: boolean;
  /** Homebrew formulae this step needs, installed even if CLI tools is unchecked */
  requires?: string[];
  check(ctx: Ctx): Promise<Status>;
  run(ctx: Ctx): Promise<void>;
  /** Manual follow-ups shown after the run */
  nextSteps?(ctx: Ctx): string[] | Promise<string[]>;
}
