// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// The disc player's stall watchdog, fed with made-up buffers.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ENDED_AFTER, NUDGE_AFTER, gapAhead, stallStep } from './stall.ts'

const ranges = (...r) => ({ length: r.length, start: (i) => r[i][0], end: (i) => r[i][1] })

test('a seek still loading is waited for, however long it takes', () => {
  assert.equal(stallStep(NUDGE_AFTER + 20, 2327, 5171, true, ranges([0, 40])), 'wait')
})

test('waiting for the next segment with nothing buffered ahead is no gap', () => {
  assert.equal(stallStep(NUDGE_AFTER + 5, 2327, 5171, false, ranges([2320, 2327.02])), 'wait')
  assert.equal(stallStep(NUDGE_AFTER + 5, 2327, 5171, false, ranges()), 'wait')
})

test('a hole in what is buffered is stepped over once it has held playback long enough', () => {
  const b = ranges([100, 120.3], [120.9, 160])
  assert.equal(stallStep(NUDGE_AFTER - 1, 120.3, 5171, false, b), 'wait')
  assert.equal(stallStep(NUDGE_AFTER, 120.3, 5171, false, b), 'nudge')
  assert.equal(gapAhead(b, 120.3), 120.9)
})

test('a far-off range is not a gap to jump into', () => {
  assert.equal(gapAhead(ranges([100, 120], [400, 420]), 120), null)
})

test('standing still near the end counts as ended, seeking or not', () => {
  assert.equal(stallStep(ENDED_AFTER, 58.5, 60, false, ranges([0, 58.5])), 'ended')
  assert.equal(stallStep(ENDED_AFTER - 1, 58.5, 60, false, ranges([0, 58.5])), 'wait')
})
