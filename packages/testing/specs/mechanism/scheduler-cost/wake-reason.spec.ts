/**
 * A pass wakes only the handles whose declared reasons include the one change
 * that asked for it; a handle that declares none keeps its old behaviour, and an
 * ask that names no reason wakes every handle.
 *
 * @capability scheduler-cost
 * @features engine
 * @risk A streamed batch still calls every feature, so a long conversation pays the whole page's sync on every token.
 */
import { expect, test } from 'vitest'
import { cleanupWith, frames } from '../../fixtures/teardown'
import { installedScheduler } from '../../fixtures/scheduler'

/** Ask for a pass and wait for it: the queue runs in the frame after the ask. */
async function passAfter(ui: Record<string, unknown>, options?: { contentOnly?: boolean, reason?: 'content' | 'sidebar' | 'composer' | 'header' | 'viewport' | 'other' }) {
  ;(ui as any).schedule(options)
  await frames(2)
}

test('a reason skips a handle that does not declare it, and counts only the hooks it called', async () => {
  const readings: { measures: number, syncs: number, measureMs: number, syncMs: number, hooks: Record<string, { measure: number; sync: number }>, reasons: string[] }[] = []
  const calls: string[] = []
  const ui = installedScheduler({
    retire: () => {},
    chat: { wakesOn: ['content'], sync: () => calls.push('chat') },
    side: { wakesOn: ['sidebar'], measure: () => {}, sync: () => calls.push('side') },
    anything: { sync: () => calls.push('anything') },
  }, ['chat', 'side', 'anything'], reading => readings.push(reading))
  await frames(1)
  calls.length = 0
  await passAfter(ui, { reason: 'sidebar' })
  expect(calls).toEqual(['side', 'anything'])
  const last = readings.at(-1)!
  expect({ measures: last.measures, syncs: last.syncs }).toEqual({ measures: 1, syncs: 2 })
  expect(last.measureMs).toBeGreaterThanOrEqual(0)
  expect(last.syncMs).toBeGreaterThanOrEqual(0)
})

test('a handle that declares no reason still wakes for every change', async () => {
  const calls: string[] = []
  const ui = installedScheduler({ retire: () => {}, anything: { sync: () => calls.push('anything') } }, ['anything'], () => {})
  await frames(1)
  calls.length = 0
  await passAfter(ui, { reason: 'content' })
  expect(calls).toEqual(['anything'])
})

/** The ask a case makes before the frame runs, as the reason it names. */
type Ask = 'content' | 'sidebar' | 'none'

/** Two handles on different reasons, asked in one frame and read at its end. */
async function twoReasonRun(asks: Ask[]) {
  const calls: string[] = []
  const ui = installedScheduler({
    retire: () => {},
    chat: { wakesOn: ['content'], sync: () => calls.push('chat') },
    side: { wakesOn: ['sidebar'], sync: () => calls.push('side') },
  }, ['chat', 'side'], () => {})
  await frames(1)
  calls.length = 0
  for (const ask of asks) (ui as any).schedule(ask === 'none' ? undefined : { reason: ask })
  await frames(2)
  return calls
}

test('two reasons in one frame wake both of their handles', async () => {
  expect(await twoReasonRun(['content', 'sidebar'])).toEqual(['chat', 'side'])
})

test('a reason asked after a reason-less ask does not narrow the pass back', async () => {
  expect(await twoReasonRun(['none', 'sidebar'])).toEqual(['chat', 'side'])
})

test('a reason-less ask clears the queued reasons rather than widening them', async () => {
  const calls: string[] = []
  const ui = installedScheduler({
    retire: () => {},
    chat: { wakesOn: ['content'], sync: () => calls.push('chat') },
  }, ['chat'], () => {})
  await frames(1)
  calls.length = 0
  ;(ui as any).schedule({ reason: 'sidebar' })
  ;(ui as any).schedule()
  ;(ui as any).schedule({ reason: 'sidebar' })
  await frames(2)
  expect(calls).toEqual(['chat'])
})
