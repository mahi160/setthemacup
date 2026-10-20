import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** Plain-text run log: every command, its output, and each step's outcome. */
export class Logger {
  readonly path: string;

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.path = join(dir, `${stamp}.log`);
  }

  write(line: string): void {
    appendFileSync(this.path, line.endsWith('\n') ? line : `${line}\n`);
  }

  section(title: string): void {
    this.write(`\n=== ${title} ${'='.repeat(Math.max(0, 70 - title.length))}`);
  }
}
