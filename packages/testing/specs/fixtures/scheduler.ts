/**
 * The scheduler a mechanism spec drives: the engine's own frame pipeline and a
 * minimal source set, with the test's handles and pass readings.
 */
import { installScheduler } from '@dsh-claude-style/engine/scheduler'
import { cleanupWith } from './teardown'

export function installedScheduler(ui: Record<string, unknown>, features: string[], pass: (reading: { measures: number, syncs: number }) => void) {
  const stop = installScheduler({ get: () => undefined } as never, ui as never, features as never, {
    copyChange: [], refresh: [], start: () => {}, systemMotionChanged: () => {}, reportPass: pass,
  })
  cleanupWith(stop)
  return ui
}

/**
 * An open surface that follows a window scroll. `measure` and `sync` join only
 * where the case reads them: a window scroll must reach the relocation hooks
 * alone, and a resize must still run the pass's own phases beside them.
 */
export function openCard(calls: string[], options: { measure?: boolean, sync?: boolean, wakesOn?: readonly string[] } = {}) {
  return {
    repositionsOnScroll: true,
    ...(options.measure === true ? { measure: () => calls.push('measure') } : {}),
    measureReposition: () => calls.push('measureReposition'),
    reposition: (reason: string) => calls.push(`reposition:${reason}`),
    ...(options.sync === true ? { sync: () => calls.push('sync') } : {}),
    ...(options.wakesOn === undefined ? {} : { wakesOn: options.wakesOn }),
  }
}
