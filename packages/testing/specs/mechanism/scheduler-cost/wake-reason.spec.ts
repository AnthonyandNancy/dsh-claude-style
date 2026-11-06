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
import { installScheduler } from '@dsh-claude-style/engine/scheduler'
import { cleanupWith, frames } from '../../fixtures/teardown'

function installed(ui: Record<string, unknown>, features: string[], pass: (reading: { measures: number, syncs: number }) => void) {
  // hostLocale asks the context for its services, so the double answers no services.
  const stop = installScheduler({ get: () => undefined } as never, ui as never, features as never, {
    copyChange: [], refresh: [], start: () => {}, systemMotionChanged: () => {}, reportPass: pass,
  })
  cleanupWith(stop)
  return ui
}

/** Ask for a pass and wait for it: the queue runs in the frame after the ask. */
async function passAfter(ui: Record<string, unknown>, options?: { contentOnly?: boolean, reason?: 'content' | 'sidebar' | 'composer' | 'header' | 'viewport' | 'other' }) {
  ;(ui as any).schedule(options)
  await frames(2)
}

test('a reason skips a handle that does not declare it, and counts only the hooks it called', async () => {
  const readings: { measures: number, syncs: number }[] = []
  const calls: string[] = []
  const ui = installed({
    retire: () => {},
    chat: { wakesOn: ['content'], sync: () => calls.push('chat') },
    side: { wakesOn: ['sidebar'], measure: () => {}, sync: () => calls.push('side') },
    anything: { sync: () => calls.push('anything') },
  }, ['chat', 'side', 'anything'], reading => readings.push(reading))
  await frames(1)
  calls.length = 0
  await passAfter(ui, { reason: 'sidebar' })
  expect(calls).toEqual(['side', 'anything'])
  expect(readings.at(-1)).toEqual({ measures: 1, syncs: 2 })
})

test('a handle that declares no reason still wakes for every change', async () => {
  const calls: string[] = []
  const ui = installed({ retire: () => {}, anything: { sync: () => calls.push('anything') } }, ['anything'], () => {})
  await frames(1)
  calls.length = 0
  await passAfter(ui, { reason: 'content' })
  expect(calls).toEqual(['anything'])
})

test('a reason-less ask clears the queued reasons rather than widening them', async () => {
  const calls: string[] = []
  const ui = installed({
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
