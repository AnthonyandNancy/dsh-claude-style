/**
 * A sidebar root replaced while the page is up keeps the width reason alive:
 * the scheduler's own binding asks the host module for the root each time a
 * root arrives, so a replaced root's size reaches the width readers and the
 * detached one no longer does.
 *
 * @capability scheduler-cost
 * @features engine, sidebar-status
 * @risk A session switch replaces the sidebar root, and the width reason then
 *       stops arriving for the rest of the generation.
 */
import { expect, test } from 'vitest'
import { SIDEBAR_DRAGGING_ATTRIBUTE } from '@dsh-claude-style/client/pure'
import { findSidebarRoot } from '@dsh-claude-style/engine/host'
import { frames } from '../../fixtures/teardown'
import { WIDTH_ATTRIBUTE, WIDTH_SETTLE_MS, mountSidebarRoot, widthProbe } from '../../fixtures/sidebar-width'

test('the host remounting the sidebar at one width is no width change', async () => {
  const { slot, calls } = widthProbe()
  const root = mountSidebarRoot(slot)
  root.style.setProperty(WIDTH_ATTRIBUTE, '280px')
  await new Promise(resolve => setTimeout(resolve, WIDTH_SETTLE_MS))
  await frames(2)
  calls.length = 0

  // The host redraws the sidebar shell on every pointer frame of a drag, at the
  // width the pointer is on. While the pointer holds one width, each redraw is
  // the same column and must not wake the width readers again.
  document.body.setAttribute(SIDEBAR_DRAGGING_ATTRIBUTE, '')
  for (let frame = 0; frame < 3; frame += 1) {
    const next = mountSidebarRoot(slot)
    next.style.setProperty(WIDTH_ATTRIBUTE, '280px')
    await new Promise(resolve => setTimeout(resolve, WIDTH_SETTLE_MS))
    await frames(2)
  }
  document.body.removeAttribute(SIDEBAR_DRAGGING_ATTRIBUTE)
  await frames(2)
  expect(calls).toEqual([])
})

test('a replaced sidebar root keeps waking the width readers, and the old root stops', async () => {
  const { slot, calls } = widthProbe()
  mountSidebarRoot(slot)
  await frames(2)
  calls.length = 0

  const replacement = mountSidebarRoot(slot)
  await frames(3)
  calls.length = 0
  replacement.style.setProperty(WIDTH_ATTRIBUTE, '320px')
  // Let the size observer deliver the new box before the scheduler's frame.
  await new Promise(resolve => setTimeout(resolve, WIDTH_SETTLE_MS))
  await frames(3)
  expect(calls.length).toBeGreaterThan(0)
  expect(findSidebarRoot()).toBe(replacement)

  calls.length = 0
  slot.firstElementChild?.remove()
  await frames(2)
  calls.length = 0
  replacement.style.setProperty(WIDTH_ATTRIBUTE, '340px')
  await frames(2)
  expect(calls).toEqual([])
})
