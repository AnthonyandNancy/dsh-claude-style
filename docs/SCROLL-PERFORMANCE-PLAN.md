# 滚动卡顿整改实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落实 `docs/SCROLL-PERFORMANCE.md` 的三项整改，并把它们拆成可独立验收的五个任务：先建立滚动读数，再分开滚动与窗口尺寸变化，随后把定位测量收进按需路径，最后按页面与表面分片挂载样式表。

**Architecture:** 每项改动只改变“什么时候算、算几次、规则何时进入样式表”，不改变算出的值、写入的标记、动画的时长曲线或元素的盒与层级。任务顺序固定：读数任务给后续四项提供同机对照；调度任务减少每次滚动的唤醒；测量任务减少重复读取与写后读；样式任务减少滚动时参与匹配的规则数量；收口任务运行完整验收并同步文档。

**Tech Stack:** TypeScript、esbuild、PostCSS、Vitest 浏览器模式、Playwright、仓库自己的冒烟与端到端通道。

## Global Constraints

- 可见结果不变：动画的时长、曲线、起点与终点不变；元素的盒、层级、颜色与圆角不变；交互的命中区域与键盘路径不变。
- 观察仍只有一个 `MutationObserver` 与一套 `ResizeObserver` 登记（D40）：`MutationObserver`、`ResizeObserver`、`requestAnimationFrame` 只允许在 `packages/engine/src/bus.ts` 与 `packages/engine/src/frame.ts` 里创建。
- 宿主查询只走 `packages/engine/src/host.ts` 的访问器或 `packages/engine/src/bus.ts` 的清单；新选择器写进 `packages/contracts/src/dom.ts`，并在 `packages/contracts/src/table.ts` 登记（D3）。
- 样式里不写时长、缓动曲线与 9 以上的层级字面值；需要新值时先加进 `packages/client/src/theme/tokens.json`（D9）。
- 不改变偏好默认值与设置页上的任何一行（`packages/contracts/src/prefs.ts` 不动）。
- `lib/` 是构建产物，源码改动后只运行 `npm run build`（D47）。
- 一个源文件接近 750 行时停下，先拆分再继续（`npm run lint` 会拒绝越过这条线）。
- `packages/testing/scenarios.mjs` 已 725 行；新场景的实现写进独立模块并只在该表登记一行。
- 提交标题用中文与 Conventional Commit 前缀，一次提交只带一个逻辑改动。
- 每个任务的验证只运行它点名的规范或场景；完整矩阵留给 Task 4，并遵守 D77 的发布前规则。
- 每个任务记录同机前后读数，读数写进提交说明，不写进本计划正文。

---

## File Structure

| 文件 | 责任 | 本计划中的动作 |
|---|---|---|
| packages/testing/scroll-pace.mjs | 新增 `scrollPace` 场景：空闲、会话滚动、窗口滚动三段读数 | 新建 |
| `packages/testing/scenarios.mjs` | 场景登记表 | 只加一行 import 与一行登记 |
| `packages/contracts/src/timing.ts` | 端到端场景名与宿主时序假设的对照表 | 修改 |
| `packages/testing/data/bounds.json` | 滚动场景的读数上限与理由 | 修改 |
| `packages/testing/data/check-numbers.json` | 检查里的数字，由工具重写 | 修改 |
| `packages/engine/src/scheduler.ts` | 滚动与窗口尺寸变化的路由、重定位派发 | 修改 |
| packages/testing/specs/mechanism/scheduler-cost/scroll-routing.spec.ts | 滚动路由的机制规范 | 新建 |
| `packages/client/src/features/view-tabs/view-tabs.ts` | 标题栏模式下跳过位移测量 | 修改 |
| `packages/client/src/features/account/account-footer.ts` | 窗口滚动时重定位打开的账户抽屉 | 修改 |
| `packages/client/src/features/model/model-picker.ts` | 窗口滚动时重定位打开的模型卡片 | 修改 |
| `packages/client/src/features/effort/effort-picker.ts` | 窗口滚动时重定位打开的档位卡片 | 修改 |
| `packages/client/src/features/permissions/permissions.ts` | 窗口滚动时重定位打开的权限卡片 | 修改 |
| `packages/client/src/features/hero-menu/hero-menu.ts` | 窗口滚动时重定位打开的首页菜单 | 修改 |
| `packages/client/src/features/context-stats/context-stats.ts` | 窗口滚动时重对齐打开的上下文面板 | 修改 |
| `packages/client/src/features/chat-follow/chat-follow.ts` | 窗口滚动时重新放置回到底部按钮 | 修改 |
| packages/testing/specs/mechanism/scheduler-cost/open-relocations.spec.ts | 只通知打开表面的机制规范 | 新建 |
| packages/testing/specs/behaviour/view-tabs/settled-reads.spec.mjs | 标题栏模式只读滑块两盒的行为规范 | 新建 |
| `scripts/css.mjs` | 构建把样式表切成有序片段 | 修改 |
| `scripts/build.mjs` | 生成模块携带片段表 | 修改 |
| `scripts/virtual-modules.mjs` | 生成模块的导出形状 | 修改 |
| `packages/client/src/generated.d.ts` | 片段表的类型声明 | 修改 |
| `packages/client/src/core/stylesheet.ts` | 按页面与表面挂载片段，保持标签顺序 | 修改 |
| `packages/engine/src/stylesheet.ts` | 多片段的挂载与更新机制 | 修改 |
| | `packages/testing/importance-audit.mjs` | 审计所有皮肤样式片段，而非只读第一张 | 修改 |
| packages/testing/specs/behaviour/stylesheets/parts.spec.mjs | 分片挂载与外观不变的行为规范 | 新建 |
| `docs/SCROLL-PERFORMANCE-PLAN.md` | 本计划 | 新建 |
| `README.md`、`README.en.md`、`docs/ARCHITECTURE.md`、`docs/SCROLL-PERFORMANCE.md` | 文档入口与结果回链 | Task 4 修改 |

表里不带反引号的文件是这份计划要新建的，目前还不存在；带反引号的路径都能在仓库里打开。

---

### Task 0: 先让滚动成本成为一个可重复的读数

**Files:**
- Create: packages/testing/scroll-pace.mjs
- Modify: `packages/testing/scenarios.mjs:1-40,465-512`
- Modify: `packages/contracts/src/timing.ts:19`
- Modify: `packages/testing/data/bounds.json`
- Test: packages/testing/scroll-pace.mjs

**Interfaces:**
- Consumes: `sendPrompt`、`waitForTurn`（`packages/testing/prompt.mjs`），`bound`（`packages/testing/bounds.mjs`），`check`（`packages/testing/lane.mjs`）。
- Produces: 场景 `scrollPace`；页面全局 `window.__scrollPace`，形状为 `{ passes, measures, syncs, rects, styles, queries, frames, longtasks, extraFrames }`；读数 `{ idle, contentScroll, windowScroll }`，每项含 `passes`、`maxMeasures`、`maxSyncs`、`rects`、`frames`、`p95`、`over33`、`longTotal`、`extraFrames`。

- [ ] **Step 1: Write the failing test**

新建 packages/testing/scroll-pace.mjs：

