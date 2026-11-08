/**
 * A sidebar width write is not a structural sidebar change: a handle that
 * reads structure must not run for it, while a handle that reads boxes must.
 *
 * @capability scheduler-cost
 * @features engine, sidebar-status
 * @risk Every frame of a sidebar drag wakes the date grouping, unread marks and
 *       panel entries, so a width the reader is still choosing costs the work
 *       of a whole sidebar rebuild.
 */
import { expect, test } from 'vitest'
import { SIDEBAR_SLOT_SELECTOR } from '@dsh-claude-style/contracts/dom'
import { attach } from '../../fixtures/host-markup'
import { frames } from '../../fixtures/teardown'
import { widthScheduler } from '../../fixtures/sidebar-width'

test('a sidebar width change runs only the handles that declare sidebar-width', async () => {
  const { calls, widthListeners } = widthScheduler()
  await frames(2)
  calls.length = 0
  for (const listener of widthListeners) listener()
  await frames(2)
  expect(calls).toEqual(['width'])
})

test('a structural sidebar change still runs the structural handles', async () => {
  const { calls } = widthScheduler()
  await frames(2)
  const sidebar = attach(document.body, SIDEBAR_SLOT_SELECTOR)
  await frames(2)
  calls.length = 0
  sidebar.append(document.createElement('i'))
  await frames(2)
  expect(calls).toContain('structure')
})
