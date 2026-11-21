import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { embedDiagrams, MARKER } from '../plugins/drawio.mjs';

const DIAGRAM = '<mxfile host="test"><diagram name="A &quot;quoted&quot; one"><mxGraphModel/></diagram></mxfile>';

/** A throwaway repository: docs/guide/page.md, assets/a.drawio, docs/guide/local.drawio. */
function repo() {
  const root = mkdtempSync(path.join(tmpdir(), 'drawio-test-'));
  mkdirSync(path.join(root, 'docs', 'guide'), { recursive: true });
  mkdirSync(path.join(root, 'assets'), { recursive: true });
  writeFileSync(path.join(root, 'assets', 'a.drawio'), DIAGRAM);
  writeFileSync(path.join(root, 'docs', 'guide', 'local.drawio'), DIAGRAM);
  writeFileSync(path.join(root, 'assets', 'not-a-diagram.drawio'), '<svg/>');
  return root;
}

const PAGE = path.join('docs', 'guide', 'page.md');

test('a root-relative .drawio image becomes a diagram holding the file XML', () => {
  const root = repo();
  const { src, count } = embedDiagrams('Before\n\n![Plan](/assets/a.drawio)\n\nAfter', PAGE, root);

  assert.equal(count, 1);
  assert.ok(src.includes(MARKER));
  assert.ok(!src.includes('![Plan]'), 'the image link must be gone');
  assert.ok(src.includes('<figcaption>Plan</figcaption>'));
  assert.ok(src.startsWith('Before') && src.trimEnd().endsWith('After'));

  // The XML must survive the round trip through the attribute exactly.
  const attr = src.match(/data-mxgraph="([^"]*)"/)[1];
  const decoded = attr.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  assert.equal(JSON.parse(decoded).xml, DIAGRAM);
});

test('a path with no leading slash is relative to the page', () => {
  const root = repo();
  const { count } = embedDiagrams('![Local](local.drawio)', PAGE, root);
  assert.equal(count, 1);
});

test('two diagrams on one page are both embedded', () => {
  const root = repo();
  const { src, count } = embedDiagrams('![One](/assets/a.drawio)\n\n![Two](local.drawio)', PAGE, root);
  assert.equal(count, 2);
  assert.equal(src.split(MARKER).length - 1, 2);
});

test('a .drawio link inside a fenced code block is left alone', () => {
  const root = repo();
  const page = 'Text\n\n```markdown\n![Plan](/assets/a.drawio)\n```\n\n~~~\n![Plan](/assets/missing.drawio)\n~~~\n';
  const { src, count } = embedDiagrams(page, PAGE, root);
  assert.equal(count, 0);
  assert.equal(src, page);
});

test('ordinary images are untouched', () => {
  const root = repo();
  const page = '![Logo](/assets/logo.svg) and ![Shot](shot.png)';
  assert.deepEqual(embedDiagrams(page, PAGE, root), { src: page, count: 0 });
});

test('a missing file fails, naming the page and the link', () => {
  const root = repo();
  assert.throws(
    () => embedDiagrams('![Gone](/assets/gone.drawio)', PAGE, root),
    (error) => error.message.includes('/assets/gone.drawio') && error.message.includes('page.md') && error.message.includes('does not exist'),
  );
});

test('a path that climbs out of the repository fails', () => {
  const root = repo();
  writeFileSync(path.join(root, '..', 'outside.drawio'), DIAGRAM);
  assert.throws(() => embedDiagrams('![Out](../../../outside.drawio)', PAGE, root), /outside the repository/);
});

test('a file that is not a draw.io diagram fails', () => {
  const root = repo();
  assert.throws(() => embedDiagrams('![Bad](/assets/not-a-diagram.drawio)', PAGE, root), /not a draw\.io diagram/);
});