```js
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

/** The host's conversation scroller (CONVERSATION_SCROLL_SELECTOR). */
const SCROLLER = '[data-conversation-scroll]'
/** How many fill turns put the transcript well past one screen. */
const FILL_TURNS = 8

/** Start the readings before the page's own scripts run. */
function initScript() {
  const state = window.__scrollPace = {
    passes: [], rects: 0, styles: 0, queries: 0, frames: [], longtasks: [], extraFrames: 0,
  }
  const raf = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (callback) => { state.extraFrames += 1; return raf(callback) }
  window.__dshSmokeHost = window.__dshSmokeHost ?? {}
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) state.longtasks.push(Math.round(entry.duration))
  }).observe({ entryTypes: ['longtask'] })
  let last = performance.now()
  const tick = (now) => {
    state.frames.push(Math.round((now - last) * 100) / 100)
    last = now
    if (state.frames.length < 12000) raf(tick)
  }
  raf(tick)
  const boxed = (original) => function (...args) { state.rects += 1; return original.apply(this, args) }
  Element.prototype.getBoundingClientRect = boxed(Element.prototype.getBoundingClientRect)
  Element.prototype.getClientRects = boxed(Element.prototype.getClientRects)
  const styled = (original) => function (...args) { state.styles += 1; return original.apply(this, args) }
  window.getComputedStyle = styled(window.getComputedStyle)
  const queried = (original) => function (...args) { state.queries += 1; return original.apply(this, args) }
  Document.prototype.querySelector = queried(Document.prototype.querySelector)
  Document.prototype.querySelectorAll = queried(Document.prototype.querySelectorAll)
}

/** Empty the counters before one phase. */
function reset(page) {
  return page.evaluate(() => {
    const state = window.__scrollPace
    state.passes.length = 0
    state.rects = 0
    state.styles = 0
    state.queries = 0
    state.frames.length = 0
    state.longtasks.length = 0
    state.extraFrames = 0
    window.__dshPassReadings?.clear()
  })
}

/** Read one phase's counters as the numbers the checks bound. */
function read(page) {
  return page.evaluate(() => {
    const state = window.__scrollPace
    const gaps = state.frames.slice().sort((left, right) => left - right)
    const at = (share) => gaps.length === 0 ? 0 : gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * share))]
    const passes = window.__dshPassReadings ? window.__dshPassReadings.read() : []
    return {
      passes: passes.length,
      maxMeasures: Math.max(0, ...passes.map((reading) => reading.measures)),
      maxSyncs: Math.max(0, ...passes.map((reading) => reading.syncs)),
      rects: state.rects,
      styles: state.styles,
      queries: state.queries,
      frames: gaps.length,
      p95: at(0.95),
      over33: gaps.filter((value) => value > 33).length,
      longTotal: state.longtasks.reduce((sum, duration) => sum + duration, 0),
      extraFrames: state.extraFrames,
    }
  })
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
    const clear = () => {
      const state = window.__scrollPace
      state.passes.length = 0
      state.rects = 0
      state.styles = 0
      state.queries = 0
      state.frames.length = 0
      state.longtasks.length = 0
      state.extraFrames = 0
      window.__dshPassReadings?.clear()
    }
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
    script: 'long',
    prompt: 'write a long answer',
    delayMs: 60,
    viewport: { width: 1280, height: 900 },
    initScript,
    async beforeSend({ page }) {
      for (let turn = 1; turn <= FILL_TURNS; turn += 1) {
        await sendPrompt(page, `fill the transcript ${turn}`)
        await waitForTurn(page)
      }
      await page.waitForTimeout(1200)
    },
    async afterTurn({ page }) {
      await reset(page)
      await page.waitForTimeout(2000)
      const idle = await read(page)

      await reset(page)
      const contentSteps = await wheel(page, 4000)
      const contentScroll = { ...await read(page), steps: contentSteps }

      const windowPhase = await windowScroll(page)
      const windowScrollReading = { ...await read(page), ...windowPhase }

      window.__scrollPaceResult = { idle, contentScroll, windowScroll: windowScrollReading }
    },
    async assert({ page, session }) {
      const result = await page.evaluate(() => window.__scrollPaceResult)
      return [
        check('滚动场景积累了长会话', result !== undefined && result.contentScroll.steps > 20,
          `content steps=${result?.contentScroll.steps ?? 'n/a'}, window steps=${result?.windowScroll.steps ?? 'n/a'}`),
        check('空闲两秒内没有调度通行', result.idle.passes === 0,
          `idle passes=${result.idle.passes}, rects=${result.idle.rects}`),
        check('会话滚动与窗口滚动都完成了采样', result.contentScroll.frames >= bound('scrollPaceMinFrames') && result.windowScroll.frames >= bound('scrollPaceMinFrames'),
          `content frames=${result.contentScroll.frames}, window frames=${result.windowScroll.frames}`),
        check('窗口滚动真的移动了文档', result.windowScroll.scrolled > 0,
          `window scrolled ${result.windowScroll.scrolled}px over ${result.windowScroll.steps} steps`),
        check('窗口滚动仍会重定位已打开的固定表面', result.windowScroll.passes >= 1,
          `window passes=${result.windowScroll.passes}, rects=${result.windowScroll.rects}`),
        check('控制台没有异常', session.problems.length === 0, session.problems.slice(0, 3).join(' | ')),
      ]
    },
  }
}
```

在 `packages/testing/scenarios.mjs` 顶部加入：

```js
import { scrollPaceScenario } from './scroll-pace.mjs'
```

并在 `readerScroll` 登记旁加入：

```js
  scrollPace: scrollPaceScenario(),
```

在 `packages/contracts/src/timing.ts` 的 `E2E_SCENARIOS` 数组中加入 `'scrollPace'`。

Task 0 只把基线记录下来，**不新增任何会失败的滚动上限**：Task 1 至 Task 3 完成之前，滚动仍然会有整页通行与皮肤盒读取。`packages/testing/data/bounds.json` 这一步只在需要时加入采样下限，理由写在一起；真正的验收上限在 Task 4 由最终读数决定。

```json
    {
      "name": "scrollPaceMinFrames",
      "value": 30,
      "reason": "The 4 s content scroll must carry at least thirty animation-frame samples. The baseline sample recorded 138 frames with a four-times CPU slowdown; a reading under this means the sampler stopped early rather than the page becoming cheaper."
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node packages/testing/e2e.mjs --scenario scrollPace --jobs 1`

Expected: FAIL — `packages/testing/scenarios.mjs` has no `scrollPace`, and `packages/contracts/src/timing.ts` does not name it, so the runner refuses the scenario.

- [ ] **Step 3: Run the scenario over the current tree and record the baseline**

Run: `DSH_CLAUDE_STYLE_PASS_READINGS=1 npm run build` 与 `node packages/testing/e2e.mjs --scenario scrollPace --jobs 1`

Expected: the scenario runs and prints four readings for each phase. Record `contentScroll.passes`、`contentScroll.rects`、`contentScroll.extraFrames`、`contentScroll.p95`、`contentScroll.over33`、`contentScroll.longTotal` and the idle values. The readings go into the commit message as the baseline before any behaviour change.

- [ ] **Step 4: 重写检查里的数字**

Run: `node packages/testing/check-numbers.mjs`

Expected: `packages/testing/data/check-numbers.json` 只多出 `scroll-pace.mjs` 的检查与它们读到的数字；既有检查的数字不变。随后用 `node packages/testing/check-numbers.mjs --check` 复核。

- [ ] **Step 5: Commit**

```bash
git add packages/testing/scroll-pace.mjs packages/testing/scenarios.mjs packages/contracts/src/timing.ts packages/testing/data/bounds.json packages/testing/data/check-numbers.json
git commit -m "test(perf): 记录会话滚动的一帧成本"
```

---

### Task 1: 把会话滚动与窗口尺寸变化分开

**Files:**
- Modify: `packages/engine/src/scheduler.ts:55-65,226-246,508-523`
- Test: packages/testing/specs/mechanism/scheduler-cost/scroll-routing.spec.ts

**Interfaces:**
- Consumes: `installScheduler<Name>(ctx, ui, features, sources)` 的现有签名；`CONVERSATION_SCROLL_SELECTOR`（`packages/contracts/src/dom.ts`）。
- Produces: `type RepositionReason = 'scroll' | 'viewport' | 'composer'`（写在 `packages/engine/src/scheduler.ts` 并导出）；`FeatureHandle.reposition?(reason: RepositionReason): void`；`SchedulerSources` 不变；调度器内部函数 `onWindowScroll(event: Event)`、`onWindowResize()`、`isContentScroll(target: EventTarget | null): boolean`。

- [ ] **Step 1: Write the failing test**

新建 packages/testing/specs/mechanism/scheduler-cost/scroll-routing.spec.ts：

