/**
 * A scheduler pass reports how many feature hooks it called, so the long-session
 * lane can tell a pass that grew with the page from one that did not.
 *
 * @capability scheduler-cost
 * @features engine
 * @risk A pass silently calls every feature on every streamed batch and a long conversation stutters while the page looks idle.
 */
import { afterEach, expect, test } from 'vitest'
import { installScheduler } from '@dsh-claude-style/engine/scheduler'

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  document.body.replaceChildren()
})

test('a pass reports one measure and one sync per handle that implements them', async () => {
  const readings: { measures: number, syncs: number, measureMs: number, syncMs: number, hooks: Record<string, { measure: number; sync: number }>, reasons: string[] }[] = []
  const ui = {
    retire: () => {},
    schedule: () => {},
    one: { measure() {}, sync() {} },
    two: { sync() {} },
  }
  const stop = installScheduler(
    { get: () => undefined } as never,
    ui,
    ['one', 'two'],
    { copyChange: [], refresh: [], start: () => {}, systemMotionChanged: () => {}, reportPass: reading => readings.push(reading) },
  )
  cleanups.push(stop)
  ui.schedule?.()
  ui.one.sync()
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  expect(readings.map(({ measures, syncs }) => ({ measures, syncs }))).toEqual([{ measures: 1, syncs: 2 }])
  expect(readings[0].measureMs).toBeGreaterThanOrEqual(0)
  expect(readings[0].syncMs).toBeGreaterThanOrEqual(0)
  expect(readings[0].hooks.one).toEqual({ measure: expect.any(Number), sync: expect.any(Number) })
  expect(readings[0].hooks.two).toEqual({ measure: 0, sync: expect.any(Number) })
  expect(readings[0].reasons).toContain('other')
})
