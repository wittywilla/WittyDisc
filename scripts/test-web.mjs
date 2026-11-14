// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// WittyDisc's web part, checked without a browser: what integration.json claims is what register()
// hands over, and every part of the app a screen imports (@wms/app/<path>) is one the app shares
// with modules (WittyModule kit/web/app-exports.json, from WITTYMODULE or ../WittyModule). Builds
// register() with esbuild, with stand-ins for the app.
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const integration = JSON.parse(readFileSync(join(root, 'integration.json'), 'utf8'))
const kit = [process.env.WITTYMODULE, join(root, '../WittyModule'), join(root, '../s14-WittyModule')].filter(Boolean).find((d) => existsSync(join(d, 'kit/web/app-exports.json')))

test('every @wms/app import is one the app shares', { skip: !kit && 'no WittyModule checkout' }, () => {
  const shared = JSON.parse(readFileSync(join(kit, 'kit/web/app-exports.json'), 'utf8')).app
  const dir = join(root, 'web/app')
  for (const f of readdirSync(dir).filter((n) => /\.tsx?$/.test(n))) {
    const src = readFileSync(join(dir, f), 'utf8')
    for (const m of src.matchAll(/import\s+(type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s+'@wms\/app\/([^']+)'/g)) {
      const [, onlyTypes, def, named, asked] = m
      if (onlyTypes) continue
      // A folder's own index, as the builder finds it: @wms/app/ui is ui/index.
      const path = shared[asked] ? asked : asked + '/index'
      assert.ok(shared[path], `${f}: @wms/app/${asked} isn't shared with modules`)
      if (def) assert.ok(shared[path].includes('default'), `${f}: @wms/app/${asked} has no default export`)
      for (const n of (named || '').split(',').map((s) => s.trim()).filter((s) => s && !s.startsWith('type ')).map((s) => s.split(/\s+as\s+/)[0])) {
        assert.ok(shared[path].includes(n), `${f}: @wms/app/${asked} doesn't export ${n}`)
      }
    }
  }
})

test('register() hands over what integration.json claims', async () => {
  const out = join(root, 'web/app/.register.tmp.mjs')
  const stub = { name: 'stubs', setup(b) {
    b.onResolve({ filter: /^@wms\/app\/|^\.\/(DiscPlayer|DiscSettings|DiscDialogs)$/ }, (a) => ({ path: a.path, namespace: 'stub' }))
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default () => null; export const DiscSettingsDialog = () => null; export const DiscNamesDialog = () => null; export const toast = () => null', loader: 'js' }))
  } }
  await build({ entryPoints: [join(root, 'web/app/register.tsx')], outfile: out, bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', logLevel: 'warning', plugins: [stub], external: ['react', 'react/jsx-runtime'] })
  try {
    const { register } = await import(out)
    const r = register({})
    assert.deepEqual(Object.keys(r.players).sort(), integration.web.players.map((x) => x.mediaKind).sort())
    assert.deepEqual(Object.keys(r.settings).sort(), integration.web.settings.map((x) => x.id).sort())
    // A title's menu: an administrator's tools, none for anyone else, and no names for an encrypted disc.
    assert.deepEqual(r.itemMenu.disc({ id: 1, kind: 'dvd-iso' }, { admin: true }).map((e) => e.key), ['disc', 'names'])
    assert.deepEqual(r.itemMenu.disc({ id: 1, kind: 'dvd-iso', disc: { scrambled: true } }, { admin: true }).map((e) => e.key), ['disc'])
    assert.deepEqual(r.itemMenu.disc({ id: 1, kind: 'dvd-iso' }, { admin: false }), [])
  } finally {
    rmSync(out, { force: true })
  }
})
