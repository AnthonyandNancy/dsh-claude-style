/**
 * A width write on the sidebar root is not a row status change: the status
 * pass must not run for it, while a row's own phase change still must.
 *
 * @capability sidebar-status
 * @features sidebar-status
 * @risk Every frame of a sidebar drag rewrites style.width on the sidebar
 *       root, and the status pass then reads every row's title and box.
 */
import { afterEach, expect, test } from 'vitest'
import { SESSION_PHASE_ATTRIBUTE, SIDEBAR_SLOT_SELECTOR } from '@dsh-claude-style/contracts/dom'
import { installSidebarStatus } from '@dsh-claude-style/client/pure'
import { hostElement } from '../../fixtures/host-markup'
import { surfaceAttribute } from '../../fixtures/surface'
import { frames } from '../../fixtures/frames'

const PART = surfaceAttribute('skin.part')
const cleanups: (() => void)[] = []
const settle = () => new Promise(resolve => setTimeout(resolve, 0))

afterEach(() => {
  for (const stop of cleanups.splice(0).reverse()) stop()
  document.body.replaceChildren()
})

/** A sidebar root with one native session row, built from the host contract's naming. */
function sidebar() {
  const slot = hostElement(SIDEBAR_SLOT_SELECTOR)
  const root = document.createElement('div')
  root.setAttribute(PART, 'sidebar-root')
  const row = document.createElement('div')
  row.setAttribute(PART, 'session-row')
  const seat = document.createElement('div')
  seat.setAttribute(PART, 'row-slot')
  const dot = document.createElement('span')
  dot.setAttribute(SESSION_PHASE_ATTRIBUTE, 'idle')
  seat.append(dot)
  const title = document.createElement('span')
  title.setAttribute(PART, 'row-title')
  title.textContent = 'A session'
  row.append(seat, title)
  root.append(row)
  slot.append(root)
  document.body.append(slot)
  return { root, dot, title }
}

interface TestUi {
  schedule(): void
  sidebarStatus?: { measure(): void; sync(): void }
}

function installed() {
  const passes: number[] = []
  const ui: TestUi = { schedule: () => { passes.push(1) } }
  const stop = installSidebarStatus(undefined as never, ui as never)
  cleanups.push(stop)
  ui.sidebarStatus?.measure()
  ui.sidebarStatus?.sync()
  return { passes }
}

test('a width write on the sidebar root does not wake the status pass', async () => {
  const { root } = sidebar()
  const feature = installed()
  await frames(2)
  feature.passes.length = 0
  root.style.width = '311px'
  await settle()
  await frames(2)
  expect(feature.passes).toEqual([])
})

test('a row phase change still wakes the status pass', async () => {
  const { dot } = sidebar()
  const feature = installed()
  await frames(2)
  feature.passes.length = 0
  dot.setAttribute(SESSION_PHASE_ATTRIBUTE, 'ongoing')
  await settle()
  await frames(2)
  expect(feature.passes.length).toBeGreaterThan(0)
})
