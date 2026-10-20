import { spawn } from 'node:child_process';
import type { Logger } from './log.ts';

export interface RunOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  /** Written to stdin */
  input?: string;
  /** Inherit the terminal (prompts, passwords). Output is not captured. */
  interactive?: boolean;
  /** Resolve instead of throwing on a non-zero exit */
  allowFail?: boolean;
}

export interface Result {
  code: number;
  stdout: string;
  stderr: string;
  ok: boolean;
}

export class CommandError extends Error {
  readonly result: Result;

  constructor(cmd: string, result: Result) {
    const tail = (result.stderr || result.stdout).trim().split('\n').slice(-12).join('\n');
    super(`${cmd} exited with ${result.code}${tail ? `\n${tail}` : ''}`);
    this.result = result;
  }
}

const quote = (s: string) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);
export const display = (cmd: string, args: string[]) => [cmd, ...args].map(quote).join(' ');

/**
 * Process runner. `capture` is for read-only queries and always runs;
 * `run` changes the system, so it is logged and skipped under --dry-run.
 */
export class Shell {
  private readonly log: Logger;
  private readonly dryRun: boolean;
  /** Commands that --dry-run would have executed */
  readonly planned: string[] = [];

  constructor(log: Logger, dryRun: boolean) {
    this.log = log;
    this.dryRun = dryRun;
  }

  capture(cmd: string, args: string[] = [], opts: RunOptions = {}): Promise<Result> {
    return this.exec(cmd, args, { ...opts, allowFail: opts.allowFail ?? true }, false);
  }

  async ok(cmd: string, args: string[] = []): Promise<boolean> {
    return (await this.capture(cmd, args)).ok;
  }

  run(cmd: string, args: string[] = [], opts: RunOptions = {}): Promise<Result> {
    if (this.dryRun) {
      const line = display(cmd, args);
      this.planned.push(line);
      this.log.write(`[dry-run] $ ${line}`);
      return Promise.resolve({ code: 0, stdout: '', stderr: '', ok: true });
    }
    return this.exec(cmd, args, opts, true);
  }

  /** `bash -c` for pipelines; prefer `run` with an argv elsewhere */
  bash(script: string, opts: RunOptions = {}): Promise<Result> {
    return this.run('/bin/bash', ['-c', script], opts);
  }

  has(bin: string): Promise<boolean> {
    return this.ok('/bin/bash', ['-c', `command -v ${quote(bin)}`]);
  }

  private exec(cmd: string, args: string[], opts: RunOptions, logIt: boolean): Promise<Result> {
    const line = display(cmd, args);
    if (logIt) this.log.write(`$ ${line}`);
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        cwd: opts.cwd,
        env: { ...process.env, ...opts.env },
        stdio: opts.interactive ? 'inherit' : ['pipe', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (d: Buffer) => (stdout += d));
      child.stderr?.on('data', (d: Buffer) => (stderr += d));
      if (!opts.interactive) child.stdin?.end(opts.input ?? '');
      child.on('error', (err) => {
        const result = { code: 127, stdout, stderr: String(err.message), ok: false };
        if (logIt) this.log.write(`  ! ${err.message}`);
        opts.allowFail ? resolve(result) : reject(new CommandError(line, result));
      });
      child.on('close', (code) => {
        const result = { code: code ?? 1, stdout, stderr, ok: code === 0 };
        if (logIt) {
          const out = `${stdout}${stderr}`.trimEnd();
          if (out) this.log.write(out.replace(/^/gm, '  '));
          if (!result.ok) this.log.write(`  ! exit ${result.code}`);
        }
        result.ok || opts.allowFail ? resolve(result) : reject(new CommandError(line, result));
      });
    });
  }
}
