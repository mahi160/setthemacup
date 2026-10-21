import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apps, taps } from './data/apps.ts';
import { defaults, type Default } from './data/defaults.ts';
import { matches, writeArgs } from './lib/defaults.ts';
import { plist } from './lib/launchd.ts';
import { parsePlan } from './lib/stow.ts';
import { parse, select } from './plan.ts';
import { steps } from './steps/index.ts';

test('select keeps registry order and always includes required steps', () => {
  assert.deepEqual(select(steps, { only: ['macos', 'dotfiles'], skip: [] }).map((s) => s.id), ['homebrew', 'dotfiles', 'macos']);
  assert.ok(!select(steps, { only: [], skip: ['apps'] }).some((s) => s.id === 'apps'));
  assert.throws(() => select(steps, { only: ['nope'], skip: [] }), /unknown step: nope/);
});

test('parse reads flags and comma lists', () => {
  const a = parse(['-n', '--only', 'git, nvim']);
  assert.equal(a.dryRun, true);
  assert.deepEqual(a.only, ['git', 'nvim']);
  assert.throws(() => parse(['--bogus']));
});

test('step ids are unique', () => {
  assert.equal(new Set(steps.map((s) => s.id)).size, steps.length);
});

test('apps: unique names, taps derived from tap-qualified names', () => {
  assert.equal(new Set(apps.map((a) => a.name)).size, apps.length);
  assert.deepEqual(taps('cask').sort(), ['abue-ammar/tinycast', 'mahi160/tbis']);
});

test('defaults: every domain/key/host combination appears once', () => {
  const keys = defaults.map((d) => `${d.currentHost ? 'host:' : ''}${d.domain}:${d.key}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('defaults: value matching per type', () => {
  const row = (type: Default['type'], value: Default['value']): Default => ({ group: 'g', domain: 'd', key: 'k', type, value, desc: '' });
  assert.ok(matches(row('bool', true), '1\n', '/h'));
  assert.ok(!matches(row('bool', true), '0', '/h'));
  assert.ok(matches(row('float', 0.001), '0.001', '/h'));
  assert.ok(matches(row('int', 2), '2', '/h'));
  assert.ok(matches(row('string', '$HOME/Downloads'), '/h/Downloads', '/h'));
  assert.ok(!matches(row('string', 'png'), undefined, '/h'));
});

test('defaults: -currentHost on the global domain uses -g', () => {
  const d: Default = { group: 'g', domain: 'NSGlobalDomain', key: 'K', type: 'int', value: 6, desc: '', currentHost: true };
  assert.deepEqual(writeArgs(d, '/h'), ['-currentHost', 'write', '-g', 'K', '-int', '6']);
});

test('stow plan parses links and both conflict formats', () => {
  const out = [
    'LINK: .zshrc => .setup/dotfiles/zsh/.zshrc',
    'LINK: .zshenv => .setup/dotfiles/zsh/.zshenv',
    '  * existing target is neither a link nor a directory: .gitconfig',
    '  * cannot stow ../x over existing target .ssh/config since neither a link nor a directory and --adopt not specified',
  ].join('\n');
  assert.deepEqual(parsePlan(out), { links: 2, conflicts: ['.gitconfig', '.ssh/config'] });
});

test('launchd plist escapes arguments and adds a weekly schedule', () => {
  const xml = plist({ name: 'job', program: ['/bin/echo', 'a & b'], weekly: { weekday: 0, hour: 3 } });
  assert.match(xml, /<string>com\.setthemacup\.job<\/string>/);
  assert.match(xml, /<string>a &amp; b<\/string>/);
  assert.match(xml, /<key>Hour<\/key><integer>3<\/integer>/);
});

test('sync: first run is a baseline — nothing added or removed', async () => {
  const { diff } = await import('./lib/sync.ts');
  const m = { formulae: [{ name: 'git', category: 'Git', desc: '' }], casks: [], pnpm: [], skills: [] };
  const inv = { formulae: ['git', 'starship'], casks: [], pnpm: [], skills: {} };
  const ignore = { formulae: [], casks: [], skills: [], pnpm: [] };
  const c = diff(m, inv, undefined, ignore);
  assert.deepEqual(c.formulae, { added: [], removed: [] });
});

test('sync: new installs are added, uninstalled manifest items removed, old leftovers ignored', async () => {
  const { diff, apply } = await import('./lib/sync.ts');
  const m = {
    formulae: [{ name: 'git', category: 'Git', desc: '' }, { name: 'tmux', category: 'Terminal', desc: '' }],
    casks: [],
    pnpm: [],
    skills: [{ repo: 'a/b', skills: ['one'], desc: '' }],
  };
  const before = { formulae: ['git', 'tmux', 'starship'], casks: [], pnpm: [], skills: { one: 'a/b' } };
  const now = { formulae: ['git', 'starship', 'jq', 'fnm'], casks: [], pnpm: [], skills: { one: 'a/b', two: 'a/b', three: 'c/d' } };
  const ignore = { formulae: ['fnm'], casks: [], skills: [], pnpm: [] };
  const c = diff(m, now, before, ignore);
  assert.deepEqual(c.formulae, { added: ['jq'], removed: ['tmux'] });
  assert.deepEqual(c.skills, { added: ['two', 'three'], removed: [] });
  const next = await apply(m, c, now, async (_k, names) => Object.fromEntries(names.map((n) => [n, `desc of ${n}`])));
  assert.deepEqual(next.formulae.map((p) => `${p.name}:${p.category}`), ['git:Git', 'jq:Inbox']);
  assert.deepEqual(next.skills, [
    { repo: 'a/b', skills: ['one', 'two'], desc: '' },
    { repo: 'c/d', skills: ['three'], desc: 'Inbox' },
  ]);
});

test('brew progress: counts finished packages and shortens URLs', async () => {
  const { brewProgress } = await import('./lib/brew.ts');
  const seen: string[] = [];
  const onLine = brewProgress(2, (m) => seen.push(m));
  onLine('==> Downloading https://example.com/files/Transmission-4.1.3.dmg');
  onLine('==> Installing Cask transmission');
  onLine('🍺  transmission was successfully installed!');
  onLine('==> Installing Cask tbis');
  assert.deepEqual(seen, ['[0/2] Downloading Transmission-4.1.3.dmg', '[0/2] Installing Cask transmission', '[1/2] Installing Cask tbis']);
});

test('shell streams output lines, including \\r-redrawn ones', async () => {
  const { Shell } = await import('./lib/sh.ts');
  const { Logger } = await import('./lib/log.ts');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const sh = new Shell(new Logger(mkdtempSync(`${tmpdir()}/sh-`)), false);
  const lines: string[] = [];
  await sh.run('/bin/bash', ['-c', "printf 'a\\nb\\rc\\n'; echo err >&2"], { onLine: (l) => lines.push(l) });
  assert.deepEqual(lines.sort(), ['a', 'b', 'c', 'err']);
});
