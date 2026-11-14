<!-- Written by WittyModule's kit/module-kit.sh from kit/sdui: don't edit, run module-kit.sh again. -->

# The module SDUI kit, for web modules

Every module carries its own SDUI: a file called `sdui.json` beside `module.json`, which
says what the module adds to every app — its pages, the sections it puts into built-in
pages, the components and data sources it brings, its menu entries, how its settings are
drawn, and its theme scope. The server reads it, checks it against its catalogue, and
refuses a module of the current API version without one. The format is described in the
server's `docs/SDUI-MODULES.md`; this folder is the TypeScript and JSON half of the kit
(the Go half is the `sdui` package of WittyModule).

`kit/module-kit.sh` copies this folder's library into every web module's repository, at
`sdui/kit/`, so a module builds its SDUI from what is in its own repository. Don't edit
those copies: they are written again each time `module-kit.sh` runs. Change the files
here instead.

| File | What it is |
|---|---|
| `wittymodule-sdui.ts` | The types of the whole file, constructors for common sections, and `checkModuleUI` |
| `write-sdui.mjs` | Writes `sdui.json` from a definition in TypeScript, or checks one written by hand |
| `catalog.json` | The catalogue the kit checks against (a copy of WittyModule's `sdui/catalog.json`) |
| `sdui-module.schema.json` | The JSON Schema of `sdui.json` (a copy of WittyModule's `sdui/sdui-module.schema.json`) |

There are two ways to write a module's SDUI. Either way the result is the same file.

## 1. Write `sdui.json` by hand

Write the JSON yourself and let your editor check it as you type against
`sdui/kit/sdui-module.schema.json`. Name it at the top of the file and most editors pick it
up on their own; the server ignores the field:

```json
{ "$schema": "./sdui/kit/sdui-module.schema.json", "format": "wittymodule-sdui", "formatVersion": 1, … }
```

Or map it in the editor's settings. In VS Code, `.vscode/settings.json`:
`{"json.schemas": [{"fileMatch": ["/sdui.json"], "url": "./sdui/kit/sdui-module.schema.json"}]}`;
in JetBrains editors: Settings → Languages & Frameworks → Schemas and DTDs → JSON Schema
Mappings. The schema checks the file's shape: the fields there are and their types.
Check the rest — names, the catalogue, templates, settings — before a release with:

```sh
node sdui/kit/write-sdui.mjs --check sdui.json
```

## 2. Define it in TypeScript and write it

Write `sdui/sdui.ts` with the kit's types and helpers, and have the build write
`sdui.json` from it. The editor completes and checks every name the catalogue has
(components, sources, icons, card styles, page kinds, form factors, ...).

```ts
// sdui/sdui.ts
import { defineModuleUI, moduleUI, shelf, notice, nativeView } from './kit/wittymodule-sdui.ts'

export default defineModuleUI({
  ...moduleUI('wittystats', { theme: { label: 'Statistics' } }),
  views: [{ id: 'wittystats.dashboard', label: 'Statistics', platforms: ['web', 'desktop'] }],
  pages: [
    {
      id: 'wittystats',
      kind: 'custom',
      title: 'Statistics',
      icon: 'chart',
      sections: [
        nativeView('stats', 'wittystats.dashboard', [notice('stats-web', 'Statistics are on the web app.')]),
      ],
    },
  ],
  navigation: [{ id: 'wittystats', type: 'page', page: 'wittystats', placement: { phone: 'more' } }],
})
```

```jsonc
// package.json
"scripts": {
  "build:sdui": "node sdui/kit/write-sdui.mjs sdui/sdui.ts sdui.json"
}
```

`write-sdui.mjs` imports the definition (its default export, or `export const ui`; a
function returning one works too), checks it with `checkModuleUI` against the module's ID
from the nearest `module.json` (or `--module <id>`), prints every issue, and on an error
writes nothing and exits with 1. Warnings are printed and don't stop it. It needs Node
22.6 or later; on a Node that doesn't strip types by default it turns type stripping on
itself. Commit the `sdui.json` it writes: it is what a release carries.

If your `tsconfig.json` covers `sdui/`, it needs `"allowImportingTsExtensions": true`
(with `noEmit`) and `"resolveJsonModule": true`, since the kit is imported by its `.ts`
name and reads the catalogue as JSON. Vite and esbuild need nothing.

### What the library has

- **Types** for the whole file: `ModuleUI`, `Page`, `Section`, `Source`, `Condition`,
  `NavItem`, `ModuleComponent`, `ModuleSource`, `ModuleView`, `ModuleInsert`,
  `ModulePreset`, `ModuleTheme`, `SettingsPage`, `SettingRow` (one shape per kind of
  setting), `PropSpec`, `EnumOption`, `Issue`; and unions of what the catalogue offers:
  `Icon`, `CardStyle`, `CatalogComponent`, `CatalogSource`, `PageKind`, `ModulePageKind`,
  `FormFactor`, `Platform`, `Placement`, `ItemKind`, `PropType`, `SettingKind`,
  `SettingScope`, `ColorToken`, `StockPageID`, ...
- **Helpers**: `defineModuleUI(ui)` (returns it, typed), `moduleUI(id, rest)` (fills in
  format, version, catalogue revision and the theme scope), and constructors for sections:
  `shelf`, `grid`, `hero`, `text`, `notice`, `nativeView`, and `section` for any other.
- **Checks**: `checkModuleUI(ui, moduleId)` returns `Issue[]` (`{path, severity, message,
  fix}`, as the server's); `hasErrors`, `formatIssues`, `checkSetting`, `validRoute`,
  `validURL`, `isColour`, `moduleOf`, `validModuleID`.

## What is checked here, and what only the server checks

`checkModuleUI` makes the server's own checks of a module's file (`ValidateModuleUI` in
the server's `pkg/sdui`) as far as they can be made without a server: the file's shape
(unknown fields and wrong types, which the server refuses outright), format, version,
module ID and catalogue revision; the naming rules (pages, inserts, presets, menu entries
and settings pages are `<module>` or `<module>-…`; sources and views `<module>.<camelName>`;
components `<module>.<PascalName>`); the theme scope and its colours; that every
component, source, icon, card style and page kind is the catalogue's or the module's own,
and that nothing is another module's; each component's template (every `{{name}}` is a
declared property, and the template filled in is a valid section); every page, insert and
preset as the page editor checks them; the navigation; the settings (kinds, keys, scopes,
secrets, defaults within min, max and options); and the limits.

It knows what this copy of the catalogue knows, and the server's built-in pages and theme
colour tokens as of catalogue revision 2. `wittymodule check` and the server make the full
check with their own catalogue, so they have the last word; a module installed beside
others is also checked against them there (two modules can't claim the same name).

## Working on the kit (in WittyModule)

```sh
node --test kit/sdui/tests/*.test.mjs
```

Node 22.18 or 23.6 and later strip types by default; on an earlier Node 22 add
`--experimental-strip-types`. The tests check the server's example module
(`tests/fixtures/module-boardgames.json`) passes, that a broken variant of it for each rule
is caught (`tests/variants.mjs`), that `write-sdui.mjs` writes the example from a
TypeScript definition, that the kit's type lists are the catalogue's, and that
`catalog.json` and `sdui-module.schema.json` here are the same as in `sdui/` — copy them
again when the catalogue changes, and update `STOCK_PAGES` and `COLOR_TOKENS` in
`wittymodule-sdui.ts` when the server's built-in pages or theme colours change.
