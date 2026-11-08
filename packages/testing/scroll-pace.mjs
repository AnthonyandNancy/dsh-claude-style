/**
 * scroll-pace.mjs — what a scroll costs a long transcript: the pass a scroll
 * wakes, the hooks it calls, the boxes it reads and the frames it drops.
 *
 * @capability scroll-pace
 * @features engine
 * @risk A wheel over a long conversation wakes the whole scheduler and reads
 *       boxes it already holds, and the page stutters while nothing changes.
 */
import { check } from './lane.mjs'
import { bound } from './bounds.mjs'
import { sendPrompt, waitForTurn } from './prompt.mjs'
import { fillTranscript, frameCostScenario, idleThen, readSample, resetSample, samplerInit } from './scroll-sample.mjs'

/** The host's conversation scroller (CONVERSATION_SCROLL_SELECTOR). */
const SCROLLER = '[data-conversation-scroll]'
/** How many fill turns put the transcript well past one screen. */
const FILL_TURNS = 8

/** Start the readings before the page's own scripts run. */
function initScript() {
  samplerInit('__scrollPace')
}

/** Empty the counters before one phase. */
function reset(page) {
  return resetSample(page, '__scrollPace')
}

/** Read one phase's counters as the numbers the checks bound. */
function read(page) {
  return readSample(page, '__scrollPace', ['measures', 'syncs'])
}

/** Wheel across the conversation for `ms`, reversing direction every 12 steps. */
async function wheel(page, ms) {
  const box = await page.locator(SCROLLER).boundingBox()
  if (box === null) throw new Error('scrollPace: the page carries no conversation scroller')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  const started = Date.now()
  let direction = -1
  let steps = 0
  while (Date.now() - started < ms) {
    await page.mouse.wheel(0, direction * 700)
    steps += 1
    if (steps % 12 === 0) direction *= -1
    await page.waitForTimeout(35)
  }
  return steps
}

/**
 * Scroll the window itself. The host shell fills the viewport and leaves the
 * document unscrollable, so a spacer stands in the page for the stretch the
 * window scrolls through; it is invisible, takes no pointer events, and is
 * removed before the scenario reads its counters. The styles that let the
 * document scroll are restored with it.
 */
async function windowScroll(page) {
  return page.evaluate(async () => {
    const spacer = document.createElement('div')
    spacer.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:300vh;visibility:hidden;pointer-events:none'
    document.body.append(spacer)
    const html = document.documentElement
    const body = document.body
    const previous = { html: html.style.overflowY, body: body.style.overflowY }
    html.style.overflowY = 'auto'
    body.style.overflowY = 'visible'
    const clear = () => window.__scrollPaceClear()
    // The styles above are writes of their own: let their frame settle before
    // the counters start, so the phase measures the scroll alone.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    clear()
    let steps = 0
    for (let at = 0; at < 40; at += 1) {
      window.scrollBy(0, at % 2 === 0 ? 40 : -40)
      steps += 1
      await new Promise((resolve) => setTimeout(resolve, 35))
    }
    const scrolled = Math.abs(window.scrollY)
    html.style.overflowY = previous.html
    body.style.overflowY = previous.body
    spacer.remove()
    window.scrollTo(0, 0)
    return { steps, scrolled }
  })
}

export function scrollPaceScenario() {
  return {
    ...frameCostScenario({
      viewport: { width: 1280, height: 900 },
      initScript,
      fill: ({ page }) => fillTranscript(page, sendPrompt, waitForTurn, FILL_TURNS),
    }),
    async afterTurn({ page }) {
      const { idle, phase: contentScroll } = await idleThen(page, reset, read, async () => {
        const steps = await wheel(page, 4000)
        return { ...await read(page), steps }
      })

      const windowPhase = await windowScroll(page)
      const windowScrollReading = { ...await read(page), ...windowPhase }

      await page.evaluate((result) => { window.__scrollPaceResult = result }, {
        idle,
        contentScroll,
        windowScroll: windowScrollReading,
      })
    },
    async assert({ page, session }) {
      const result = await page.evaluate(() => window.__scrollPaceResult)
      return [
        check('滚动场景积累了长会话', result !== undefined && result.contentScroll.steps > 20,
          `content steps=${result?.contentScroll.steps ?? 'n/a'}, window steps=${result?.windowScroll.steps ?? 'n/a'}`),
        check('空闲两秒内没有调度通行', result.idle.passReadings && result.idle.passes === 0,
          `pass readings=${result.idle.passReadings}, idle passes=${result.idle.passes}, rects=${result.idle.rects}`),
        check('会话滚动与窗口滚动都完成了采样', result.contentScroll.frames >= bound('scrollPaceMinFrames') && result.windowScroll.frames >= bound('scrollPaceMinFrames'),
          `content frames=${result.contentScroll.frames}, window frames=${result.windowScroll.frames}`),
        check('窗口滚动真的移动了文档', result.windowScroll.scrolled > 0,
          `window scrolled ${result.windowScroll.scrolled}px over ${result.windowScroll.steps} steps`),
        check('窗口滚动仍会重定位已打开的固定表面', result.windowScroll.passes >= 1,
          `window passes=${result.windowScroll.passes}, rects=${result.windowScroll.rects}`),
        check('会话滚动不唤醒整页通行', result.contentScroll.passReadings && result.contentScroll.passes === 0,
          `pass readings=${result.contentScroll.passReadings}, content passes=${result.contentScroll.passes}, rects=${result.contentScroll.rects}`),
        check('控制台没有异常', session.problems.length === 0, session.problems.slice(0, 3).join(' | ')),
      ]
    },
  }
}