```ts
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
import { installScheduler } from '@dsh-claude-style/engine/scheduler'
import { CONVERSATION_SCROLL_SELECTOR } from '@dsh-claude-style/contracts/dom'
import { cleanupWith, frames } from '../../fixtures/teardown'
import { hostElement } from '../../fixtures/host-markup'

function installed(ui: Record<string, unknown>, features: string[], pass: (reading: { measures: number, syncs: number }) => void) {
  const stop = installScheduler({ get: () => undefined } as never, ui as never, features as never, {
    copyChange: [], refresh: [], start: () => {}, systemMotionChanged: () => {}, reportPass: pass,
  })
  cleanupWith(stop)
  return ui
}

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
  installed({
    retire: () => {},
    chat: { wakesOn: ['composer'], sync: () => calls.push('sync') },
    openCard: {
      measureReposition: () => calls.push('measureReposition'),
      reposition: (reason: string) => calls.push(`reposition:${reason}`),
    },
  }, ['chat', 'openCard'], reading => readings.push(reading))
  await frames(2)
  readings.length = 0
  calls.length = 0
  scroller().dispatchEvent(new Event('scroll'))
  await frames(2)
  expect(readings).toEqual([])
  expect(calls).toEqual([])
})

test('a window scroll repositions what is open and wakes no pass', async () => {
  const readings: { measures: number, syncs: number }[] = []
  const calls: string[] = []
  installed({
    retire: () => {},
    openCard: {
      repositionsOnScroll: true,
      measureReposition: () => calls.push('measureReposition'),
      reposition: (reason: string) => calls.push(`reposition:${reason}`),
    },
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
  const ui = installed({
    retire: () => {},
    openCard: {
      measure: () => calls.push('measure'),
      measureReposition: () => calls.push('measureReposition'),
      reposition: (reason: string) => calls.push(`reposition:${reason}`),
      sync: () => calls.push('sync'),
      wakesOn: ['viewport'],
    },
  }, ['openCard'], reading => readings.push(reading))
  await frames(2)
  readings.length = 0
  calls.length = 0
  window.dispatchEvent(new Event('resize'))
  await frames(2)
  expect(calls).toEqual(['measureReposition', 'measure', 'reposition:viewport', 'sync'])
  expect(readings).toHaveLength(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/testing/specs/mechanism/scheduler-cost/scroll-routing.spec.ts`

Expected: FAIL — a conversation scroll wakes a pass and both `measureReposition` and `reposition('viewport')`; the current code has no `'scroll'` reason at all, so the behavior the test asks for does not exist.

- [ ] **Step 3: Write minimal implementation**

在 `packages/engine/src/scheduler.ts` 里先定义原因，再改 `FeatureHandle` 的 `reposition`：

```ts
/**
 * Why a handle is moved: `'scroll'` is content moving inside its own scroller,
 * `'viewport'` is the window resizing, and `'composer'` is the card resizing.
 */
export type RepositionReason = 'scroll' | 'viewport' | 'composer'

/** The reason's own place on the handle. */
reposition?(reason: RepositionReason): void
```

保留 `measureReposition` 的注释，并把注释改成：

```ts
  /**
   * The read phase of the frame a scroll or resize repositions in, before every
   * feature's `reposition` (D40): a feature that pins boxes reads them here, so
   * no feature's reposition forces a layout under another's.
   */
  measureReposition?(): void
```

把现有函数 `onFixedPopoverViewportChange` 与两个监听器替换为：

```ts
  /** A scroll inside the conversation is content movement, not a window change. */
  function isContentScroll(target: EventTarget | null) {
    const scroller = findConversationScroller()
    if (scroller === null) return false
    return target instanceof Node && (target === scroller || scroller.contains(target))
  }

  /** Scrolls anywhere else move the window (or a control of their own): a fixed surface may follow them. */
  let cancelScrollFrame: (() => void) | null = null
  function onWindowScroll(event: Event) {
    if (isContentScroll(event.target)) return
    if (cancelScrollFrame !== null) return
    cancelScrollFrame = requestFrame({
      read() {
        dispatch('measureReposition')
      },
      write() {
        cancelScrollFrame = null
        dispatch('reposition', 'scroll')
      },
    })
  }

  /** A resize changes boxes the whole page is placed against: measure, reposition and pass, as before. */
  let cancelResizeFrame: (() => void) | null = null
  function onWindowResize() {
    if (cancelResizeFrame !== null) return
    cancelResizeFrame = requestFrame({
      read() {
        dispatch('measureReposition')
      },
      write() {
        cancelResizeFrame = null
        dispatch('reposition', 'viewport')
      },
    })
    schedule({ reason: 'viewport' })
  }
  window.addEventListener('scroll', onWindowScroll, true)
  window.addEventListener('resize', onWindowResize)
```

在 `teardown` 里替换监听器与取消帧：

```ts
    if (cancelScrollFrame !== null) cancelScrollFrame()
    cancelScrollFrame = null
    if (cancelResizeFrame !== null) cancelResizeFrame()
    cancelResizeFrame = null
    window.removeEventListener('scroll', onWindowScroll, true)
    window.removeEventListener('resize', onWindowResize)
```

`cancelViewportFrame` 的所有引用由这两个取消函数取代；`FeatureHook` 不变，因为 `reposition` 与 `measureReposition` 的名字未变。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/testing/specs/mechanism/scheduler-cost/scroll-routing.spec.ts`

Expected: PASS — the conversation scroll records no pass and calls nothing; the window scroll calls `measureReposition` then `reposition('scroll')` and records no pass; the resize runs both reads in the frame's read phase (`measureReposition`, then `measure`) and both writes after them (`reposition('viewport')`, then `sync`), and reports one pass.

- [ ] **Step 5: 逐功能核对重定位的实现**

Run: `node packages/testing/smoke.mjs --feature view-tabs,header-band,composer,context-stats,chat-fold,chat-follow,turn-nav --jobs 1`

Expected: 全部通过。这些目录的开关拆装与标记读写没有变化；Task 2 的打开表面登记不改变任何功能的安装与拆除。

- [ ] **Step 6: 跑滚动场景，确认会话滚动不再唤醒通行**

Run: `node packages/testing/e2e.mjs --scenario scrollPace --jobs 1`

Expected: `contentScroll.passes` 为 0；`contentScroll.extraFrames` 不再增长。`windowScroll.passes` 仍至少为 1。

- [ ] **Step 8: Commit**

```bash
git add packages/engine/src/scheduler.ts packages/testing/specs/mechanism/scheduler-cost/scroll-routing.spec.ts
git commit -m "perf(scheduler): 会话滚动不再触发整页重定位"
```

---

### Task 2: 窗口滚动只重定位打开的表面

**Files:**
- Modify: `packages/engine/src/scheduler.ts:44-66,232-260`
- Modify: `packages/client/src/features/account/account-footer.ts:567-575`
- Modify: `packages/client/src/features/model/model-picker.ts:543-549`
- Modify: `packages/client/src/features/effort/effort-picker.ts:282-291`
- Modify: `packages/client/src/features/permissions/permissions.ts:388-418`
- Modify: `packages/client/src/features/hero-menu/hero-menu.ts:325`
- Modify: `packages/client/src/features/context-stats/context-stats.ts:25-40`
- Modify: `packages/client/src/features/chat-follow/chat-follow.ts:558-568`
- Modify: `packages/client/src/features/view-tabs/view-tabs.ts:220-274`
- Test: packages/testing/specs/mechanism/scheduler-cost/open-relocations.spec.ts
- Test: packages/testing/specs/behaviour/view-tabs/settled-reads.spec.mjs

**Interfaces:**
- Consumes: Task 1 的 `onWindowScroll` 与 `onWindowResize`；`FeatureHandle.reposition(reason)`。
- Produces: `FeatureHandle.repositionsOnScroll?: boolean`；调度器内部 `measureOpenRelocations()` 与 `repositionOpenRelocations()`；Windows 标题栏模式下 `viewTabs.measure()` 不读取位移盒。

- [ ] **Step 1: Write the failing mechanism test**

新建 packages/testing/specs/mechanism/scheduler-cost/open-relocations.spec.ts：

```ts
/**
 * A window scroll repositions only the surfaces that asked to follow it. A
 * closed card is never told, and a resize still reaches every handle because
 * the boxes the whole page is placed against have moved.
 *
 * @capability scheduler-cost
 * @features engine
 * @risk Every window scroll walks all relocation handles, including cards nobody
 *       opened and measurements the scroll did not change.
 */
import { expect, test } from 'vitest'
import { installScheduler } from '@dsh-claude-style/engine/scheduler'
import { cleanupWith, frames } from '../../fixtures/teardown'

function installed(ui: Record<string, unknown>, features: string[], pass: (reading: { measures: number, syncs: number }) => void) {
  const stop = installScheduler({ get: () => undefined } as never, ui as never, features as never, {
    copyChange: [], refresh: [], start: () => {}, systemMotionChanged: () => {}, reportPass: pass,
  })
  cleanupWith(stop)
  return ui
}

