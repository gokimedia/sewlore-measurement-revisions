# Measurement Revisions

Compare measurement revisions for a sewing project while keeping the measuring-point labels, raw units, method notes, and original source files visible. The tool normalizes mm/cm/in values to millimetres and distinguishes changed, unchanged, added, and removed measurements.

By [Sewlore](https://sewlore.com/). Related methodology: [fabric measurement methods guide](https://sewlore.com/pages/fabric-measurement-methods-guide).

## Install locally

Requires Obsidian 1.14.4 or newer. Copy `main.js`, `manifest.json`, and `styles.css` into the plugin folder `sewlore-measurement-revisions` inside your vault's configured plugins directory. Enable community plugins and enable **Measurement Revisions**. Use a separate test vault before installing an initial release into a working project vault.

The bundle compiles against the official Obsidian 1.14.4 API and passes the official recommended Obsidian ESLint rules. Compiled-bundle workflow tests use an in-memory host-API harness. Native installation, visual appearance, and mobile operation have not yet been verified; `isDesktopOnly: false` indicates that the implementation uses Web/Obsidian APIs and no Node/Electron runtime dependencies, not a completed mobile test.

## Create a revision

Run **Measurement Revisions: Create revision** from the command palette. Enter a project label, revision label, date, and method notes. Paste three spreadsheet columns: label, value, unit. Columns must be separated by tabs; use decimal points and one of `mm`, `cm`, or `in`.

```text
bust	92	cm
sleeve	21.5	in
```

These are illustrative values, not physical measurements performed by Sewlore. Replace them with your actual readings. Measurement labels are case-sensitive and must be unique. Use a label only for the same physical measuring point and method across revisions.

The command creates a new note in `Sewlore measurements`. It does not overwrite a previous revision. Each note contains one authoritative JSON block:

````markdown
```sewlore-revision
{
  "schemaVersion": 1,
  "project": "Illustrative project",
  "revision": "A",
  "date": "2026-10-11",
  "notes": "Synthetic example; replace with actual method and readings.",
  "measurements": [
    { "label": "bust", "value": 92, "unit": "cm" }
  ]
}
```
````

You can edit this JSON directly or copy the whole note to make another revision. Each revision supports 1–200 positive measurements. **Validate active revision** checks the active note without changing it. Avoid putting multiple `sewlore-revision` blocks into the same note; ambiguous data is rejected.

## Compare

Run **Compare two revisions**. Choose the before note, then the after note. Both must have exactly the same project label. Matching measurement labels are compared after unit normalization:

- `delta mm = after mm − before mm`
- `delta % = delta mm ÷ before mm × 100`
- A positive result means the after dimension is larger.
- Added and removed labels have no percent change because one baseline is absent.
- Equivalent measurements in different units are marked unchanged, allowing only floating-point rounding slack.

For example, 100 cm followed by 1020 mm is +20 mm, or +2%. This is an arithmetic example, not a garment-fit claim. The tool does not apply a fit tolerance, recommend altering a garment, certify fabric quality, or average unrelated points.

Review the table and optionally choose **Save separate comparison note**. The new report records the two source paths and method notes in `Sewlore comparisons`. Original revision files remain unchanged. No website or attribution link is inserted into your notes.

## Privacy and files

No network, account, telemetry, payment, external ads, or access outside the vault is required. The chooser examines Markdown file paths, then reads only the two selected notes (or the active note when validating). File writes occur only when you create a revision or explicitly save a comparison. Existing notes are not edited or deleted. Vault synchronization remains controlled by your normal Obsidian setup. See [PRIVACY.md](PRIVACY.md).

## Build and verify

```sh
npm ci --ignore-scripts --legacy-peer-deps
npm test
npm run lint
node release.mjs
```

Node 20 or newer builds the bundle; Python 3 is needed only for the release ZIP helper. The lockfile pins the official API and build tools. `--legacy-peer-deps` is needed because eslint-plugin-obsidianmd 0.4.2 declares a peer API version of 1.8.7 while this package type-checks against the current official 1.14.4 API. No lint rule is disabled to hide that difference.

Tests exercise mixed units, sign conventions, added/removed points, case-sensitive labels, duplicate/invalid values, fenced JSON parsing, Markdown escaping, compiled commands, cancelled/invalid writes, and separate comparison reports. The lint configuration uses the official recommended rules. `release.mjs` creates reproducible release files and a source ZIP. This package is not yet published in the community directory; native application testing remains separate from these checks.

## License

MIT © 2026 Sewlore. No runtime dependency is bundled beyond this package's own code; `obsidian` remains a host import. This is an independent community tool, not an official Obsidian product.
