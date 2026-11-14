// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// Where a disc's own routes are: WittyDVD's for a DVD, WittyBluray's for a Blu-ray (module API 5).
// The disc sessions the player opens (/dvd/...) stay the server's.
import { isBluray, type Item } from '@wms/app/api'

/** The module whose disc this is. */
export const discModule = (item: Pick<Item, 'kind'>) => (isBluray(item as Item) ? 'wittybluray' : 'wittydvd')

/** A disc's page, its analysis (/analysis), the choice of film (/choice) and its names (/labels). */
export const discPath = (item: Pick<Item, 'id' | 'kind'>) => `/modules/${discModule(item)}/discs/${item.id}`

/** Names given to a disc's titles and chapters, keyed by title number and chapter number. */
export type DiscLabels = { titles: Record<string, string>; chapters: Record<string, Record<string, string>> }
