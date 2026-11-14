// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
//
// WittyDisc's screens in WittyMediaServer's web app (module API 5; integration.json says what it
// claims): the one disc player WittyDVD and WittyBluray share (players: disc), with the disc's own
// menus, its remote and another device steering it; Settings, DVDs and Blu-rays; and an
// administrator's tools for one disc in a title's "Manage this title" menu (Disc settings, Name
// titles and scenes). Every other app plays a disc with its own player, and shows a disc's page from
// WittyDVD's and WittyBluray's sdui.json.
import { lazy } from 'react'
import type { Item } from '@wms/app/api'
import { toast } from '@wms/app/state'

const DiscPlayer = lazy(() => import('./DiscPlayer'))
const DiscSettings = lazy(() => import('./DiscSettings'))
const SettingsDialog = lazy(() => import('./DiscDialogs').then((m) => ({ default: m.DiscSettingsDialog })))
const NamesDialog = lazy(() => import('./DiscDialogs').then((m) => ({ default: m.DiscNamesDialog })))

type DialogProps = { item: unknown; onClose: () => void; onSaved: () => void }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function register(_host: unknown): any {
  return {
    players: { disc: DiscPlayer },
    settings: { discs: DiscSettings },
    itemMenu: {
      disc: (raw: unknown, who: { admin: boolean }) => {
        const item = raw as Item
        if (!who.admin) return []
        const out = [{ key: 'disc', label: 'Disc settings', icon: 'settings', Dialog: ({ item, onClose, onSaved }: DialogProps) => <SettingsDialog item={item as Item} onClose={onClose} onSaved={() => { toast('Disc settings saved'); onSaved() }} /> }]
        if (!item.disc?.scrambled) {
          out.push({ key: 'names', label: 'Name titles and scenes', icon: 'edit', Dialog: ({ item, onClose, onSaved }: DialogProps) => <NamesDialog item={item as Item} onClose={onClose} onSaved={onSaved} /> })
        }
        return out
      },
    },
  }
}
