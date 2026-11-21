# Vendored: draw.io viewer

`viewer-static.min.js` is the standalone diagram viewer from the draw.io project. It is not written here and should not be edited.

| | |
|---|---|
| Source | https://viewer.diagrams.net/js/viewer-static.min.js |
| Project | https://github.com/jgraph/drawio |
| Licence | Apache License 2.0 |
| Version | 32.7.5 |
| Downloaded | 2026-11-21 |
| SHA-256 | `E6223A15CDD7DF2012B618102456360747844C6C7E8F2C7BE692BB4B4EEA541F` |
| Size | 4.87 MB |

It is loaded only on pages that contain a diagram, by `bin/drawio.mjs`.

The script contains addresses for services it can talk to in other settings (cloud storage, fonts, an online converter). The docs site only asks it to draw XML that is already in the page.

To update: download the file again from the source above, replace this copy, and update the version, date and hash in this table.

`drawio-init.js` beside it is ours. It tells the viewer to draw each diagram, and again after every page change.
