// The gate for the drawio plugin.
//
// docmd reports a plugin that throws, then still exits 0 and writes the page. A broken diagram
// link would therefore build "successfully" with a hole in it. This is what fails the build.
//
// Before the build: every .drawio link resolves to a real diagram.
// After the build (`built: true`): the site holds exactly as many diagrams as the sources link.
//
// It calls the plugin's own embedDiagrams, so there is one implementation of what counts as a
// diagram link, not two.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { embedDiagrams, MARKER } from '../plugins/drawio.mjs';

function walk(dir, extension, found = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, extension, found);
    else if (name.endsWith(extension)) found.push(full);
  }
  return found;
}

/**
 * @param {object} options
 * @param {string} [options.root]        repository root, where the docmd config lives
 * @param {string} [options.configPath]  docmd config, relative to root
 * @param {boolean} [options.built]      also count diagrams in the built site
 * @returns {{ok: boolean, pages: number, expected: number, problems: string[], builtPages?: number, actual?: number}}
 */
export function checkDrawio({ root = process.cwd(), configPath = 'docmd.config.json', built = false } = {}) {
  const configFile = path.resolve(root, configPath);
  if (!existsSync(configFile)) {
    return { ok: false, pages: 0, expected: 0, problems: [`config not found: ${configFile}`] };
  }
  const config = JSON.parse(readFileSync(configFile, 'utf8'));
  const source = path.join(root, config.src ?? 'docs');
  if (!existsSync(source)) {
    return { ok: false, pages: 0, expected: 0, problems: [`docs folder not found: ${source}`] };
  }

  const pages = walk(source, '.md');
  let expected = 0;
  const problems = [];
  for (const page of pages) {
    try {
      expected += embedDiagrams(readFileSync(page, 'utf8'), path.relative(root, page), root).count;
    } catch (error) {
      problems.push(error.message);
    }
  }
  const result = { ok: problems.length === 0, pages: pages.length, expected, problems };
  if (!built || !result.ok) return result;

  const site = path.join(root, config.out ?? 'site');
  if (!existsSync(site)) {
    return { ...result, ok: false, problems: [`built site not found: ${site}`] };
  }
  const html = walk(site, '.html');
  let actual = 0;
  for (const file of html) actual += readFileSync(file, 'utf8').split(MARKER).length - 1;
  if (actual !== expected) {
    problems.push(
      `the sources link ${expected} diagram(s) but the built site holds ${actual}. ` +
        'The plugin did not run on every page, or it failed part-way.',
    );
  }
  return { ...result, ok: problems.length === 0, builtPages: html.length, actual };
}
