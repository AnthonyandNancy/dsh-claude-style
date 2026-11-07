/**
 * A scroll inside the conversation moves content, not the window: it wakes no
 * scheduler pass and no relocation outside the scrolling container. A window
 * scroll still repositions what is open, and a resize keeps the whole path.
 *
 * @capability scheduler-cost
 * @features engine
 * @risk A wheel over a long conversation wakes the whole scheduler and every
 *       relocation handle, so scrolling stutters while nothing changes.
 */
import { expect, test } from 'vitest'
import { CONVERSATION_SCROLL_SELECTOR } from '@dsh-claude-style/contracts/dom'
import { cleanupWith, frames } from '../../fixtures/teardown'
import { installedScheduler, openCard } from '../../fixtures/scheduler'
import { hostElement } from '../../fixtures/host-markup'

/** A conversation scroller with enough content to scroll, under the host's own selector. */
function scroller() {
  const scroller = hostElement(CONVERSATION_SCROLL_SELECTOR)
  scroller.style.cssText = 'height:100px;overflow:auto'
  const content = document.createElement('div')
  content.style.height = '2000px'
  scroller.append(content)
  document.body.append(scroller)
  cleanupWith(() => scroller.remove())
  return scroller
}

test('a scroll inside the conversation wakes no pass and no relocation outside it', async () => {
  const readings: { measures: number, syncs: number }[] = []
  const calls: string[] = []
  installedScheduler({
    retire: () => {},
    chat: { wakesOn: ['composer'], sync: () => calls.push('sync') },
    openCard: openCard(calls),
  }, ['chat', 'openCard'], reading => readings.push(reading))
  const panel = scroller()
  // Mounting the scroller is itself a mutation and wakes the initial pass; let
  // that pass finish before reading the scroll's own cost.
  await frames(3)
  readings.length = 0
  calls.length = 0
  panel.dispatchEvent(new Event('scroll'))
  await frames(2)
  expect(readings).toEqual([])
  expect(calls).toEqual([])
})

test('a window scroll repositions what is open and wakes no pass', async () => {
  const readings: { measures: number, syncs: number }[] = []
  const calls: string[] = []
  installedScheduler({
    retire: () => {},
    openCard: openCard(calls),
  }, ['openCard'], reading => readings.push(reading))
  await frames(2)
  readings.length = 0
  calls.length = 0
  window.dispatchEvent(new Event('scroll'))
  await frames(2)
  expect(calls).toEqual(['measureReposition', 'reposition:scroll'])
  expect(readings).toEqual([])
})

test('a resize keeps the measure, the relocation and the viewport pass', async () => {
  const readings: { measures: number, syncs: number }[] = []
  const calls: string[] = []
  installedScheduler({
    retire: () => {},
    openCard: openCard(calls, { measure: true, sync: true, wakesOn: ['viewport'] }),
  }, ['openCard'], reading => readings.push(reading))
  await frames(2)
  readings.length = 0
  calls.length = 0
  window.dispatchEvent(new Event('resize'))
  await frames(2)
  // The pass's read phase and the relocation read run in the same frame: the
  // scheduler's own task runs every feature's measure in feature order while the
  // relocation task runs its own read, so both reads precede every write.
  expect(calls.slice(0, 2).sort()).toEqual(['measure', 'measureReposition'])
  expect(calls.slice(2)).toEqual(['reposition:viewport', 'sync'])
  expect(readings).toHaveLength(1)
})
