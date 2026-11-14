#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// Written by WittyModule's kit/module-kit.sh from kit/sdui: don't edit, run module-kit.sh again.
// Writes a module's sdui.json from its definition in TypeScript (or JavaScript, or JSON),
// after checking it with checkModuleUI; on an error it prints every issue, writes nothing
// and exits with 1. Run it at build time, before packing:
//
//   node sdui/kit/write-sdui.mjs sdui/sdui.ts sdui.json     write sdui.json from sdui/sdui.ts
//   node sdui/kit/write-sdui.mjs --check sdui.json          only check a file written by hand
//   node sdui/kit/write-sdui.mjs --module wittyfoo in out   the module's ID, when no module.json
//                                                           is beside the output (or the file)
//
// The definition's default export is the ModuleUI (export const ui works too); it may be
// a function returning one. The module's ID comes from --module, or from the module.json
// nearest the output, and the file must be for that module. Warnings are printed and
// don't stop it. Needs Node 22.6 or later: TypeScript is read with Node's type stripping,
// switched on here when this Node doesn't have it on by default.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

// Node before 23.6 (and 22.18) reads TypeScript only with a flag: run again with it.
if (!process.features?.typescript) {
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (major < 22 || (major === 22 && minor < 6)) {
    console.error(`write-sdui: Node ${process.versions.node} can't read TypeScript; use Node 22.6 or later`)
    process.exit(2)
  }
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', ...process.argv.slice(1)], { stdio: 'inherit' })
  process.exit(r.status ?? 1)
}

function usage(msg) {
  if (msg) console.error('write-sdui: ' + msg)
  console.error('usage: node write-sdui.mjs [--module <id>] <definition.ts|.mjs|.json> <sdui.json>\n       node write-sdui.mjs [--module <id>] --check <sdui.json>')
  process.exit(2)
}

const args = process.argv.slice(2)
let moduleId = ''
let check = false
const files = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--module') moduleId = args[++i] || usage('--module needs the module\'s ID')
  else if (args[i] === '--check') check = true
  else if (args[i] === '-h' || args[i] === '--help') usage()
  else files.push(args[i])
}
if (check ? files.length !== 1 : files.length !== 2) usage()
const input = resolve(files[0])
const output = check ? input : resolve(files[1])

// The module's ID from the module.json nearest the output.
function manifestID(from) {
  for (let dir = dirname(from); ; dir = dirname(dir)) {
    const f = join(dir, 'module.json')
    if (existsSync(f)) {
      try {
        return JSON.parse(readFileSync(f, 'utf8')).id || ''
      } catch (e) {
        console.error(`write-sdui: ${f} can't be read: ${e.message}`)
        process.exit(1)
      }
    }
    if (dirname(dir) === dir) return ''
  }
}

const kit = await import(pathToFileURL(join(here, 'wittymodule-sdui.ts')).href)

let ui
try {
  if (input.endsWith('.json')) {
    ui = JSON.parse(readFileSync(input, 'utf8'))
  } else {
    const mod = await import(pathToFileURL(input).href)
    ui = mod.default ?? mod.ui
    if (typeof ui === 'function') ui = await ui()
    if (ui === undefined) throw new Error('it exports no ModuleUI: write `export default defineModuleUI({...})`')
  }
} catch (e) {
  console.error(`write-sdui: ${files[0]}: ${e.message}`)
  process.exit(1)
}

moduleId ||= manifestID(output)
const text = JSON.stringify(ui, null, 2) + '\n'
const issues = kit.checkModuleUI(ui, moduleId || undefined)
const size = Buffer.byteLength(text)
if (size > kit.MAX_MODULE_BYTES) issues.unshift({ path: '/', severity: 'error', message: `the file would be ${size} bytes; the most is ${kit.MAX_MODULE_BYTES}`, fix: 'Split the module, or leave some out.' })
if (issues.length) console.error(kit.formatIssues(issues).replace(/^/gm, `${files[check ? 0 : 1]}: `))
if (kit.hasErrors(issues)) {
  console.error(`write-sdui: ${issues.filter((i) => i.severity === 'error').length} error(s); ${check ? 'the file would be refused' : 'nothing written'}`)
  process.exit(1)
}
if (!check) {
  // Unchanged files are left alone, so a build doesn't touch them.
  if (!existsSync(output) || readFileSync(output, 'utf8') !== text) writeFileSync(output, text)
  console.log(`write-sdui: ${files[1]} for ${ui.module} (${size} bytes${issues.length ? `, ${issues.length} warning(s)` : ''})`)
} else {
  console.log(`write-sdui: ${files[0]} is fine for ${ui.module}${issues.length ? ` (${issues.length} warning(s))` : ''}`)
}
