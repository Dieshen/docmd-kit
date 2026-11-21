# docmd-kit

Plugins and build gates for [docmd](https://docmd.io) sites.

| Part | What it does |
|---|---|
| `nav-gen` plugin | Builds the sidebar from the docs folder tree and page frontmatter, so there is no navigation array to keep in step by hand |
| `drawio` plugin | Shows a `.drawio` file as a rendered diagram, read straight from the source file at build time |
| `docmd-kit check-nav` | Fails the build if a built page is missing from the sidebar, or the sidebar links to a page that was not built |
| `docmd-kit check-drawio` | Fails the build if a diagram link is broken, or the built site holds fewer diagrams than the sources link |

The two checks exist because docmd reports a plugin that throws and then still exits 0. Without them a broken build looks like a successful one.

## Install

Pinned to a tag, straight from GitHub. There is no registry to log in to, and it is the same command locally and in CI.

```json
{
  "devDependencies": {
    "@docmd/core": "^0.10.1",
    "docmd-kit": "github:Dieshen/docmd-kit#v0.1.0"
  }
}
```

## Configure

In `docmd.config.json`:

```json
{
  "plugins": {
    "docmd-kit/nav-gen": {},
    "docmd-kit/drawio": {}
  }
}
```

In `package.json`, wrap the build with the checks:

```json
{
  "scripts": {
    "build": "docmd-kit check-drawio && docmd build && docmd-kit check-drawio --built && docmd-kit check-nav"
  }
}
```

Clear the output folder before building. A page deleted from the sources otherwise stays in the output, and `check-nav` will report it as unreachable.

## nav-gen

The sidebar follows the folder tree under your docs folder. Frontmatter controls the rest:

| Field | Effect |
|---|---|
| `title` | The label, unless `nav_title` is set |
| `nav_title` | A shorter label for the sidebar |
| `nav_order` | A number. Lower comes first. Pages without one follow, by title |
| `nav_icon` | Icon name |
| `nav_sort: date-desc` | On a folder's `index.md`: sort its pages newest first, by their `date` |
| `nav_collapsed: true` | On a folder's `index.md`: start collapsed |

The build fails on:

- a path segment that is not lowercase (it works on Windows and 404s on Linux)
- two pages with the same `nav_order` in one folder
- a page with no `date` in a date-sorted folder

A folder with no `index.md` becomes an expander with no page of its own, with a warning.

### More than one site in a repository

Set `navGenId` in each docmd config. Each site then gets its own hand-off file, so one site's sidebar is never checked against another site's pages.

```json
{ "navGenId": "public", "out": "site-public" }
```

```bash
docmd build -c docmd.public.json && docmd-kit check-nav --config docmd.public.json
```

## drawio

Link a diagram the way you would link an image:

```markdown
![What the screen shows](/assets/wireframes/my-screen.drawio)
```

A path starting with `/` is taken from the repository root. Any other path is relative to the page. The alt text becomes the caption.

There is no export step. Edit the `.drawio` file, rebuild, and the page is current.

Links inside fenced code blocks are left alone.

The diagram is drawn in the browser by draw.io's own viewer, which is vendored in this package and loaded only on pages that contain a diagram. See [plugins/drawio-vendor/NOTICE.md](plugins/drawio-vendor/NOTICE.md) for its source, version and licence.

Known limits:

- A drawn diagram keeps the width it had when the page loaded.
- Diagrams do not follow a dark theme. Give them a background if they need one.

## Commands

```text
docmd-kit check-nav    [--config <file>] [--out <dir>]
docmd-kit check-drawio [--config <file>] [--built]
```

Run them from the repository root. `--config` defaults to `docmd.config.json` when that file exists. `--out` checks a different built folder, for a staged build.

Each command prints what it examined before its verdict.

## Development

```bash
npm test
```

There is no build step. Before trusting a change to a check, break the code it guards and confirm a test goes red.
