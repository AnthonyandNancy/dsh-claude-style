/**
 * A scheduler whose sidebar width source is the test's own listener set, and a
 * sidebar root under its slot built from the host contract. The three specs
 * about a width reason share these, so the case bodies read only their own
 * handles and side effects.
 */
import { installScheduler } from '@dsh-claude-style/engine/scheduler'
import { observeSidebarWidth } from '@dsh-claude-style/engine/host'
import { hostElement } from './host-markup'
import { surfaceAttribute } from './surface'
import { cleanupWith } from './teardown'

/** The one inline declaration the width cases write to move a root's box. */
export const WIDTH_ATTRIBUTE = 'width'
/** How long a size observer needs, at most, to deliver a box the page just moved. */
export const WIDTH_SETTLE_MS = 50

/** The scheduler the width cases install: one handle recording each pass it is given. */
export function widthProbe() {
  const slot = document.createElement('div')
  slot.setAttribute('data-slot', 'sidebar')
  document.body.append(slot)
  const calls: string[] = []
  const stop = installScheduler({ get: () => undefined } as never, {
    retire: () => {},
    width: { wakesOn: ['sidebar-width'], sync: () => calls.push('width') },
  }, ['width'], {
    copyChange: [], refresh: [], start: () => {}, systemMotionChanged: () => {},
    observeSidebarWidth,
  })
  cleanupWith(stop)
  return { slot, calls }
}

/** A sidebar root under its slot, as the host mounts it: a replacement takes the old root's place. */
export function mountSidebarRoot(slot: HTMLElement) {
  slot.replaceChildren()
  const root = hostElement(`[${surfaceAttribute('skin.part')}~="sidebar-root"]`)
  slot.append(root)
  return root
}

export interface WidthCase {
  calls: string[]
  widthListeners: Set<() => void>
  /** A root mounted under the slot, replacing the one that stood there. */
  mountRoot(slot: HTMLElement): HTMLElement
}

/**
 * Install a scheduler over the given handles, with a size source the case
 * drives through `widthListeners`.
 */
export function widthSchedulerWith(
  handles: Record<string, Record<string, unknown>>,
  features: string[],
  widthListeners: Set<() => void>,
) {
  return installScheduler(
    { get: () => undefined } as never,
    { retire: () => {}, ...handles } as never,
    features as never,
    {
      copyChange: [],
      refresh: [],
      start: () => {},
      systemMotionChanged: () => {},
      observeSidebarWidth: (listener: () => void) => {
        widthListeners.add(listener)
        return () => widthListeners.delete(listener)
      },
    },
  )
}

/** Install a scheduler with two handles and a size source the case drives. */
export function widthScheduler(): WidthCase {
  const calls: string[] = []
  const widthListeners = new Set<() => void>()
  const stop = installScheduler(
    { get: () => undefined } as never,
    {
      retire: () => {},
      structure: { wakesOn: ['sidebar'], sync: () => calls.push('structure') },
      width: { wakesOn: ['sidebar-width'], sync: () => calls.push('width') },
    },
    ['structure', 'width'],
    {
      copyChange: [],
      refresh: [],
      start: () => {},
      systemMotionChanged: () => {},
      observeSidebarWidth: (listener) => {
        widthListeners.add(listener)
        return () => widthListeners.delete(listener)
      },
    },
  )
  cleanupWith(stop)
  return {
    calls,
    widthListeners,
    mountRoot(slot) {
      return mountSidebarRoot(slot)
    },
  }
}
