import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { checkDrawio } from '../lib/check-drawio.mjs';
import { MARKER } from '../plugins/drawio.mjs';

const DIAGRAM = '<mxfile><diagram><mxGraphModel/></diagram></mxfile>';

/** A repo with one page linking `links` diagrams and a built site holding `embedded` of them. */
function repo({ links = ['/assets/a.drawio'], embedded = 1, config = {}, src = 'docs', out = 'site' } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'check-drawio-test-'));
  writeFileSync(path.join(root, 'docmd.config.json'), JSON.stringify(config));
  mkdirSync(path.join(root, src), { recursive: true });
  mkdirSync(path.join(root, 'assets'), { recursive: true });
  mkdirSync(path.join(root, out), { recursive: true });
  writeFileSync(path.join(root, 'assets', 'a.drawio'), DIAGRAM);
  writeFileSync(path.join(root, src, 'index.md'), links.map((l) => `![Screen](${l})`).join('\n\n'));
  writeFileSync(path.join(root, src, 'plain.md'), '# No diagrams here');
  writeFileSync(path.join(root, out, 'index.html'), `<div ${MARKER}></div>`.repeat(embedded));
  return root;
}

test('before the build, resolvable links pass and are counted', () => {
  const result = checkDrawio({ root: repo() });
  assert.deepEqual(result, { ok: true, pages: 2, expected: 1, problems: [] });
});

test('a link to a missing diagram fails and names it', () => {
  const result = checkDrawio({ root: repo({ links: ['/assets/a.drawio', '/assets/gone.drawio'] }) });
  assert.equal(result.ok, false);
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], /gone\.drawio/);
});

test('after the build, a matching count passes', () => {
  const result = checkDrawio({ root: repo(), built: true });
  assert.equal(result.ok, true);
  assert.equal(result.actual, 1);
  assert.equal(result.builtPages, 1);
});

test('after the build, a site holding fewer diagrams than the sources link fails', () => {
  const result = checkDrawio({ root: repo({ embedded: 0 }), built: true });
  assert.equal(result.ok, false);
  assert.match(result.problems[0], /link 1 diagram\(s\) but the built site holds 0/);
});

test('the docs and output folders come from the config', () => {
  const root = repo({ config: { src: 'pages', out: 'public' }, src: 'pages', out: 'public' });
  const result = checkDrawio({ root, built: true });
  assert.equal(result.ok, true);
  assert.equal(result.pages, 2);
});

test('a missing config or docs folder fails instead of examining nothing', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'check-drawio-empty-'));
  assert.equal(checkDrawio({ root }).ok, false);
  writeFileSync(path.join(root, 'docmd.config.json'), '{}');
  const result = checkDrawio({ root });
  assert.equal(result.ok, false);
  assert.match(result.problems[0], /docs folder not found/);
});
