// drawio: show a .drawio file as a rendered diagram on a docs page.
//
// Write an ordinary image link whose target ends in .drawio:
//
//     ![Planning screen](/assets/wireframes/interim-planning-screen.drawio)
//
// At build time the file's XML is read and inlined into the page, and the draw.io viewer script
// (vendored in drawio-vendor/, loaded only on pages that have a diagram) draws it in the
// browser. There is no export step, so the picture cannot drift from the source file.
//
// A path starting with "/" is taken from the repository root; anything else is relative to the page.
// A missing file, a file outside the repository, or a file that is not a draw.io diagram fails the
// build loudly rather than leaving a hole in the page.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const plugin = { name: 'drawio', version: '1.0.0', capabilities: ['build', 'post-build', 'assets'] };

/** The class the browser script looks for. Also the condition that loads the viewer on a page. */
export const MARKER = 'class="drawio-diagram"';

const IMAGE = /!\[([^\]]*)\]\(\s*([^)\s]+\.drawio)\s*\)/g;
const FENCE = /^\s*(`{3,}|~{3,})/;

const escapeAttr = (s) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const stats = { diagrams: 0, pages: new Set() };

function resolveDiagram(ref, pageFile, root) {
  const target = ref.startsWith('/')
    ? path.join(root, ref)
    : path.resolve(path.dirname(path.resolve(root, pageFile)), ref);
  const inside = path.relative(root, target);
  if (inside.startsWith('..') || path.isAbsolute(inside)) {
    throw new Error(`drawio: ${ref} in ${pageFile} points outside the repository`);
  }
  if (!existsSync(target)) {
    throw new Error(`drawio: ${ref} in ${pageFile} does not exist (looked for ${target})`);
  }
  return target;
}

/**
 * Replaces every `![alt](something.drawio)` outside a fenced code block with the HTML the viewer
 * draws into. Returns the new source and how many diagrams were embedded.
 */
export function embedDiagrams(src, pageFile, root = process.cwd()) {
  let count = 0;
  let fence = null;
  const out = src.split('\n').map((line) => {
    const mark = line.match(FENCE);
    if (mark) {
      const kind = mark[1][0];
      if (fence === null) fence = kind;
      else if (fence === kind) fence = null;
      return line;
    }
    if (fence !== null) return line;

    return line.replace(IMAGE, (_whole, alt, ref) => {
      const xml = readFileSync(resolveDiagram(ref, pageFile, root), 'utf8').trim();
      if (!xml.startsWith('<mxfile')) {
        throw new Error(`drawio: ${ref} in ${pageFile} is not a draw.io diagram (no <mxfile> root)`);
      }
      count += 1;
      const config = { xml, nav: false, resize: true, lightbox: false, highlight: '#2f6fd0' };
      const caption = alt ? `<figcaption>${escapeAttr(alt)}</figcaption>` : '';
      // Blank lines either side make it an HTML block, so markdown leaves it alone.
      return (
        '\n\n<figure class="drawio-figure" style="margin:1.25rem 0;overflow-x:auto">' +
        `<div ${MARKER} role="img" aria-label="${escapeAttr(alt)}" data-mxgraph="${escapeAttr(JSON.stringify(config))}"></div>` +
        `${caption}</figure>\n\n`
      );
    });
  });
  return { src: out.join('\n'), count };
}

export async function onBeforeParse(src, _frontmatter, filePath) {
  if (!src.includes('.drawio')) return src;
  const result = embedDiagrams(src, filePath);
  if (result.count > 0) {
    stats.diagrams += result.count;
    stats.pages.add(filePath);
  }
  return result.src;
}

export async function onPostBuild({ tui }) {
  const message = `drawio: embedded ${stats.diagrams} diagram(s) on ${stats.pages.size} page(s)`;
  if (tui && tui.info) tui.info(message);
  else console.log(message);
}

export function getAssets() {
  const condition = { pageHtmlMatches: MARKER };
  return [
    {
      src: path.join(here, 'drawio-vendor', 'viewer-static.min.js'),
      dest: 'assets/js/drawio-viewer.min.js',
      type: 'js',
      location: 'body',
      condition,
    },
    {
      src: path.join(here, 'drawio-vendor', 'drawio-init.js'),
      dest: 'assets/js/drawio-init.js',
      type: 'js',
      location: 'body',
      condition,
    },
  ];
}
