/**
 * sidebar-drag.mjs — what a sidebar drag costs on a long conversation: the
 * host writes the frame's tracks every frame, and the skin's own syncs, box
 * reads and style recalcs ride on that write.
 *
 * @capability sidebar-drag
 * @features sidebar-status, workspace, composer, shared
 * @risk Dragging the sidebar to a new width stalls the main thread while the
 *       reader is still holding the pointer, and the conversation beside it
 *       drops frames for a width the reader is still choosing.
 */
import { SIDEBAR_HANDLE_SELECTOR } from '@dsh-claude-style/contracts/dom'
import { check } from './lane.mjs'
import { bound } from './bounds.mjs'
import { sendPrompt, waitForTurn } from './prompt.mjs'
import { dragBySine, fillTranscript, frameCostScenario, idleThen, readSample, resetSample, samplerInit } from './scroll-sample.mjs'

/** The host's sidebar drag handle (SIDEBAR_HANDLE_SELECTOR). */
const HANDLE = SIDEBAR_HANDLE_SELECTOR
/** How many fill turns put the transcript well past one screen. */
const FILL_TURNS = 8

/** Start the readings before the page's own scripts run. */
function initScript() {
  samplerInit('__sidebarDrag')
}

/** Empty the counters before one phase. */
function reset(page) {
  return resetSample(page, '__sidebarDrag')
}

/** Read one phase's counters as the numbers the checks bound. */
function read(page) {
  return readSample(page, '__sidebarDrag', ['measures', 'syncs'])
}

/** Drag the sidebar's edge by a bounded travel, one pointermove a frame. */
const drag = (page, ms) => dragBySine(page, HANDLE, ms, 80, 'sidebarDrag')

export function sidebarDragScenario() {
  return {
    ...frameCostScenario({
      viewport: { width: 1440, height: 900 },
      initScript,
      fill: ({ page }) => fillTranscript(page, sendPrompt, waitForTurn, FILL_TURNS),
    }),
    async afterTurn({ page }) {
      const { idle, phase: dragPhase } = await idleThen(page, reset, read, async () => {
        const steps = await drag(page, 1600)
        return { ...await read(page), steps }
      })
      const drag = dragPhase

      await reset(page)
      await page.waitForTimeout(600)
      const afterDrag = await read(page)

      await page.evaluate((result) => { window.__sidebarDragResult = result }, { idle, drag, afterDrag })
    },
    async assert({ page, session }) {
      const result = await page.evaluate(() => window.__sidebarDragResult)
      return [
        check('拖动场景积累了长会话', result !== undefined && result.drag.steps > 20,
          `steps=${result?.drag.steps ?? 'n/a'}`),
        check('空闲两秒内没有调度通行', result.idle.passReadings && result.idle.passes === 0,
          `idle passes=${result.idle.passes}, rects=${result.idle.rects}`),
        check('拖动产生可分析的帧样本', result.drag.frames >= bound('sidebarDragMinFrames'),
          `frames=${result.drag.frames}, steps=${result.drag.steps}`),
        check('拖动期采样到了调度通行', result.drag.passReadings && result.drag.passes > 0,
          `pass readings=${result.drag.passReadings}, drag passes=${result.drag.passes}`),
        check('拖动期间的帧 p95 不超过一个帧预算', result.drag.p95 <= bound('sidebarDragFrameP95Ms'),
          `p95=${result.drag.p95}, worst=${result.drag.worst}`),
        check('拖动期间没有超过预算的帧', result.drag.over33 <= bound('sidebarDragMaxOverBudgetFrames'),
          `over33=${result.drag.over33}, long=${result.drag.longTotal}`),
        check('拖动结束后页面的通行回到静止', result.afterDrag.passes === 0,
          `after pass=${result.afterDrag.passes}, mutations=${result.afterDrag.mutations}`),
        check('控制台没有异常', session.problems.length === 0, session.problems.slice(0, 3).join(' | ')),
      ]
    },
  }
}
