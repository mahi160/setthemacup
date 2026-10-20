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
