#!/usr/bin/env node
// docmd-kit: the build gates that go with the plugins.
//
//   docmd-kit check-nav    [--config <file>] [--out <dir>]
//   docmd-kit check-drawio [--config <file>] [--built]
//
// Run from the repository root. Each command says what it examined before its verdict, because
// "0 problems" from a check that read nothing is not a check.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { checkDrawio } from '../lib/check-drawio.mjs';
import { checkNav } from '../lib/check-nav.mjs';

const USAGE = `usage:
  docmd-kit check-nav    [--config <file>] [--out <dir>]
  docmd-kit check-drawio [--config <file>] [--built]`;

const [command, ...rest] = process.argv.slice(2);

function option(name) {
  const at = rest.indexOf(name);
  if (at === -1) return undefined;
  const value = rest[at + 1];
  if (value === undefined || value.startsWith('--')) {
    console.error(`${name} needs a value\n${USAGE}`);
    process.exit(2);
  }
  return value;
}

// A repository with several sites must name its config: guessing would quietly check the wrong one.
function configPath() {
  const given = option('--config');
  if (given) return given;
  if (existsSync(resolve(process.cwd(), 'docmd.config.json'))) return 'docmd.config.json';
  console.error(`no docmd.config.json here, so --config is required\n${USAGE}`);
  process.exit(2);
}

if (command === 'check-nav') {
  const result = await checkNav({ configPath: configPath(), outDir: option('--out') });
  if (result.error) {
    console.error(`nav check FAILED: ${result.error}`);
    process.exit(1);
  }
  console.log(`nav check: examined ${result.pages} built page(s)`);
  for (const page of result.orphans) console.error(`  unreachable: ${page}  (built, but nothing in the sidebar links to it)`);
  for (const page of result.dead) console.error(`  dead link:   ${page}  (in the sidebar, but no such page)`);
  if (!result.ok) {
    console.error('nav check FAILED: the generated nav and the built site disagree.');
    console.error('An unreachable page is one the plugin dropped, or a stale file in the output folder.');
    process.exit(1);
  }
  console.log('nav check ok');
} else if (command === 'check-drawio') {
  const result = checkDrawio({ configPath: configPath(), built: rest.includes('--built') });
  console.log(`drawio check: examined ${result.pages} page(s), found ${result.expected} diagram link(s)`);
  if (result.builtPages !== undefined) {
    console.log(`drawio check: examined ${result.builtPages} built page(s), found ${result.actual} embedded diagram(s)`);
  }
  if (!result.ok) {
    for (const problem of result.problems) console.error('  ' + problem);
    console.error('drawio check FAILED');
    process.exit(1);
  }
  console.log('drawio check ok');
} else {
  console.error(USAGE);
  process.exit(2);
}
