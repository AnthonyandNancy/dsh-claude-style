/**
 * Handles that read a box across the sidebar's own width run for a width
 * change; handles that only read structure do not.
 *
 * @capability scheduler-cost
 * @features engine, composer, account
 * @risk A sidebar width change runs every sidebar feature, including the ones
 *       that never read a width, so a drag pays an entire sidebar rebuild a frame.
 */
import { expect, test } from 'vitest'
import { installScheduler } from '@dsh-claude-style/engine/scheduler'
import { cleanupWith, frames } from '../../fixtures/teardown'
import { widthSchedulerWith } from '../../fixtures/sidebar-width'

test('a width change reaches the box readers and no structure reader', async () => {
  const calls: string[] = []
  const widthListeners = new Set<() => void>()
  const stop = widthSchedulerWith(
    {
      responsive: { wakesOn: ['sidebar-width', 'composer'], measure: () => calls.push('responsive.measure'), sync: () => calls.push('responsive.sync') },
      account: { wakesOn: ['sidebar', 'sidebar-width'], measure: () => calls.push('account.measure'), sync: () => calls.push('account.sync') },
      entries: { wakesOn: ['sidebar'], sync: () => calls.push('entries.sync') },
    },
    ['responsive', 'account', 'entries'],
    widthListeners,
  )
  cleanupWith(stop)
  await frames(2)
  calls.length = 0
  for (const listener of widthListeners) listener()
  await frames(2)
  expect(calls).toEqual(['responsive.measure', 'account.measure', 'responsive.sync', 'account.sync'])
})
