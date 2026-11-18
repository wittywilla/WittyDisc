// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// What the disc player's stall watchdog does after playback has stood still for a number of
// seconds. Browsers don't always fire "ended" for HLS streams whose last segment ends a little
// short of the announced length (the warning screens at the start of many discs), so standing
// still near the end counts as ended. Standing still in the middle is nudged past the gap, but
// only a real gap: picture buffered just past where it stands. A seek still loading, or a stream
// still waiting for its next segment, has nothing ahead to jump to, and starting the load again
// would only drop the request already on its way (on a Blu-ray the first segment after a seek
// can take longer than the watchdog waits).

export type Buffered = { length: number; start(i: number): number; end(i: number): number }
export type Stall = 'wait' | 'ended' | 'nudge'

export const ENDED_AFTER = 3 // seconds standing still near the end
export const NUDGE_AFTER = 8 // seconds standing still before a gap
const NEAR_END = 2.5
const GAP = 1.5 // the most a gap the nudge jumps over can be

// gapAhead: where picture resumes after a hole just past t, or null when nothing does.
export function gapAhead(b: Buffered, t: number): number | null {
  for (let i = 0; i < b.length; i++) {
    const s = b.start(i)
    if (s > t && s - t <= GAP) return s
  }
  return null
}

export function stallStep(still: number, at: number, end: number, seeking: boolean, buffered: Buffered): Stall {
  if (still >= ENDED_AFTER && end > 0 && at >= end - NEAR_END) return 'ended'
  if (seeking || still < NUDGE_AFTER) return 'wait'
  return gapAhead(buffered, at) != null ? 'nudge' : 'wait'
}
