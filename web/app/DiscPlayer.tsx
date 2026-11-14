// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// The app's player for a disc (players: disc): how the address says to start it, as the app's own
// player page read it, handed to the disc player.
import { lazy, Suspense } from 'react'
import { dvdStartMode, type Item } from '@wms/app/api'

const DvdPlayer = lazy(() => import('./DvdPlayer'))
const loading = <div className="player"><div className="center-spinner"><div className="spinner" /></div></div>

export default function DiscPlayer({ item, params, startAt }: { item: Item; params: Record<string, string | undefined>; startAt: number | null }) {
  const num = (k: string) => (params[k] ? Number(params[k]) : undefined)
  // No explicit mode: the item's start setting (menu by default).
  const m = params.mode
  const mode = m === 'menu' || m === 'title' ? m : params.ttn ? 'title' : dvdStartMode(item)
  return (
    <Suspense fallback={loading}>
      <DvdPlayer item={item} mode={mode} ttn={num('ttn')} chapter={num('chapter')} startAt={startAt} insert={params.insert === '1'}
        menu={params.menu || undefined} menuVts={num('menuVts')} episode={num('episode')} angle={num('angle')} />
    </Suspense>
  )
}
