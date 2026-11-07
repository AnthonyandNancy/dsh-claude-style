/**
 * A window scroll repositions only the surfaces that asked to follow it. A
 * closed card is never told, and a resize still reaches every handle because
 * the boxes the whole page is placed against have moved.
 *
 * @capability scheduler-cost
 * @features engine
 * @risk Every window scroll walks all relocation handles, including cards nobody
 *       opened and measurements the scroll did not change.
 */
import { expect, test } from 'vitest'
import { cleanupWith, frames } from '../../fixtures/teardown'
import { installedScheduler, openCard } from '../../fixtures/scheduler'

test('a window scroll reaches the handles that follow scroll, and no others', async () => {
  const calls: string[] = []
  const readings: { measures: number, syncs: number }[] = []
  installedScheduler({
    retire: () => {},
    openCard: openCard(calls),
    closedCard: {
      measureReposition: () => calls.push('closed:measureReposition'),
      reposition: (reason: string) => calls.push(`closed:reposition:${reason}`),
    },
  }, ['openCard', 'closedCard'], reading => readings.push(reading))
  await frames(2)
  calls.length = 0
  readings.length = 0
  window.dispatchEvent(new Event('scroll'))
  await frames(2)
  expect(calls).toEqual(['measureReposition', 'reposition:scroll'])
  expect(readings).toEqual([])
})

test('a resize still reaches every handle and wakes the viewport pass', async () => {
  const calls: string[] = []
  const readings: { measures: number, syncs: number }[] = []
  installedScheduler({
    retire: () => {},
    openCard: openCard(calls, { measure: true, sync: true, wakesOn: ['viewport'] }),
    closedCard: {
      measureReposition: () => calls.push('closed:measureReposition'),
      reposition: (reason: string) => calls.push(`closed:reposition:${reason}`),
      wakesOn: ['viewport'],
    },
  }, ['openCard', 'closedCard'], reading => readings.push(reading))
  await frames(2)
  calls.length = 0
  readings.length = 0
  window.dispatchEvent(new Event('resize'))
  await frames(2)
  const reads = calls.filter((call) => call === 'measure' || call === 'measureReposition' || call === 'closed:measureReposition').sort()
  expect(reads).toEqual(['closed:measureReposition', 'measure', 'measureReposition'])
  expect(calls).toEqual([
    'measureReposition', 'closed:measureReposition',
    'measure',
    'reposition:viewport', 'closed:reposition:viewport', 'sync',
  ])
  expect(readings).toHaveLength(1)
  expect(readings[0].measures).toBe(1)
  expect(readings[0].syncs).toBe(1)
})
