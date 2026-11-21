import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { checkNav } from '../lib/check-nav.mjs';
import { navFileName, onBeforeBuild } from '../plugins/nav-gen.mjs';

const page = (outputPath, frontmatter = {}) => ({ outputPath, frontmatter });
const quiet = { warn() {}, info() {} };

/** Runs the plugin in a throwaway folder, since it writes its hand-off file to the cwd. */
async function generate(pages, config = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'nav-gen-test-'));
  const before = process.cwd();
  process.chdir(dir);
  try {
    await onBeforeBuild({ config, pages, tui: quiet });
  } finally {
    process.chdir(before);
  }
  return { dir, nav: config.navigation };
}

test('nav_order comes first, then titles alphabetically, and the home page leads', async () => {
  const { nav } = await generate([
    page('index.html', { title: 'Home' }),
    page('zebra/index.html', { title: 'Zebra', nav_order: 1 }),
    page('apple/index.html', { title: 'Apple', nav_order: 2 }),
    page('banana/index.html', { title: 'Banana' }),
    page('cherry/index.html', { title: 'Avocado' }),
  ]);

  assert.deepEqual(nav.map((n) => n.title), ['Overview', 'Zebra', 'Apple', 'Avocado', 'Banana']);
  assert.equal(nav[0].path, '/');
});

test('a folder with an index page is a linked group holding its children', async () => {
  const { nav } = await generate([
    page('guide/index.html', { title: 'Guide' }),
    page('guide/install/index.html', { title: 'Install', nav_order: 2 }),
    page('guide/first-steps/index.html', { nav_title: 'Start', title: 'First steps', nav_order: 1 }),
  ]);

  assert.equal(nav.length, 1);
  assert.equal(nav[0].path, '/guide/');
  assert.deepEqual(nav[0].children.map((c) => [c.title, c.path]), [
    ['Start', '/guide/first-steps/'],
    ['Install', '/guide/install/'],
  ]);
});

test('a path segment that is not lowercase fails', async () => {
  await assert.rejects(generate([page('Guide/index.html', { title: 'Guide' })]), /non-lowercase path segment 'Guide'/);
});

test('two pages with the same nav_order in one group fail', async () => {
  await assert.rejects(
    generate([
      page('guide/index.html', { title: 'Guide' }),
      page('guide/a/index.html', { title: 'A', nav_order: 1 }),
      page('guide/b/index.html', { title: 'B', nav_order: 1 }),
    ]),
    /duplicate nav_order 1/,
  );
});

test('a date-sorted group refuses an entry with no date', async () => {
  await assert.rejects(
    generate([
      page('log/index.html', { title: 'Log', nav_sort: 'date-desc' }),
      page('log/one/index.html', { title: 'One', date: '2026-01-02' }),
      page('log/two/index.html', { title: 'Two' }),
    ]),
    /dateless leaf 'two'/,
  );
});

test('a date-sorted group lists newest first', async () => {
  const { nav } = await generate([
    page('log/index.html', { title: 'Log', nav_sort: 'date-desc' }),
    page('log/old/index.html', { title: 'Old', date: '2026-01-02' }),
    page('log/new/index.html', { title: 'New', date: '2026-03-04' }),
  ]);
  assert.deepEqual(nav[0].children.map((c) => c.title), ['New', 'Old']);
});

test('the hand-off file is named per site when navGenId is set', async () => {
  assert.equal(navFileName({}), '.nav-generated.json');
  assert.equal(navFileName({ navGenId: 'public' }), '.nav-generated.public.json');

  const { dir } = await generate([page('index.html', { title: 'Home' })], { navGenId: 'public' });
  assert.ok(existsSync(path.join(dir, '.nav-generated.public.json')));
  assert.ok(!existsSync(path.join(dir, '.nav-generated.json')));
});

/** A repo with a config, a hand-off file and a built site holding the given routes. */
function builtRepo({ nav, routes, config = {}, navFile = '.nav-generated.json', out = 'site' }) {
  const root = mkdtempSync(path.join(tmpdir(), 'check-nav-test-'));
  writeFileSync(path.join(root, 'docmd.config.json'), JSON.stringify(config));
  if (nav) writeFileSync(path.join(root, navFile), JSON.stringify(nav));
  for (const route of routes) {
    const dir = path.join(root, out, route);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'index.html'), '<html></html>');
  }
  return root;
}

const NAV = [{ title: 'Overview', path: '/' }, { title: 'Guide', path: '/guide/', children: [{ title: 'Install', path: '/guide/install/' }] }];

test('check-nav passes when the sidebar and the built pages match', async () => {
  const root = builtRepo({ nav: NAV, routes: ['', 'guide', 'guide/install'] });
  assert.deepEqual(await checkNav({ root }), { ok: true, pages: 3, orphans: [], dead: [] });
});

test('check-nav reports a built page the sidebar does not link', async () => {
  const root = builtRepo({ nav: NAV, routes: ['', 'guide', 'guide/install', 'stale'] });
  const result = await checkNav({ root });
  assert.equal(result.ok, false);
  assert.deepEqual(result.orphans, ['/stale/']);
});

test('check-nav reports a sidebar link with no built page', async () => {
  const root = builtRepo({ nav: NAV, routes: ['', 'guide'] });
  const result = await checkNav({ root });
  assert.equal(result.ok, false);
  assert.deepEqual(result.dead, ['/guide/install/']);
});

test('check-nav fails when the hand-off file is missing', async () => {
  const root = builtRepo({ nav: null, routes: [''] });
  const result = await checkNav({ root });
  assert.equal(result.ok, false);
  assert.match(result.error, /\.nav-generated\.json not found/);
});

test('check-nav reads the hand-off file and output folder of the site it was asked about', async () => {
  // Two sites in one repo. The public site's nav exists; the default file must not be used for it.
  const root = builtRepo({
    nav: NAV,
    navFile: '.nav-generated.public.json',
    config: { navGenId: 'public', out: 'site-public' },
    out: 'site-public',
    routes: ['', 'guide', 'guide/install'],
  });
  assert.equal((await checkNav({ root })).ok, true);

  writeFileSync(path.join(root, 'other.json'), JSON.stringify({ navGenId: 'internal', out: 'site-public' }));
  const other = await checkNav({ root, configPath: 'other.json' });
  assert.equal(other.ok, false);
  assert.match(other.error, /\.nav-generated\.internal\.json not found/);
  assert.ok(readFileSync(path.join(root, '.nav-generated.public.json'), 'utf8').length > 0);
});
