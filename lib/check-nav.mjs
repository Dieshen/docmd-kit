// The gate for the nav-gen plugin: fails if a page was built but nothing in the sidebar links to
// it, or if the sidebar links to a page that was not built.
//
// The sidebar is generated: nav-gen derives it from the docs tree during the build and writes it
// to a hand-off file. This compares that file with the pages docmd actually wrote. It is not a
// tautology. The plugin builds the nav before rendering and docmd renders afterwards, so this
// catches a divergence between the two, and it catches a stale page left in the output folder.
import { existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { navFileName } from '../plugins/nav-gen.mjs';

async function builtPages(dir, base = '') {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      found.push(...(await builtPages(join(dir, entry.name), `${base}/${entry.name}`)));
    } else if (entry.name === 'index.html') {
      found.push(`${base}/`);
    }
  }
  return found;
}

/**
 * @param {object} options
 * @param {string} [options.root]        repository root, where the docmd config lives
 * @param {string} [options.configPath]  docmd config, relative to root
 * @param {string} [options.outDir]      built site to check instead of the config's `out`
 * @returns {Promise<{ok: boolean, pages: number, orphans: string[], dead: string[], error?: string}>}
 */
export async function checkNav({ root = process.cwd(), configPath = 'docmd.config.json', outDir } = {}) {
  const fail = (error) => ({ ok: false, pages: 0, orphans: [], dead: [], error });

  const configFile = resolve(root, configPath);
  if (!existsSync(configFile)) return fail(`config not found: ${configFile}`);
  const config = JSON.parse(readFileSync(configFile, 'utf8'));

  const navFile = join(root, navFileName(config));
  if (!existsSync(navFile)) {
    return fail(`${navFileName(config)} not found. Run the docmd build first; the nav-gen plugin writes it.`);
  }
  const navigation = JSON.parse(readFileSync(navFile, 'utf8'));

  const site = outDir ? resolve(root, outDir) : join(root, config.out ?? 'site');
  if (!existsSync(site)) return fail(`built site not found: ${site}`);

  const linked = new Set();
  (function walk(nodes) {
    for (const node of nodes ?? []) {
      if (node.path) linked.add(node.path);
      walk(node.children);
    }
  })(navigation);

  const pages = await builtPages(site);
  const orphans = pages.filter((page) => !linked.has(page));
  const dead = [...linked].filter((page) => !pages.includes(page));
  return { ok: orphans.length === 0 && dead.length === 0, pages: pages.length, orphans, dead };
}