test('a window scroll reaches the handles that follow scroll, and no others', async () => {
  const calls: string[] = []
  const readings: { measures: number, syncs: number }[] = []
  installed({
    retire: () => {},
    openCard: {
      repositionsOnScroll: true,
      measureReposition: () => calls.push('measureReposition'),
      reposition: (reason: string) => calls.push(`reposition:${reason}`),
    },
    closedCard: {
      measureReposition: () => calls.push('closed:measureReposition'),
      reposition: (reason: string) => calls.push(`closed:reposition:${reason}`),
    },
  }, ['openCard', 'closedCard'], reading => readings.push(reading))
  await frames(2)
  calls.length = 0
  readings.length = 0
  window.dispatchEvent(new Event('scroll'))
  await frames(2)
  expect(calls).toEqual(['measureReposition', 'reposition:scroll'])
  expect(readings).toEqual([])
})

test('a resize still reaches every handle and wakes the viewport pass', async () => {
  const calls: string[] = []
  const readings: { measures: number, syncs: number }[] = []
  installed({
    retire: () => {},
    openCard: {
      repositionsOnScroll: true,
      measure: () => calls.push('measure'),
      measureReposition: () => calls.push('measureReposition'),
      reposition: (reason: string) => calls.push(`reposition:${reason}`),
      sync: () => calls.push('sync'),
      wakesOn: ['viewport'],
    },
    closedCard: {
      measureReposition: () => calls.push('closed:measureReposition'),
      reposition: (reason: string) => calls.push(`closed:reposition:${reason}`),
    },
  }, ['openCard', 'closedCard'], reading => readings.push(reading))
  await frames(2)
  calls.length = 0
  readings.length = 0
  window.dispatchEvent(new Event('resize'))
  await frames(2)
  expect(calls).toEqual([
    'measureReposition', 'closed:measureReposition',
    'measure',
    'reposition:viewport', 'closed:reposition:viewport', 'sync',
  ])
  expect(readings).toHaveLength(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/testing/specs/mechanism/scheduler-cost/open-relocations.spec.ts`

Expected: FAIL — `closedCard` receives the window scroll's `measureReposition` and `reposition('scroll')`, because the scheduler dispatches to every handle.

- [ ] **Step 3: Write the minimal scheduler implementation**

在 `FeatureHandle` 的 `reposition` 旁加入：

```ts
  /**
   * Whether this feature's own open surface follows a window scroll. A closed
   * card leaves it out: no box it reads can move, and a window scroll reaches
   * only the handles that declare it.
   */
  repositionsOnScroll?: boolean
```

在调度器里加入两个只遍历声明者的函数：

```ts
  /** Read the open surfaces a window scroll can have moved, in feature order. */
  function measureOpenRelocations() {
    for (const name of features) {
      const handle = handleOf(name)
      if (handle === undefined || handle.repositionsOnScroll !== true) continue
      if (typeof handle.measureReposition !== 'function') continue
      try {
        handle.measureReposition()
      } catch (error) {
        reportError(error)
      }
    }
  }

  /** Reposition the open surfaces a window scroll moved, in the same frame's write phase. */
  function repositionOpenRelocations() {
    for (const name of features) {
      const handle = handleOf(name)
      if (handle === undefined || handle.repositionsOnScroll !== true) continue
      if (typeof handle.reposition !== 'function') continue
      try {
        handle.reposition('scroll')
      } catch (error) {
        reportError(error)
      }
    }
  }
```

把 Task 1 的 `onWindowScroll` 改为调用这两个函数：

```ts
  function onWindowScroll(event: Event) {
    if (isContentScroll(event.target)) return
    if (cancelScrollFrame !== null) return
    cancelScrollFrame = requestFrame({
      read() {
        measureOpenRelocations()
      },
      write() {
        cancelScrollFrame = null
        repositionOpenRelocations()
      },
    })
  }
```

`onWindowResize` 不改：它仍调用 `dispatch('measureReposition')` 与 `dispatch('reposition', 'viewport')`，并 `schedule({ reason: 'viewport' })`。

- [ ] **Step 4: 在需要跟随窗口滚动的表面登记这个标志**

在每个功能已有的 `ui.<handle> = { … }` 对象字面量里加入同一行，不新增第二份对象、不改变打开与关闭的时机：

```ts
  // account-footer.ts, inside `ui.footer = { … }`
  repositionsOnScroll: true,

  // model-picker.ts, inside `ui.model = { … }`
  repositionsOnScroll: true,

  // effort-picker.ts, inside `ui.effort = { … }`
  repositionsOnScroll: true,

  // permissions.ts, inside `ui.permissions = { … }`
  repositionsOnScroll: true,

  // hero-menu.ts, inside `ui.heroMenu = { … }`
  repositionsOnScroll: true,

  // context-stats.ts, inside `ui.contextStats = { … }`
  repositionsOnScroll: true,

  // chat-follow.ts, inside `ui.chatFollow = { … }`
  repositionsOnScroll: true,
```

这些功能自身已经判断表面是否打开：账户页脚在 `drawer.isOpen()` 之外返回，模型选择器在 `mainOpen()` 之外返回，档位选择器在 `data-open !== 'true'` 时返回，权限卡片在 `data-open !== 'true'` 时返回，主菜单只在 `cardStamp.current()` 存在时定位，统计只在打开的上下文面板上重新对齐，聊天跟随按钮只在宿主渲染它时存在。

`viewTabs` 与 `headerBand` 不登记：它们在窗口滚动前已经标好，标题栏模式由样式表固定；窗口尺寸变化仍由 `measure()` 与 `sync()` 处理。

- [ ] **Step 5: Write the failing behavior test for the Windows caption row**

新建 packages/testing/specs/behaviour/view-tabs/settled-reads.spec.mjs：

```js
/**
 * Under the Windows caption row the strip is placed by its stylesheet: a pass
 * reads only the two boxes the pill needs, never the strip's shift boxes.
 *
 * @capability view-tabs
 * @features view-tabs
 * @risk A resize reads six boxes for a placement the caption row fixes, and the
 *       read forces the transcript to lay out again.
 */
import { spec, host, surface } from '../../fixtures/behaviour.mjs'

const WINDOWS = host('shell.windows-titlebar')
const STRIP = surface.attribute('view-tabs.strip')
const PILL = 'data-dsh-claude-pill'

export default spec({ page: 'view-tabs-row' }, ({ test }) => {
  test('the Windows caption row reads only the boxes the pill needs', async (t) => {
    const reading = await t.page.evaluate(async ([windows, strip, pillAttribute]) => {
      document.documentElement.setAttribute(windows, '')
      await window.__dshSmokeProbe.settle()
      const marked = document.querySelector(`[${strip}]`)
      if (marked === null) throw new Error('view-tabs: the page carries no strip')
      const pill = document.querySelector(`[${pillAttribute}]`)
      if (pill === null) throw new Error('view-tabs: the page carries no pill')
      let stripReads = 0
      let controlReads = 0
      let itemReads = 0
      const original = Element.prototype.getBoundingClientRect
      Element.prototype.getBoundingClientRect = function () {
        if (this === marked || marked.contains(this)) stripReads += 1
        if (this === pill) controlReads += 1
        else if (pill.contains(this)) itemReads += 1
        return original.call(this)
      }
      try {
        window.dispatchEvent(new Event('resize'))
        await window.__dshSmokeProbe.settle()
        return { stripReads, controlReads, itemReads }
      } finally {
        Element.prototype.getBoundingClientRect = original
        document.documentElement.removeAttribute(windows)
      }
    }, [WINDOWS, STRIP, PILL])
    t.expectThat.equal(reading.controlReads, 1, 'the pill reads its control once')
    t.expectThat.equal(reading.itemReads, 1, 'the pill reads its active item once')
    t.expectThat.equal(reading.stripReads, 2, 'the caption row reads no shift box')
  })
})
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx vitest run packages/testing/specs/mechanism/scheduler-cost/open-relocations.spec.ts` 与 `npm run build` 后 `node packages/testing/behaviour.mjs --spec view-tabs/settled-reads`

Expected: 机制规范 FAIL — 关闭的卡片也收到窗口滚动的重定位；行为规范 FAIL — Windows 标题栏模式仍读取条带盒（`stripReads` 大于 2）。

- [ ] **Step 7: Write the minimal view-tabs implementation**

把 `takeReading` 改名为 `takeShiftReading`（`placeForPaint()`、`measure()` 与 `sync()` 三处调用一起改），并把 `measure()` 改为：

```ts
  function measure() {
    // The mode is a page fact the read phase can take before it asks for boxes:
    // a titlebar flip that arrived since the last pass must skip the shift now.
    syncTitlebar()
    const found = findStrip()
    measuredStrip = found === null ? null : found.strip
    reading = found === null || titlebar ? null : takeShiftReading(found.header, found.strip)
    pill.measure(found === null ? null : found.list)
  }
```

`sync()` 已有 `if (titlebar) return`，因此不会写位移。把 `placeForPaint()` 与 `sync()` 里剩余的 `takeReading(...)` 调用一并改为 `takeShiftReading(...)`；分段控件滑块仍读控制框与活动项两个盒。

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run packages/testing/specs/mechanism/scheduler-cost/open-relocations.spec.ts`、`npm run build` 与 `node packages/testing/behaviour.mjs --spec view-tabs/settled-reads`

Expected: 机制规范 PASS — 窗口滚动只调用打开卡片的 `measureReposition` 与 `reposition('scroll')`；窗口尺寸变化仍在同一帧里先跑两个读阶段、再跑两个写阶段；行为规范 PASS — `stripReads` 为 2，`controlReads` 与 `itemReads` 各为 1。

- [ ] **Step 9: 跑受影响的冒烟与滚动场景**

Run: `node packages/testing/smoke.mjs --feature account,model,effort,permissions,hero-menu,context-stats,chat-follow,view-tabs --jobs 1` 与 `node packages/testing/e2e.mjs --scenario scrollPace,readerScroll,doorPin,streamPace --jobs 1`

Expected: 冒烟通过；`contentScroll.passes` 仍为 0；`windowScroll.passes` 仍至少为 1；`readerScroll`、`doorPin`、`streamPace` 的行为断言通过。

- [ ] **Step 10: Commit**

```bash
git add packages/engine/src/scheduler.ts packages/client/src/features/account/account-footer.ts packages/client/src/features/model/model-picker.ts packages/client/src/features/effort/effort-picker.ts packages/client/src/features/permissions/permissions.ts packages/client/src/features/hero-menu/hero-menu.ts packages/client/src/features/context-stats/context-stats.ts packages/client/src/features/chat-follow/chat-follow.ts packages/client/src/features/view-tabs/view-tabs.ts packages/testing/specs/mechanism/scheduler-cost/open-relocations.spec.ts packages/testing/specs/behaviour/view-tabs/settled-reads.spec.mjs
git commit -m "perf(scheduler): 窗口滚动只重定位打开的表面"
```

---

### Task 3: 让样式表按页面与表面分片挂载

**Files:**
- Modify: `scripts/css.mjs:510-542`
- Modify: `scripts/build.mjs:451-485`
- Modify: `scripts/virtual-modules.mjs:130-190`
- Modify: `packages/client/src/generated.d.ts:1-40`
- Modify: `packages/client/src/core/stylesheet.ts:1-40`
- Modify: `packages/engine/src/stylesheet.ts:1-120`
- Modify: `packages/client/src/entry.ts:355-390`
- Modify: `packages/client/src/features/settings/settings.ts:374-440`
- Modify: `packages/client/src/features/home/home-layout.ts:49-345`
- Modify: `packages/client/src/shared/popover.ts:293-302`
- Modify: `packages/client/src/features/account/account-footer.ts:329-350`
- Modify: `packages/client/src/features/hero-menu/hero-menu.ts:283-318`
- Modify: `packages/client/src/features/sidebar-entries/sidebar-entries.ts:277`
- Modify: `packages/testing/importance-audit.mjs:55-70,580-660`
- Modify: `vitest.config.mjs:24-32`
- Modify: `packages/testing/data/surface.json`
- Test: packages/testing/specs/behaviour/stylesheets/parts.spec.mjs

**Interfaces:**
- Consumes: `buildStylesheet({ sheets, … })` 的现有输入；`mountStylesheet({ id, text, packageName, pluginCss })` 的现有请求形状。
- Produces: `buildStylesheet` 返回 `{ main: string, surface: string, parts: SheetPart[] }`；`SheetPart` 为 `{ group: StyleGroup, text: string }`；`StyleGroup` 为 `'base' | 'conversation' | 'composer' | 'sidebar' | 'settings' | 'home' | 'popover'`；`STYLESHEET_PARTS` 与 `STYLESHEET` 一样由生成模块导出；`mountStylesheet` 的请求新增可选 `parts?: readonly SheetPart[]`；新函数 `updateStylesheetGroups(id: string, active: ReadonlySet<StyleGroup>, parts: readonly SheetPart[]): void`。

- [ ] **Step 1: Write the failing test**

新建 packages/testing/specs/behaviour/stylesheets/parts.spec.mjs：

```js
/**
 * The skin's rules arrive in the parts the page needs and keep the cascade they
 * had as one sheet: the order of the parts is the order of the built sheet, and
 * a group that is not on the page contributes no active rule.
 *
 * @capability stylesheets
 * @features core
 * @risk Every page parses and matches settings, home and popover rules, so a
 *       scroll over the conversation pays for surfaces that are not drawn.
 */
import { spec, surface } from '../../fixtures/behaviour.mjs'

const TRIGGER = '.dsh-claude-model-btn'
const GROUP = surface.attribute('stylesheets.sheet')
/** The parts the page carries now, in cascade order. */
const readGroups = (t) => t.page.evaluate((group) => [...document.querySelectorAll('style[data-plugin-css="dsh-claude-style/client.css"]')].map((sheet) => sheet.getAttribute(group)), GROUP)

export default spec({ page: 'desktop' }, ({ test }) => {
  test('the sheet is mounted as ordered parts and a conversation page carries no settings or home rules', async (t) => {
    const reading = await t.page.evaluate((group) => {
      const sheets = [...document.querySelectorAll('style[data-plugin-css="dsh-claude-style/client.css"]')]
      const groups = sheets.map((sheet) => sheet.getAttribute(group))
      const rules = sheets.reduce((sum, sheet) => sum + (sheet.sheet?.cssRules.length ?? 0), 0)
      return { count: sheets.length, groups, rules }
    }, GROUP)
    t.expectThat.equal(reading.count > 0, true, 'the skin mounts its sheet')
    t.expectThat.equal(reading.groups.includes('base'), true, `the base part is mounted (${reading.groups.join(', ')})`)
    t.expectThat.equal(reading.groups.includes('settings'), false, `no settings part on the conversation page (${reading.groups.join(', ')})`)
    t.expectThat.equal(reading.groups.includes('home'), false, 'no home part on the conversation page')
    t.expectThat.equal(reading.rules > 0, true, `the mounted parts carry rules (${reading.rules})`)
  })

  test('opening the model picker mounts the popover part without moving the rest', async (t) => {
    const before = await readGroups(t)
    await t.page.locator(TRIGGER).first().click()
    await t.settle()
    const after = await readGroups(t)
    t.expectThat.equal(after.includes('popover'), true, `the popover part is mounted (${after.join(', ')})`)
    t.expectThat.equal(after.filter((group) => group !== 'popover'), before, 'every other part keeps its place')
    const box = await t.read.box(surface('popover.card'))
    t.expectThat.visible(box, 'the opened card keeps its drawn box')
    await t.page.locator(TRIGGER).first().click()
    await t.page.waitForTimeout(400)
    const closed = await t.page.evaluate((selector) => {
      const card = document.querySelector(selector)
      const style = getComputedStyle(card)
      return { visibility: style.visibility, opacity: style.opacity }
    }, surface('popover.card'))
    t.expectThat.equal(closed.visibility, 'hidden', 'a closed card is not painted after its rules are taken away')
    t.expectThat.equal(closed.opacity, '0', 'a closed card keeps no paint')
  })
})
```

在 `packages/testing/data/surface.json` 中加入一个表面 id：

```json
    { "id": "stylesheets.sheet", "attribute": "data-dsh-sheet-group", "feature": "core", "sees": "the group each mounted part of the skin's stylesheet answers for" }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build` 与 `node packages/testing/behaviour.mjs --spec stylesheets/parts`

Expected: FAIL — the page mounts one `style[data-plugin-css="dsh-claude-style/client.css"]`, its `data-dsh-sheet-group` is null, and a conversation page carries the settings and home rules in that one sheet.

- [ ] **Step 3: Write minimal implementation (build half)**

在 `scripts/css.mjs` 的 `buildStylesheet` 里把 `joined` 改为按组切分：

```js
/** Which page or surface a sheet belongs to, by the sheet's own file. */
function styleGroupOf(sheet) {
  const file = sheet.file ?? ''
  if (file.startsWith('features/settings/')) return 'settings'
  if (file.startsWith('features/home/') || file.startsWith('features/home-ripple/') || file === 'theme/hero.css') return 'home'
  if (file.startsWith('features/composer/') || file.startsWith('features/context-stats/') || file.startsWith('features/model/') || file.startsWith('features/effort/') || file.startsWith('features/hero-menu/')) return 'composer'
  if (file.startsWith('features/sidebar-') || file.startsWith('features/account/') || file.startsWith('features/workspace/') || file.startsWith('features/date-groups/') || file === 'theme/sidebar.css') return 'sidebar'
  if (file.startsWith('features/chat-') || file.startsWith('features/turn-nav/') || file.startsWith('features/process-column/') || file.startsWith('features/row-skip/') || file === 'shared/motion.css') return 'conversation'
  if (file === 'shared/popover.css') return 'popover'
  return 'base'
}
```

把返回改为：

```js
  const parts = processed.filter((item) => item.sheet.scope !== 'surface')
  const joined = parts.map((item, index) => ({
    group: styleGroupOf(item.sheet),
    text: item.text,
    order: index,
    sheet: item.sheet,
  }))
  const main = minifyCss(joined.map((part) => part.text).join('\n\n'))
  checkImportance(main, srcDir)
  const minified = joined.map((part) => ({ group: part.group, text: minifyCss(part.text) }))
  return { main, surface: minifyCss(processed.filter((item) => item.sheet.scope === 'surface').map((item) => item.text).join('\n\n')), parts: minified }
```

在 `scripts/build.mjs` 的 `generatedModule` 调用里加入：

```js
    STYLESHEET_PARTS: css.parts,
```

覆盖 `STYLESHEET` 的导出：

```js
    STYLESHEET: css.main,
```

在 `packages/client/src/generated.d.ts` 中加入：

```ts
  /** The same sheets in the same order, each with the page or surface that needs it. */
  export const STYLESHEET_PARTS: { group: 'base' | 'conversation' | 'composer' | 'sidebar' | 'settings' | 'home' | 'popover', text: string }[]
```

在 `vitest.config.mjs` 的 `generatedSource` 调用里补 `STYLESHEET_PARTS: []`，让已有机制规范不因缺少导出而失败。

- [ ] **Step 4: Write minimal implementation (runtime half)**

`packages/client/src/constants.ts` 的 `STYLE_PLUGIN_CSS` 已经存在，每个片段共用它，不需要新增常量。在 `packages/client/src/core/stylesheet.ts` 中替换 `mountStylesheet` 的签名：

```ts
import { STYLESHEET, STYLESHEET_PARTS } from 'virtual:dsh-claude-style/generated'
import { clearStylesheetGroups, mountStylesheet as mountSheet, updateStylesheetGroups } from '@dsh-claude-style/engine/stylesheet'
import type { StyleGroup } from '@dsh-claude-style/engine/stylesheet'

/**
 * Mount the skin's stylesheet as ordered parts: one `<style>` per group, in the
 * build's own order, with the groups the page needs filled in. A part is filled
 * or cleared in place, so its place in the cascade never moves.
 */
export function mountStylesheet(id = STYLE_ID, text = STYLESHEET, pluginCss = STYLE_PLUGIN_CSS) {
  return mountSheet({ id, text, packageName: PACKAGE_NAME, pluginCss, parts: STYLESHEET_PARTS })
}

/** The groups this page draws; the shell's three are there before any surface opens. */
const activeGroups = new Set<StyleGroup>(['base', 'conversation', 'sidebar'])

/** The opened popover surfaces: several cards can share the group, so it counts them. */
let popoverHolders = 0

/** Add the groups a surface just brought onto the page, before it paints. */
export function addStylesheetGroups(groups: readonly StyleGroup[]) {
  let changed = false
  for (const group of groups) {
    if (group === 'popover') {
      popoverHolders += 1
      changed = true
      continue
    }
    if (activeGroups.has(group)) continue
    activeGroups.add(group)
    changed = true
  }
  if (changed) {
    if (popoverHolders > 0) activeGroups.add('popover')
    updateStylesheetGroups(STYLE_ID, activeGroups, STYLESHEET_PARTS)
  }
}

/** Remove the groups a surface took away; the shell's three always stay. */
export function removeStylesheetGroups(groups: readonly StyleGroup[]) {
  let changed = false
  for (const group of groups) {
    if (group === 'popover') {
      popoverHolders = Math.max(0, popoverHolders - 1)
      if (popoverHolders === 0 && activeGroups.delete('popover')) changed = true
      continue
    }
    if (!activeGroups.has(group) || group === 'base' || group === 'conversation' || group === 'sidebar') continue
    activeGroups.delete(group)
    changed = true
  }
  if (changed) updateStylesheetGroups(STYLE_ID, activeGroups, STYLESHEET_PARTS)
}

/** Write what the page draws now into the mounted tags; used once the mount exists. */
export function syncStylesheetGroups() {
  updateStylesheetGroups(STYLE_ID, activeGroups, STYLESHEET_PARTS)
}

/** The generation ended: the next one starts with the shell's three again. */
export function resetStylesheetGroups() {
  activeGroups.clear()
  popoverHolders = 0
  for (const group of ['base', 'conversation', 'sidebar'] as const) activeGroups.add(group)
  clearStylesheetGroups(STYLE_ID)
}
```

在 `packages/engine/src/stylesheet.ts` 中定义唯一的 `StyleGroup` 与 `SheetPart`，再扩 `SheetRequest`：

```ts
export type StyleGroup = 'base' | 'conversation' | 'composer' | 'sidebar' | 'settings' | 'home' | 'popover'

/** One part of a stylesheet, in cascade order. */
export interface SheetPart {
  group: StyleGroup
  text: string
}

export interface SheetRequest {
  id: string
  text: string
  packageName: string
  pluginCss: string
  /** The sheet in ordered parts; left out, the sheet mounts whole. */
  parts?: readonly SheetPart[]
}
```

在引擎侧新增四个只操作标签的入口；打开与关闭的判断留在浏览器半边：

```ts
/** The groups a mounted sheet currently fills, by the sheet's own id. */
const filledGroups = new Map<string, Set<StyleGroup>>()

/** The tags of one mounted sheet, by group, in the build's order. */
const mountedParts = new Map<string, Map<StyleGroup, HTMLStyleElement>>()

/** The three groups the conversation page draws before any surface opens. */
export const INITIAL_STYLE_GROUPS: readonly StyleGroup[] = ['base', 'conversation', 'sidebar']

/** Write the groups `active` names into the mounted tags and clear the rest; no tag moves. */
export function updateStylesheetGroups(id: string, active: ReadonlySet<StyleGroup>, parts: readonly SheetPart[]) {
  const tags = mountedParts.get(id)
  if (tags === undefined) return
  const filled = filledGroups.get(id) ?? new Set<StyleGroup>()
  for (const part of parts) {
    const sheet = tags.get(part.group)
    if (sheet === undefined) continue
    const text = active.has(part.group) ? part.text : ''
    if (sheet.textContent !== text) sheet.textContent = text
  }
  filledGroups.set(id, new Set(active))
}

/** Add groups to a mounted sheet; returns whether anything changed. */
export function addStylesheetGroups(id: string, groups: readonly StyleGroup[], parts: readonly SheetPart[]) {
  const filled = filledGroups.get(id)
  if (filled === undefined) return false
  let changed = false
  for (const group of groups) if (!filled.has(group)) { filled.add(group); changed = true }
  if (changed) updateStylesheetGroups(id, filled, parts)
  return changed
}

/** Remove groups from a mounted sheet, except the three every conversation draws. */
export function removeStylesheetGroups(id: string, groups: readonly StyleGroup[], parts: readonly SheetPart[]) {
  const filled = filledGroups.get(id)
  if (filled === undefined) return false
  let changed = false
  for (const group of groups) {
    if (group === 'base' || group === 'conversation' || group === 'sidebar') continue
    if (filled.delete(group)) changed = true
  }
  if (changed) updateStylesheetGroups(id, filled, parts)
  return changed
}

/** Drop everything one sheet's generation mounted; a stale stop never takes a newer sheet. */
export function clearStylesheetGroups(id: string) {
  filledGroups.delete(id)
  mountedParts.delete(id)
}
```

把 `mountStylesheet` 改为：有 `parts` 时，按 `parts` 顺序为每个 group 创建一个 `<style>`，id 为 `${id}--${group}`，`data-plugin-css` 与 `pluginCss` 相同，`data-dsh-sheet-group` 写 group；初始只填 `INITIAL_STYLE_GROUPS`，其余留空。返回的停止函数移除本代创建的全部标签。

```ts
export function mountStylesheet(request: SheetRequest) {
  const { id, text, packageName, pluginCss, parts } = request
  const generation = ++lastGeneration
  if (parts === undefined) {
    mountedGenerations.set(id, generation)
    let sheet = document.getElementById(id)
    if (sheet === null) {
      sheet = document.createElement('style')
      sheet.id = id
      document.head.appendChild(sheet)
    }
    sheet.dataset.plugin = packageName
    sheet.dataset.pluginCss = pluginCss
    sheet.dataset.skinChrome = id
    if (sheet.textContent !== text) sheet.textContent = text
    return () => {
      if (mountedGenerations.get(id) === generation) sheet.remove()
    }
  }
  mountedGenerations.set(id, generation)
  const tags = new Map<StyleGroup, HTMLStyleElement>()
  for (const part of parts) {
    const tagId = `${id}--${part.group}`
    let sheet = document.getElementById(tagId) as HTMLStyleElement | null
    if (sheet === null) {
      sheet = document.createElement('style')
      sheet.id = tagId
      document.head.appendChild(sheet)
    }
    sheet.dataset.plugin = packageName
    sheet.dataset.pluginCss = pluginCss
    sheet.dataset.skinChrome = id
    sheet.dataset.sheetGroup = part.group
    const wanted = INITIAL_STYLE_GROUPS.includes(part.group) ? part.text : ''
    if (sheet.textContent !== wanted) sheet.textContent = wanted
    tags.set(part.group, sheet)
  }
  mountedParts.set(id, tags)
  filledGroups.set(id, new Set(INITIAL_STYLE_GROUPS))
  return () => {
    if (mountedGenerations.get(id) !== generation) return
    for (const sheet of tags.values()) sheet.remove()
    mountedParts.delete(id)
    filledGroups.delete(id)
  }
}
```

在 `entry.ts` 的 `own()` 里、`mountStylesheet()` 之后调用一次 `syncStylesheetGroups()`，把浏览器半边记下的组写进刚挂载的标签；在 `teardown()` 里调用 `resetStylesheetGroups()`，让下一代从三组重新开始。随后在三处既有、已经按表面收发的路径里加入或移除：

- `packages/client/src/features/settings/settings.ts` 的 `install()` 中加入 `addStylesheetGroups(['settings'])`，在返回的拆除函数里加入 `removeStylesheetGroups(['settings'])`。设置页 deferred 安装时它自己的片段随之进入页面。
- `packages/client/src/features/home/home-layout.ts` 的 `install()` 中加入 `addStylesheetGroups(['home'])`，在返回的拆除函数里加入 `removeStylesheetGroups(['home'])`。
- `packages/client/src/shared/popover.ts` 的 `setMenuPopoverOpen(card: Element, open: boolean, trigger: Element | null = null)` 中，`open === true` 时调用 `addStylesheetGroups(['popover'])`，关闭时调用一次 `removeStylesheetGroups(['popover'])`。该函数已经负责 `data-open` 的写入，因此片段与卡片状态同一次进入页面。宿主的账户菜单、首页菜单与更多菜单不走这个函数，它们由 `packages/client/src/features/account/account-footer.ts`、`packages/client/src/features/hero-menu/hero-menu.ts`、`packages/client/src/features/sidebar-entries/sidebar-entries.ts` 在 `sync` 里写自己的菜单标记；三处标记出现时同样加入 `'popover'`，标记消失时移除。为此 `popover` 组统计的是当前打开的宿主菜单数量，而不是一个布尔值。

关闭卡片撤下 `popover` 组时，卡片不能在规则撤下的那一帧露出内容。验收为此单独加一条：关闭动画结束后，卡片的 `visibility` 仍是 `hidden`，`opacity` 是 `0`。这依赖卡片在关闭状态下仍然持有的样式；如果片段一撤下样式就消失，这条检查会失败，实现就改为在关闭动画结束后才移除 `popover` 组。

三处共用 `packages/client/src/core/stylesheet.ts` 的同一个 `activeGroups`，不清空也不重复挂载片段；不新增观察者。

- [ ] **Step 5: 让重要性审计读取所有片段**

在 `packages/testing/importance-audit.mjs` 中把单个 `SHEET` 换成一个读取函数：

```js
const SHEET = 'style[data-plugin-css="dsh-claude-style/client.css"]'
const sheetTexts = (page) => page.evaluate((selector) => [...document.querySelectorAll(selector)].map((sheet) => sheet.textContent), SHEET)
```

并把 `original`、`install`、`differencesWith`、`tryInPage`、`opponentsInPage` 都改为把 `SHEET` 换成选择器列表，按标签顺序拼接与写回。审计的规则编号连续，跨片段保持构建顺序。审计的 `install` 先清空所有片段，再按原顺序只把基准片段填回；所有 `diff` 与 `drop` 都在这个合并后的文本上做，最后按原顺序把每段写回。

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run build` 与 `node packages/testing/behaviour.mjs --spec stylesheets/parts`

Expected: PASS — 页面挂载多个带 `data-dsh-sheet-group` 的片段；会话页没有 `settings` 与 `home`；打开模型选择器后 `popover` 出现，其余片段顺序不变，卡片盒仍可见；再次关闭后 `visibility` 为 `hidden`、`opacity` 为 `0`。

- [ ] **Step 7: 跑外观与重要性验收**

Run: `node packages/testing/e2e.mjs --scenario importance,shots,motion,washLine --jobs 1`

Expected: 全部通过。`importance` 的 `!important` 结论与 `importance-ledger.json` 一致；两套配色截图的可见文本与盒仍由 `shots` 场景核对。

- [ ] **Step 8: 跑滚动场景，确认样式阶段下降**

Run: `node packages/testing/e2e.mjs --scenario scrollPace,longSession --jobs 1`

Expected: `contentScroll.p95` 与 `over33` 不高于 Task 0 的基线；`longSession` 的 `passMeasures`、`passSyncs`、`layoutReads` 与 `bounds.json` 的现有上限仍通过。

- [ ] **Step 9: Commit**

```bash
git add scripts/css.mjs scripts/build.mjs scripts/virtual-modules.mjs packages/client/src/generated.d.ts packages/client/src/core/stylesheet.ts packages/engine/src/stylesheet.ts packages/client/src/entry.ts packages/client/src/features/settings/settings.ts packages/client/src/features/home/home-layout.ts packages/client/src/shared/popover.ts packages/client/src/features/account/account-footer.ts packages/client/src/features/hero-menu/hero-menu.ts packages/client/src/features/sidebar-entries/sidebar-entries.ts packages/testing/importance-audit.mjs packages/testing/specs/behaviour/stylesheets/parts.spec.mjs packages/testing/data/surface.json vitest.config.mjs
git commit -m "perf(style): 样式表按页面与表面分片挂载"
```

---

### Task 4: 收口验收与文档同步

**Files:**
- Modify: `docs/SCROLL-PERFORMANCE.md`
- Modify: `docs/SCROLL-PERFORMANCE-PLAN.md`
- Modify: `packages/testing/data/check-numbers.json`
- Test: 全部既有滚动、行为与外观通道

**Interfaces:**
- Consumes: Task 0 的四条滚动读数、Task 1 的机制规范、Task 2 的行为规范、Task 3 的分片规范。
- Produces: 一份带最终同机前后读数的实施结果；`docs/SCROLL-PERFORMANCE.md` 的验收目标换成实际读数与对应上限；变更记录按实际交付更新；本计划的复选框全部勾选或写明未做项与原因。

- [ ] **Step 1: 记录最终同机前后读数**

Task 0 只记录基线，不设会失败的滚动上限。等 Task 1 至 Task 3 全部落地后，先在同一台机器上运行三次并取中位数：

```sh
node packages/testing/e2e.mjs --scenario scrollPace --jobs 1
node packages/testing/e2e.mjs --scenario scrollPace --jobs 1
node packages/testing/e2e.mjs --scenario scrollPace --jobs 1
```

Record `contentScroll.passes`、`contentScroll.rects`、`contentScroll.extraFrames`、`contentScroll.p95`、`contentScroll.over33`、`contentScroll.longTotal`、`windowScroll.passes`、`windowScroll.rects` and the idle values. 与 Task 0 的基线并列写进提交说明。

- [ ] **Step 2: 把最终读数写成上限**

把上面的中位数写进 `packages/testing/data/bounds.json`：

```json
    {
      "name": "scrollPaceContentPasses",
      "value": 0,
      "reason": "A wheel inside the conversation moves content, not the window: the scheduler's viewport reason must not wake a pass. The final measured run recorded this reading, and any non-zero value is the old path coming back."
    },
    {
      "name": "scrollPaceContentRects",
      "value": 960,
      "reason": "The most boxes one 4 s content scroll may read. The bound sits above the final median and below the task-0 baseline of 1256, so the skin's repeated reads cannot return unnoticed."
    },
    {
      "name": "scrollPaceFrameP95Ms",
      "value": 33,
      "reason": "A frame at 60 Hz is 16.7 ms and two frames are 33.4 ms. The scroll is judged on its p95 frame, so the bound is two frames: a dropped-frame run trips it while ordinary runner jitter does not."
    },
    {
      "name": "scrollPaceOver33Frames",
      "value": 14,
      "reason": "Ten percent of the 138 frames the 4 s scroll recorded at four times CPU slowdown. The bound leaves room for one or two bursts a shared runner adds and still fails a run where scrolling drops frames throughout."
    }
```

`scrollPaceContentRects` 的 960 只是起始上限：最终中位数高于它时按实际读数上调并在 reason 里写明；最终读数没有下降时不改上限，把原因写进 Task 4 的实施结果。`scrollPaceFrameP95Ms` 与 `scrollPaceOver33Frames` 是机器上限，沿用上面的理由。

- [ ] **Step 3: 在场景里加入收口检查**

在 packages/testing/scroll-pace.mjs 的 `assert` 末尾追加：

```js
        check('三项整改后滚动路径只剩已打开表面的重定位',
          result.contentScroll.passes === 0 && result.contentScroll.extraFrames === 0 && result.contentScroll.rects <= bound('scrollPaceContentRects'),
          `passes=${result.contentScroll.passes}, extra frames=${result.contentScroll.extraFrames}, rects=${result.contentScroll.rects}, bound ${bound('scrollPaceContentRects')}`),
```

Run: `node packages/testing/check-numbers.mjs`

Expected: `packages/testing/data/check-numbers.json` 记录这条检查与它读到的数字。

- [ ] **Step 4: 运行收口检查**

Run: `node packages/testing/e2e.mjs --scenario scrollPace --jobs 1`

Expected: PASS — `contentScroll.passes` 为 0，`extraFrames` 为 0，`rects` 不高于上限，`p95` 与 `over33` 在上限内。若任一任务未完成，这条检查会以对应读数失败。

- [ ] **Step 5: 运行完整验收通道**

Run:

```sh
DSH_CLAUDE_STYLE_PASS_READINGS=1 npm run build
npx vitest run packages/testing/specs/mechanism/scheduler-cost/
npm run lint
node packages/testing/e2e.mjs --scenario scrollPace,readerScroll,doorPin,streamPace,longSession --jobs 1
node packages/testing/e2e.mjs --scenario motion,washLine,shots,importance --jobs 1
node packages/testing/behaviour.mjs --feature view-tabs,composer,context-stats,chat-fold,chat-follow
```

Expected: 全部通过；`scrollPace` 的四条读数在 `bounds.json` 内；`longSession` 仍在现有上限内；`importance` 的结论与台账一致；两套配色的截图仍符合 `shots` 场景的核对；行为层不再点名没有行为规范的 `turn-nav` 目录。读数采集完成后运行一次普通的 `npm run build`，把不带读数入口的正式产物写回 `lib/`。

- [ ] **Step 6: 同步文档**

在 `docs/SCROLL-PERFORMANCE.md` 的「验收方法与目标」之后追加「实施结果」一节，写明：

- 哪一项已落地，哪一项未落地；
- 三项各自的同机前后读数；
- 未落地项的原因与它仍然覆盖的风险；
- `scrollPace` 作为后续回归读数的入口。

在 `docs/CHANGELOG.md` 的 `0.20.1` 一节里核对本项的实际交付描述，只写最终能力，不写实施过程。

- [ ] **Step 7: 勾选本计划**

把本文件每个已完成步骤的 `- [ ]` 改成 `- [x]`；未完成的步骤保留未勾选，并在文末「实施结果」写明原因。不要改写已完成步骤里的代码与命令。

- [ ] **Step 8: Commit**

```bash
git add docs/SCROLL-PERFORMANCE.md docs/SCROLL-PERFORMANCE-PLAN.md docs/changes/scroll-performance-plan.json packages/testing/data/check-numbers.json packages/testing/scroll-pace.mjs
git commit -m "docs(perf): 记录滚动整改的读数与实施结果"
```

---

## Self-Review

**1. 方案覆盖**：`docs/SCROLL-PERFORMANCE.md` 的三项整改分别对应 Task 1（滚动与窗口尺寸变化分离）、Task 2（窗口滚动只重定位打开的表面）、Task 3（样式表分片挂载）；Task 0 提供读数，Task 4 收口与同步文档。每项都给出了要改的文件、失败测试、最小实现代码、验证命令与提交边界。

**2. 占位符扫描**：每一步都给出了精确路径、可运行的代码与预期结果；没有 `TBD`、`TODO` 或「类似上一任务」的引用。Task 3 的样式分组函数是完整代码；Task 4 的三次运行与中位数取法已写明。

**3. 类型一致**：`FeatureHandle.reposition` 的 `'scroll' | 'viewport' | 'composer'` 在 Task 1 定义，Task 2 的所有 `reposition` 实现沿用同一联合；`StyleGroup` 在 Task 3 的 `packages/engine/src/stylesheet.ts` 定义，`generated.d.ts` 使用同一个字面量联合；`SheetPart` 的 `group` 与 `text` 字段在构建、生成模块与运行时三处保持一致。

**4. 依赖方向**：`packages/engine` 不导入浏览器半边的模块；Task 3 的 `StyleGroup` 定义在引擎侧，浏览器半边从引擎类型导入；样式分组由构建与浏览器半边决定，引擎只执行挂载与更新。

**5. 测试边界**：机制规范只读调度器与帧管线的结果；行为规范读挂载后的片段与页面计算样式；端到端场景读页面自己记下的读数。没有把内部实现细节写进行为规范。

**6. 验收边界**：Task 0 只记录基线，不新增检查；Task 4 的收口检查在 Tasks 1–3 未完成时会失败，完成后才通过。所有上限都写进 `packages/testing/data/bounds.json`，并逐条写明理由。

---

## 实施结果

Task 0、Task 1、Task 2 与 Task 3 的代码与离线门禁已完成：

- Task 0：`scrollPace` 场景、登记、时序名与最小采样下限已写入；`check-numbers` 通过。端到端读数未采集，因为本机 `dsh --version` 报 `Harness CLI not found`，e2e 在启动阶段退出。
- Task 1 与 Task 2：调度器已拆分会话滚动、窗口滚动与窗口尺寸变化；七个打开表面句柄声明 `repositionsOnScroll`；`view-tabs` 在标题栏模式跳过位移盒。机制规范 260 项通过，行为规范 212 项通过。
- Task 3：主题样式表按构建顺序分片，运行时按页面与表面填充占位标签；设置与首页规则只在对应页面进入，共享卡片规则常驻以保证关闭态；重要性审计读取全部片段。`npm run lint`、`npm run build` 与相关行为规范通过。
- Task 4：文档已如实记录完成项与未验证项；`scrollPace` 的真实读数、`longSession`、`shots` 与 `importance` 端到端场景尚待安装宿主 CLI 后执行，计划中的复选框因此没有全部勾选。
