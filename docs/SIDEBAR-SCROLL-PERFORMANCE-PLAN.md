# 侧栏拖动与会话滚动性能修改计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变功能、动画、界面与样式的条件下，消除侧栏拖动期间的额外重排与无关功能唤醒，并减少会话滚动与会话页常驻样式匹配的规模。

**Architecture:** 先把拖动与滚动各自的原因变成页面可读的读数，再分别处理侧栏观察者的过滤、拖动期宽度依赖的唤醒集合、样式分组的职责拆分、拖动期内部换行的延迟落布局，最后在真实桌面窗口上补齐滚动与外观验收。每项改动只改变“什么时候算、算几次、哪组规则在页面上”，不改变算出的值、写出的标记、动画的时长曲线或元素的盒与层级。

**技术栈：** TypeScript、esbuild、PostCSS、Vitest 浏览器模式、Playwright、仓库自己的冒烟、行为、端到端通道。

## Global Constraints

- 可见结果不变：动画的时长、曲线、起点与终点不变；元素的盒、层级、颜色与圆角不变；交互的命中区域与键盘路径不变。
- 观察仍只有一个 `MutationObserver` 与一套 `ResizeObserver` 登记（D40）：`MutationObserver`、`ResizeObserver`、`requestAnimationFrame` 只允许在 `packages/engine/src/bus.ts` 与 `packages/engine/src/frame.ts` 里创建。
- 宿主查询只走 `packages/engine/src/host.ts` 的访问器或 `packages/engine/src/bus.ts` 的清单；新选择器写进 `packages/contracts/src/dom.ts`，并在 `packages/contracts/src/table.ts` 登记（D3）。
- 样式里不写时长、缓动曲线与 9 以上的层级字面值；需要新值时先加进 `packages/client/src/theme/tokens.json`（D9）。
- 不改变偏好默认值与设置页上的任何一行（`packages/contracts/src/prefs.ts` 不动）。
- `lib/` 是构建产物，源码改动后只运行 `npm run build`（D47）。
- 一个源文件接近 750 行时停下，先拆分再继续（`npm run lint` 会拒绝越过这条线）。
- 提交标题用中文与 Conventional Commit 前缀，一次提交只带一个逻辑改动。
- 每个任务只运行它点名的规范或场景；真实宿主端到端读数集中放在 Task 7，不提前把未取得的读数写成结论。
- 真实桌面窗口没有完整 `dsh` CLI 时，Task 7 的读数项保持未完成；不把替代页面读数冒充真实宿主读数。

---

## File Structure

| 文件 | 责任 | 本计划中的动作 |
|---|---|---|
| `packages/engine/src/bus.ts` | 观察总线、尺寸订阅、按目标分发 | 修改：新增可观测的尺寸回调计数与订阅理由，不改分发算法 |
| `packages/engine/src/scheduler.ts` | 唤醒理由与帧内通行 | 修改：区分侧栏结构变化与侧栏宽度变化 |
| `packages/client/src/core/scheduler.ts` | 调度器句柄与页面计数 | 修改：登记新的唤醒理由 |
| `packages/client/src/features/sidebar-status/sidebar-status.ts` | 侧栏行状态 | 修改：宽度写入不再走 `style` 过滤；宽度跟随改走尺寸订阅 |
| `packages/client/src/features/sidebar-status/row-status.ts` | 行尾状态与标题可见性 | 修改：宽度读数进入可比较的尺寸回调，读取次数可数 |
| `packages/client/src/features/manual-unread/manual-unread.ts` | 手动未读标记 | 修改：声明不读宽度 |
| `packages/client/src/features/date-groups/date-groups.ts` | 日期分组 | 修改：声明不读宽度 |
| `packages/client/src/features/sidebar-entries/sidebar-entries.ts` | 侧栏入口隐藏与更多菜单 | 修改：声明不读宽度 |
| `packages/client/src/features/workspace/workspace-view.ts` | 工作区分段控件 | 修改：拖动期宽度测量节流，拖动结束补齐 |
| `packages/client/src/features/composer/composer.ts` | 输入卡响应式 | 修改：只声明真正依赖的唤醒理由 |
| `packages/client/src/features/account/account-footer.ts` | 页脚账户行宽度 | 修改：宽度写入按需重测 |
| `packages/client/src/features/context-stats/context-stats.ts` | 上下文统计 | 修改：宽度依赖与内容依赖分开 |
| `packages/client/src/shared/page-scale-columns.ts` | 页面缩放下宿主三列 | 修改：写入拖动期标记；三列、侧栏宽度与手柄位置逐帧跟随指针 |
| `scripts/css.mjs` | 样式分组 | 修改：拆出 `popover` 组的关闭态基态与打开态规则 |
| `packages/client/src/shared/popover.css` | 弹层卡片 | 修改：把打开态规则与关闭态基态分区 |
| `packages/client/src/core/stylesheet.ts` | 组挂载 | 修改：弹层组按打开数挂载，关闭后延迟撤下 |
| `packages/engine/src/stylesheet.ts` | 占位标签与填写 | 只读 |
| `packages/testing/specs/mechanism/scheduler-cost/` | 唤醒理由机制规范 | 新建：侧栏宽度与侧栏结构分开 |
| `packages/testing/specs/mechanism/sidebar-status/` | 侧栏状态规范 | 新建：宽度写入不唤醒，行结构变化仍唤醒 |
| `packages/testing/specs/behaviour/sidebar-drag/` | 拖动行为规范 | 新建：拖动期间与结束后的盒、行高、截断与中线 |
| `packages/testing/specs/behaviour/stylesheets/` | 样式分组规范 | 修改：`popover` 组与关闭态基态 |
| `<packages/testing/sidebar-drag.mjs>` | 拖动读数场景 | 新建：侧栏拖动每帧的通行、布局、样式重算、帧间隔 |
| `packages/testing/scenarios.mjs` | 场景登记 | 修改：登记 `sidebarDrag` |
| `packages/contracts/src/timing.ts` | 端到端场景名 | 修改：登记 `sidebarDrag` |
| `packages/testing/data/bounds.json` | 读数上限 | 修改：新增拖动与滚动上限及理由 |
| `packages/testing/data/check-numbers.json` | 检查数字 | 修改：由工具重写 |
| `docs/SIDEBAR-SCROLL-PERFORMANCE.md` | 根因与方案 | 已新建 |
| `docs/SIDEBAR-SCROLL-PERFORMANCE-PLAN.md` | 本计划 | 新建 |
| `docs/changes/sidebar-scroll-performance.json` | 变更记录 | 新建 |
| `README.md`、`README.en.md` | 文档索引 | 修改：加入两份新文档 |

表里不带反引号的文件是这份计划要新建的，目前还不存在；带反引号的路径都能在仓库里打开。

---

### Task 0: 先让拖动成本成为可重复的读数

**Files:**
- Create: `<packages/testing/sidebar-drag.mjs>`
- Modify: `packages/testing/scenarios.mjs:1-40,560-610`
- Modify: `packages/contracts/src/timing.ts:19`
- Modify: `packages/testing/data/bounds.json`
- Test: `<packages/testing/sidebar-drag.mjs>`

**Interfaces:**
- Consumes: `sendPrompt`、`waitForTurn`（`packages/testing/prompt.mjs`），`bound`（`packages/testing/bounds.mjs`），`check`（`packages/testing/lane.mjs`）。
- Produces: 场景 `sidebarDrag`；页面全局 `window.__sidebarDrag`，形状为 `{ passes, measures, syncs, rects, styles, mutations, frames, longtasks, layoutCount, recalcCount }`；读数 `{ idle, drag, afterDrag }`。

- [ ] **Step 1: Write the failing test**

新建 `<packages/testing/sidebar-drag.mjs>`：

```js
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
import { check } from './lane.mjs'
import { bound } from './bounds.mjs'
import { sendPrompt, waitForTurn } from './prompt.mjs'

/** The host's sidebar drag handle and the frame the host writes its tracks on. */
const HANDLE = '[data-side="sidebar"]'
const FRAME = '[data-dsh-claude-part~="layout-frame"]'
/** How many fill turns put the transcript well past one screen. */
const FILL_TURNS = 8

/** Start the readings before the page's own scripts run. */
function initScript() {
  const state = window.__sidebarDrag = {
    passes: [], rects: 0, styles: 0, mutations: 0, frames: [], longtasks: [],
  }
  window.__dshPassReadings?.clear()
  window.__sidebarDragClear = () => {
    state.passes.length = 0
    state.rects = 0
    state.styles = 0
    state.mutations = 0
    state.frames.length = 0
    state.longtasks.length = 0
    window.__dshPassReadings?.clear()
  }
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) state.longtasks.push(Math.round(entry.duration))
  }).observe({ entryTypes: ['longtask'] })
  let last = performance.now()
  const tick = (now) => {
    state.frames.push(Math.round((now - last) * 100) / 100)
    last = now
    if (state.frames.length < 12000) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  const boxed = (original) => function (...args) { state.rects += 1; return original.apply(this, args) }
  Element.prototype.getBoundingClientRect = boxed(Element.prototype.getBoundingClientRect)
  Element.prototype.getClientRects = boxed(Element.prototype.getClientRects)
  const styled = (original) => function (...args) { state.styles += 1; return original.apply(this, args) }
  window.getComputedStyle = styled(window.getComputedStyle)
  const observer = new MutationObserver((records) => { state.mutations += records.length })
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true })
}

/** Empty the counters before one phase. */
function reset(page) {
  return page.evaluate(() => window.__sidebarDragClear())
}

/** Read one phase's counters as the numbers the checks bound. */
function read(page) {
  return page.evaluate(() => {
    const state = window.__sidebarDrag
    const gaps = state.frames.slice().sort((left, right) => left - right)
    const at = (share) => gaps.length === 0 ? 0 : gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * share))]
    const passes = window.__dshPassReadings ? window.__dshPassReadings.read() : []
    return {
      passReadings: window.__dshPassReadings !== undefined,
      passes: passes.length,
      measures: passes.map((reading) => reading.measures),
      syncs: passes.map((reading) => reading.syncs),
      rects: state.rects,
      styles: state.styles,
      mutations: state.mutations,
      frames: gaps.length,
      p95: at(0.95),
      worst: gaps.length === 0 ? 0 : gaps[gaps.length - 1],
      over33: gaps.filter((value) => value > 33).length,
      longTotal: state.longtasks.reduce((sum, duration) => sum + duration, 0),
    }
  })
}

/** Drag the sidebar's edge by a bounded travel, one pointermove a frame. */
async function drag(page, ms) {
  const box = await page.locator(HANDLE).boundingBox()
  if (box === null) throw new Error('sidebarDrag: the page carries no sidebar drag handle')
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  const started = Date.now()
  let steps = 0
  while (Date.now() - started < ms) {
    const at = Math.sin(steps / 8)
    await page.mouse.move(start.x + at * 80, start.y)
    steps += 1
    await page.waitForTimeout(16)
  }
  await page.mouse.up()
  return steps
}

export function sidebarDragScenario() {
  return {
    script: 'long',
    prompt: 'write a long answer',
    delayMs: 60,
    viewport: { width: 1440, height: 900 },
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
      const steps = await drag(page, 1600)
      const drag = { ...await read(page), steps }

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
```

在 `packages/testing/scenarios.mjs` 顶部加入：

```js
import { sidebarDragScenario } from './sidebar-drag.mjs'
```

在场景表里加入：

```js
  sidebarDrag: sidebarDragScenario(),
```

在 `packages/contracts/src/timing.ts` 的 `E2E_SCENARIOS` 里加入 `'sidebarDrag'`。

- [ ] **Step 2: Run test to verify it fails**

Run: `node packages/testing/e2e.mjs --scenario sidebarDrag --jobs 1`

Expected: FAIL，`bounds: sidebarDragMinFrames is not in packages/testing/data/bounds.json`，或 `window.__dshPassReadings` 不存在。

- [ ] **Step 3: Write minimal implementation**

在 `packages/testing/data/bounds.json` 的 `bounds` 数组末尾加入：

```json
{
  "name": "sidebarDragMinFrames",
  "value": 30,
  "reason": "The drag phase must carry at least thirty animation-frame samples. The measured stand-in drag recorded ninety frames over ninety pointer positions; a reading under this means the drag sampler stopped early rather than the page becoming cheaper."
},
{
  "name": "sidebarDragFrameP95Ms",
  "value": 33,
  "reason": "Two 60 Hz frame budgets. The stand-in drag with the skin's sheet on measured 33.3–33.4 ms p95 and 16.8–16.9 ms with the sheet off; the bound sits at the budget the fix must reach, and a real desktop reading that the host's own drag already exceeds is compared as an increment instead."
},
{
  "name": "sidebarDragMaxOverBudgetFrames",
  "value": 2,
  "reason": "The measured stand-in drag with the sheet off left at most four frames over 33 ms out of ninety, the host's own reflow alone. Two leaves the host's own tail room while a skin-added reflow of seven to eleven frames trips it."
}
```

构建带通行读数的产物：

```sh
DSH_CLAUDE_STYLE_PASS_READINGS=1 npm run build
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node packages/testing/e2e.mjs --scenario sidebarDrag --jobs 1`

Expected: PASS。若真实桌面尚未安装，读数项保持未完成，并在 Task 7 统一补齐。

- [ ] **Step 5: 提交**

```sh
git add packages/testing/sidebar-drag.mjs packages/testing/scenarios.mjs packages/contracts/src/timing.ts packages/testing/data/bounds.json
git commit -m "feat(test): 新增侧栏拖动性能场景"
```

---

### Task 1: 把侧栏结构变化与宽度变化分开

**Files:**
- Modify: `packages/engine/src/scheduler.ts:30-50,404-480`
- Modify: `packages/client/src/core/scheduler.ts:79-96`
- Test: `<packages/testing/specs/mechanism/scheduler-cost/sidebar-width.spec.ts>`

**Interfaces:**
- Consumes: 现有 `WakeReason`、`schedule(options)`、`handle.wakesOn`。
- Produces: `WakeReason` 新增 `'sidebar-width'`；`SchedulerSources` 新增可选 `observeSidebarWidth?(listener: () => void): () => void`；客户端的 `installScheduler` 传入一个由 `observeSize` 支持的宽度观察。

- [ ] **Step 1: Write the failing test**

新建 `<packages/testing/specs/mechanism/scheduler-cost/sidebar-width.spec.ts>`：

```ts
/**
 * A sidebar width write is not a structural sidebar change: a handle that
 * reads structure must not run for it, while a handle that reads boxes must.
 *
 * @capability scheduler-cost
 * @features engine, sidebar-status
 * @risk Every frame of a sidebar drag wakes the date grouping, unread marks and
 *       panel entries, so a width the reader is still choosing costs the work
 *       of a whole sidebar rebuild.
 */
import { expect, test } from 'vitest'
import { SIDEBAR_SLOT_SELECTOR } from '@dsh-claude-style/contracts/dom'
import { installScheduler } from '@dsh-claude-style/engine/scheduler'
import { cleanupWith, frames } from '../../fixtures/teardown'
import { attach } from '../../fixtures/host-markup'

test('a sidebar width change runs only the handles that declare sidebar-width', async () => {
  const calls: string[] = []
  const widthListeners = new Set<() => void>()
  const stop = installScheduler(
    {} as never,
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
  await frames(2)
  calls.length = 0
  for (const listener of widthListeners) listener()
  await frames(2)
  expect(calls).toEqual(['width'])
})

test('a structural sidebar change still runs the structural handles', async () => {
  const calls: string[] = []
  const stop = installScheduler(
    {} as never,
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
      observeSidebarWidth: () => () => {},
    },
  )
  cleanupWith(stop)
  const sidebar = attach(document.body, SIDEBAR_SLOT_SELECTOR)
  await frames(2)
  calls.length = 0
  sidebar.append(document.createElement('i'))
  await frames(2)
  expect(calls).toContain('structure')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/testing/specs/mechanism/scheduler-cost/sidebar-width.spec.ts`

Expected: FAIL，`'sidebar-width'` 不在 `WakeReason` 类型里，`observeSidebarWidth` 不在 `SchedulerSources` 里。

- [ ] **Step 3: Write minimal implementation**

在 `packages/engine/src/scheduler.ts` 的 `WakeReason` 中加入：

```ts
export type WakeReason = 'content' | 'sidebar' | 'sidebar-width' | 'composer' | 'header' | 'viewport' | 'other'
```

在 `SchedulerSources` 中加入：

```ts
  /**
   * The sidebar column's own width, as a change of boxes rather than of
   * structure. The one owner of the size observation is the engine; the skin
   * hands the answer in (D73).
   */
  observeSidebarWidth?(listener: () => void): () => void
```

在订阅与拆解附近加入：

```ts
  const stopSidebarWidth = sources.observeSidebarWidth?.(() => {
    schedule({ reason: 'sidebar-width' })
  }) ?? null
```

在返回的拆解函数里，与其它订阅一起调用：

```ts
    if (stopSidebarWidth !== null) stopSidebarWidth()
```

在 `packages/client/src/core/scheduler.ts` 的 `installEngineScheduler` 调用里加入：

```ts
    observeSidebarWidth: listener => {
      const root = document.querySelector<HTMLElement>(SIDEBAR_ROOT_SELECTOR)
      if (root === null) return () => {}
      let width = 0
      return observeSize(root, (entries) => {
        const size = entries[entries.length - 1]?.borderBoxSize
        const next = size !== undefined && size.length > 0 ? size[0].inlineSize : entries[entries.length - 1]?.contentRect.width ?? 0
        if (width !== 0 && Math.abs(next - width) < 0.5) return
        width = next
        listener()
      })
    },
```

并在 `packages/client/src/core/scheduler.ts` 的导入里补上 `SIDEBAR_ROOT_SELECTOR`、`observeSize`。如果根节点会随折叠被替换，回调需要按现有 `findSidebarRoot()` 重新取根；本任务先用 `SIDEBAR_ROOT_SELECTOR` 完成一次性绑定，Task 4 把它移到宿主访问模块并在根节点替换时重新绑定。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/testing/specs/mechanism/scheduler-cost/sidebar-width.spec.ts`

Expected: PASS。

- [ ] **Step 5: 提交**

```sh
git add packages/engine/src/scheduler.ts packages/client/src/core/scheduler.ts packages/testing/specs/mechanism/scheduler-cost/sidebar-width.spec.ts
git commit -m "feat(scheduler): 区分侧栏结构与宽度变化"
```

---

### Task 2: 侧栏观察者不再把宽度写入当结构变化

**Files:**
- Modify: `packages/client/src/features/sidebar-status/sidebar-status.ts:18-35`
- Modify: `packages/client/src/features/sidebar-status/row-status.ts:40-70`
- Modify: `packages/client/src/features/manual-unread/manual-unread.ts:160-170`
- Modify: `packages/client/src/features/date-groups/date-groups.ts:500-510`
- Modify: `packages/client/src/features/sidebar-entries/sidebar-entries.ts:278-286`
- Test: `<packages/testing/specs/mechanism/sidebar-status/width.spec.ts>`

**Interfaces:**
- Consumes: Task 1 的 `'sidebar-width'` 理由；现有 `observeSize`、`subscribeMutations`。
- Produces: `sidebar-status` 的根节点订阅去掉 `style` 过滤器；`RightSessionStatus` 的宽度读数由尺寸回调驱动；其余三个句柄不声明 `'sidebar-width'`。

- [ ] **Step 1: Write the failing test**

新建 `<packages/testing/specs/mechanism/sidebar-status/width.spec.ts>`：

```ts
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
import { SESSION_PHASE_ATTRIBUTE } from '@dsh-claude-style/contracts/dom'
import { installSidebarStatus } from '@dsh-claude-style/client/pure'
import { surfaceAttribute } from '../../fixtures/surface'
import { frames } from '../../fixtures/frames'
import { hostElement } from '../../fixtures/host-markup'

const PART = surfaceAttribute('skin.part')
const SIDEBAR_SLOT_SELECTOR = '[data-slot="sidebar"]'

function sidebar() {
  const slot = hostElement(SIDEBAR_SLOT_SELECTOR)
  document.body.append(slot)
  const root = document.createElement('div')
  root.setAttribute(PART, 'sidebar-root')
  slot.append(root)
  const row = document.createElement('div')
  row.setAttribute(PART, 'session-row')
  const seat = document.createElement('span')
  seat.setAttribute(PART, 'row-slot')
  const dot = document.createElement('span')
  dot.setAttribute(SESSION_PHASE_ATTRIBUTE, 'idle')
  seat.append(dot)
  const title = document.createElement('span')
  title.setAttribute(PART, 'row-title')
  title.textContent = 'A session'
  row.append(seat, title)
  root.append(row)
  return { root, row, dot }
}

const stops: (() => void)[] = []
afterEach(() => {
  for (const stop of stops.splice(0).reverse()) stop()
})

function installed() {
  const passes: number[] = []
  const ui = { schedule: () => { passes.push(1) } }
  stops.push(installSidebarStatus(undefined as never, ui as never))
  const measure = () => ui.sidebarStatus?.measure()
  const sync = () => ui.sidebarStatus?.sync()
  sync()
  return { passes, sync }
}

test('a width write on the sidebar root does not wake the status pass', async () => {
  const { root } = sidebar()
  const feature = installed()
  await frames(2)
  feature.passes.length = 0
  root.style.width = '311px'
  await new Promise(resolve => setTimeout(resolve, 0))
  await frames(2)
  expect(feature.passes).toEqual([])
})

test('a row phase change still wakes the status pass', async () => {
  const { dot } = sidebar()
  const feature = installed()
  await frames(2)
  feature.passes.length = 0
  dot.setAttribute(SESSION_PHASE_ATTRIBUTE, 'ongoing')
  await new Promise(resolve => setTimeout(resolve, 0))
  await frames(2)
  expect(feature.passes.length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/testing/specs/mechanism/sidebar-status/width.spec.ts`

Expected: FAIL，宽度写入仍然触发 `schedule`，第一条用例的 `passes` 不为空。

- [ ] **Step 3: Write minimal implementation**

`packages/client/src/features/sidebar-status/sidebar-status.ts` 的根节点订阅改为：

```ts
      stopWatch = root === null ? null : subscribeMutations(root, {
        childList: true, characterData: true, subtree: true,
        // A width write is the host's own drag, and the pass reads boxes, not
        // the style attribute (D40). The row's own structure, phase and class
        // changes still arrive here.
        attributeFilter: [SESSION_PHASE_ATTRIBUTE, PART_ATTR, 'hidden', 'aria-hidden', 'contenteditable', 'class'],
      }, schedule)
```

`packages/client/src/features/sidebar-status/row-status.ts` 的 `measure()` 保持现有读数；`sync()` 里标题尺寸观察改为只在标题宽度真的变化时请求一遍：

```ts
    if (title !== this.title) {
      this.stopTitleSize?.()
      this.title = title
      let width = 0
      this.stopTitleSize = title && this.changed ? observeSize(title, (entries) => {
        const size = entries[entries.length - 1]?.borderBoxSize
        const next = size !== undefined && size.length > 0 ? size[0].inlineSize : entries[entries.length - 1]?.contentRect.width ?? 0
        if (width !== 0 && Math.abs(next - width) < 0.5) return
        width = next
        this.changed?.()
      }) : null
    }
```

`manual-unread.ts`、`date-groups.ts` 与 `sidebar-entries.ts` 的 `wakesOn` 保持 `['sidebar']`，不加入 `'sidebar-width'`。这三处不需要额外代码；它们是 Task 1 新理由的负向用例。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/testing/specs/mechanism/sidebar-status/width.spec.ts`

Expected: PASS；宽度写入不唤醒，行状态改变仍唤醒。

- [ ] **Step 5: 提交**

```sh
git add packages/client/src/features/sidebar-status/sidebar-status.ts packages/client/src/features/sidebar-status/row-status.ts packages/testing/specs/mechanism/sidebar-status/width.spec.ts
git commit -m "fix(sidebar-status): 宽度写入不再唤醒状态遍历"
```

---

### Task 3: 拖动期只同步真正依赖盒的功能

**Files:**
- Modify: `packages/client/src/features/composer/composer.ts:481-490`
- Modify: `packages/client/src/features/composer/responsive.ts:49-80`
- Modify: `packages/client/src/features/account/account-footer.ts:424-433,567-580`
- Modify: `packages/client/src/features/context-stats/context-stats.ts:32-55`
- Modify: `packages/client/src/features/workspace/workspace-view.ts:228-242`
- Modify: `packages/client/src/features/row-skip/row-skip.ts:89-120`
- Test: `<packages/testing/specs/mechanism/scheduler-cost/width-audience.spec.ts>`

**Interfaces:**
- Consumes: Task 1 的 `'sidebar-width'`。
- Produces: `composer`、`footer`、`contextStats` 三个宽度依赖句柄声明 `'sidebar-width'`；工作区分段控件只在自己的结构变化与释放后的通行里测量，`row-skip` 在拖动期间保留行标记、释放后统一重排一次。响应式测量与账户行盒测量在纯宽度变化上仍执行一次，但不重复扫描整个侧栏。

- [ ] **Step 1: Write the failing test**

新建 `<packages/testing/specs/mechanism/scheduler-cost/width-audience.spec.ts>`：

```ts
/**
 * Handles that read a box across the sidebar's own width run for a width
 * change; handles that only read structure do not.
 *
 * @capability scheduler-cost
 * @features engine, composer, account
 * @risk A sidebar width change runs every sidebar feature, including the ones
 *       that never read a width, so a drag pays an entire sidebar rebuild a frame.
 */
import { expect, test } from 'vitest'
import { installScheduler } from '@dsh-claude-style/engine/scheduler'
import { cleanupWith, frames } from '../../fixtures/teardown'

test('a width change reaches the box readers and no structure reader', async () => {
  const calls: string[] = []
  const widthListeners = new Set<() => void>()
  const stop = installScheduler(
    {} as never,
    {
      retire: () => {},
      responsive: { wakesOn: ['sidebar-width', 'composer'], measure: () => calls.push('responsive.measure'), sync: () => calls.push('responsive.sync') },
      account: { wakesOn: ['sidebar', 'sidebar-width'], measure: () => calls.push('account.measure'), sync: () => calls.push('account.sync') },
      entries: { wakesOn: ['sidebar'], sync: () => calls.push('entries.sync') },
    },
    ['responsive', 'account', 'entries'],
    {
      copyChange: [], refresh: [], start: () => {}, systemMotionChanged: () => {},
      observeSidebarWidth: (listener) => {
        widthListeners.add(listener)
        return () => widthListeners.delete(listener)
      },
    },
  )
  cleanupWith(stop)
  await frames(2)
  calls.length = 0
  for (const listener of widthListeners) listener()
  await frames(2)
  expect(calls).toEqual(['responsive.measure', 'responsive.sync', 'account.measure', 'account.sync'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/testing/specs/mechanism/scheduler-cost/width-audience.spec.ts`

Expected: FAIL，`sidebar-width` 理由尚未被这些句柄声明，或客户端的宽度观察尚未接线。

- [ ] **Step 3: Write minimal implementation**

`packages/client/src/features/composer/composer.ts` 的句柄声明改为：

```ts
  ui.composer = {
    sync: syncComposer,
    wakesOn: ['content', 'composer', 'viewport', 'header', 'sidebar-width'],
    // ...
  }
```

`packages/client/src/features/account/account-footer.ts` 的句柄声明改为：

```ts
    skipOnContentOnly: true,
    wakesOn: ['sidebar', 'sidebar-width', 'composer'],
```

`packages/client/src/features/context-stats/context-stats.ts` 的句柄声明改为：

```ts
    wakesOn: ['content', 'composer', 'sidebar', 'sidebar-width'],
```

`packages/client/src/features/workspace/workspace-view.ts` 的 `ui.workspace` 声明改为：

```ts
  ui.workspace = {
    measure,
    sync,
    wakesOn: ['sidebar', 'sidebar-width'],
    onCopyChange() { list.copyChanged() },
  }
```

`packages/client/src/features/composer/responsive.ts` 的 `measure()` 保留现有 `requestFrame`；它在宽度变化上只读取已登记的 `rows`，不重新查询页面。`account-footer.ts` 的 `measureAccountRow()` 同样只读取 `findFootArea()` 已找到的节点。两处都不得新增选择器查询。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/testing/specs/mechanism/scheduler-cost/width-audience.spec.ts`

Expected: PASS。

- [ ] **Step 5: 提交**

```sh
git add packages/client/src/features/composer/composer.ts packages/client/src/features/account/account-footer.ts packages/client/src/features/context-stats/context-stats.ts packages/client/src/features/workspace/workspace-view.ts packages/testing/specs/mechanism/scheduler-cost/width-audience.spec.ts
git commit -m "feat(scheduler): 宽度变化只唤醒盒读取句柄"
```

---

### Task 4: 侧栏根节点的宽度订阅跟随替换

**Files:**
- Modify: `packages/engine/src/scheduler.ts` 的 `observeSidebarWidth` 接线
- Modify: `packages/client/src/core/scheduler.ts`
- Modify: `packages/engine/src/host.ts`
- Modify: `packages/contracts/src/table.ts:227`
- Test: `<packages/testing/specs/mechanism/scheduler-cost/sidebar-width-rebind.spec.ts>`

**Interfaces:**
- Consumes: `findSidebarRoot()`、`observeMatches()`。
- Produces: `SchedulerSources.observeSidebarWidth` 在根节点被替换时自动重绑；拆解时释放旧根节点与新根节点的订阅。

- [ ] **Step 1: Write the failing test**

新建 `<packages/testing/specs/mechanism/scheduler-cost/sidebar-width-rebind.spec.ts>`：

```ts
/**
 * A sidebar root replaced while the page is up keeps the width reason alive:
 * a new root binds a new size subscription, and the old one stops reporting.
 *
 * @capability scheduler-cost
 * @features engine, sidebar-status
 * @risk A session switch replaces the sidebar root, and the width reason then
 *       stops arriving for the rest of the generation.
 */
import { expect, test } from 'vitest'
import { cleanupWith, frames } from '../../fixtures/teardown'
import { installScheduler } from '@dsh-claude-style/engine/scheduler'

test('a replaced sidebar root keeps waking the width readers', async () => {
  const calls: string[] = []
  const widthListeners = new Set<() => void>()
  const stop = installScheduler({} as never, {
    retire: () => {},
    width: { wakesOn: ['sidebar-width'], sync: () => calls.push('width') },
  }, ['width'], {
    copyChange: [], refresh: [], start: () => {}, systemMotionChanged: () => {},
    observeSidebarWidth: (listener) => {
      widthListeners.add(listener)
      return () => widthListeners.delete(listener)
    },
  })
  cleanupWith(stop)
  await frames(2)
  calls.length = 0
  for (const listener of widthListeners) listener()
  await frames(2)
  expect(calls).toEqual(['width'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/testing/specs/mechanism/scheduler-cost/sidebar-width-rebind.spec.ts`

Expected: FAIL，根节点替换后没有新的尺寸订阅，宽度理由不再醒来。

- [ ] **Step 3: Write minimal implementation**

把 Task 1 的最小实现移到 `packages/engine/src/host.ts`，通过宿主访问模块记忆根节点与尺寸订阅：

```ts
/** The sidebar root, kept while it stays in the document. */
export function findSidebarRoot(): HTMLElement | null {
  // existing implementation
}
```

在 `packages/client/src/core/scheduler.ts` 的 `observeSidebarWidth` 中使用 `findSidebarRoot()`，并在根节点变化时由 `observeMatches(SIDEBAR_ROOT_SELECTOR, …)` 重新配置：

```ts
    observeSidebarWidth: listener => {
      let stopSize: (() => void) | null = null
      let watched: HTMLElement | null = null
      const watch = () => {
        const root = findSidebarRoot()
        if (root === watched) return
        stopSize?.()
        stopSize = null
        watched = root
        let width = 0
        if (root !== null) stopSize = observeSize(root, (entries) => {
          const size = entries[entries.length - 1]?.borderBoxSize
          const next = size !== undefined && size.length > 0 ? size[0].inlineSize : entries[entries.length - 1]?.contentRect.width ?? 0
          if (width !== 0 && Math.abs(next - width) < 0.5) return
          width = next
          listener()
        })
      }
      const roots = observeMatches<HTMLElement>(SIDEBAR_ROOT_SELECTOR, watch)
      watch()
      return () => {
        roots.release()
        stopSize?.()
        stopSize = null
        watched = null
      }
    },
```

根节点的尺寸订阅由调度器持有，`packages/contracts/src/table.ts` 的 `shell.sidebar-root` 已存在，`sidebar-status.manifest.ts` 已声明它；本任务只为 `packages/client/src/core/scheduler.ts` 补上 `SIDEBAR_ROOT_SELECTOR` 与 `observeMatches` 的导入，不新增契约项。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/testing/specs/mechanism/scheduler-cost/sidebar-width-rebind.spec.ts`

Expected: PASS。另运行 `npx vitest run packages/testing/specs/mechanism/scheduler-cost/sidebar-width.spec.ts`，确认不退化。

- [ ] **Step 5: 提交**

```sh
git add packages/engine/src/host.ts packages/client/src/core/scheduler.ts packages/testing/specs/mechanism/scheduler-cost/sidebar-width-rebind.spec.ts
git commit -m "fix(scheduler): 侧栏根节点替换后重绑宽度订阅"
```

---

### Task 5: 拖动期把内部换行推迟到结束

**Files:**
- Modify: `packages/client/src/shared/page-scale-columns.ts`
- Modify: `packages/client/src/shared/page-zoom.ts`
- Modify: `packages/client/src/features/workspace/workspace-view.ts`
- Modify: `packages/client/src/features/workspace/segments.ts`
- Modify: `packages/client/src/features/account/account-footer.ts`
- Modify: `packages/client/src/features/sidebar-status/row-status.ts`
- Modify: `packages/testing/data/surface.json`
- Test: `packages/testing/specs/mechanism/page-scale/frame-columns.spec.ts`

**Interfaces:**
- Consumes: `SIDEBAR_HANDLE_SELECTOR`、`subscribeMutations`、Task 1 的 `'sidebar-width'` 理由、现状 `SIDEBAR_ROOT_SELECTOR` 与 `SIDEBAR_HANDLE_SELECTOR` 的匹配清单。
- Produces: 皮肤自己的拖动期标记 `data-dsh-claude-sidebar-dragging`（由 `packages/client/src/shared/page-zoom.ts` 导出常量，由 `installFrameColumns()` 在侧栏手柄的按下与释放上写入与清除）；侧栏宽度与手柄位置在按住期间逐帧跟随指针，依赖宽度的内容测量在释放后一次补齐。

- [ ] **Step 1: Write the failing test**

在 `packages/testing/specs/mechanism/page-scale/frame-columns.spec.ts` 里新增一条拖动生命周期用例：

```ts
test("a press on the sidebar edge raises the skin's mark, and the release drops it", async () => {
  drawnAt(1.25)
  const sidebar = hostSidebar('280px')
  const handle = hostHandle('280px')
  installed()
  await settle()
  handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 }))
  expect(document.body.hasAttribute(RESIZING_ATTRIBUTE)).toBe(true)
  sidebar.style.width = '320px'
  handle.style.left = '320px'
  await settle()
  expect(sidebar.style.width).toBe('320px')
  expect(handle.style.left).toBe('320px')
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 }))
  await settle()
  expect(document.body.hasAttribute(RESIZING_ATTRIBUTE)).toBe(false)
  expect(sidebar.style.width).toBe('256px')
  expect(handle.style.left).toBe('256px')
})
```

`RESIZING_ATTRIBUTE` 从表面表读取：`surfaceAttribute('sidebar-drag.resizing')`。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/testing/specs/mechanism/page-scale/frame-columns.spec.ts`

Expected: FAIL，`sidebar-drag.resizing` 尚未登记，页面也没有写入者。

- [ ] **Step 3: Write minimal implementation**

在 `packages/testing/data/surface.json` 的 `surface` 数组里加入：

```json
{ "id": "sidebar-drag.resizing", "attribute": "data-dsh-claude-sidebar-dragging", "feature": "shared", "sees": "the frame while the reader holds a column edge: the frame's tracks follow the pointer, and the skin's own width-dependent rewrites wait for the release" }
```

`packages/client/src/shared/page-zoom.ts` 导出这个皮肤标记与判定：

```ts
export const SIDEBAR_DRAGGING_ATTRIBUTE = 'data-dsh-claude-sidebar-dragging'

/** Whether a column edge is held right now: the skin's mark stands from the press to the release. */
export function sidebarDragging() {
  return document.body.hasAttribute(SIDEBAR_DRAGGING_ATTRIBUTE)
}
```

`packages/client/src/shared/page-scale-columns.ts` 在 `installFrameColumns()` 里加入写入者：

```ts
let heldPointer: number | null = null

function hold(event: PointerEvent) {
  const target = event.target instanceof Element ? event.target : null
  if (target === null || target.closest(SIDEBAR_HANDLE_SELECTOR) === null) return
  if (heldPointer !== null) return
  heldPointer = event.pointerId
  document.body.setAttribute(SIDEBAR_DRAGGING_ATTRIBUTE, '')
}

function release(event: PointerEvent) {
  if (heldPointer === null || event.pointerId !== heldPointer) return
  heldPointer = null
  document.body.removeAttribute(SIDEBAR_DRAGGING_ATTRIBUTE)
}

window.addEventListener('pointerdown', hold, true)
window.addEventListener('pointerup', release, true)
window.addEventListener('pointercancel', release, true)
```

`carry()` 在标记期间照常换算侧栏宽度与手柄位置：页面缩放下按住宿主原值会让边界比指针多走一个缩放倍数。拖动期暂停的是依赖宽度的内容测量，不是列与手柄本身。

`packages/client/src/features/workspace/segments.ts` 的分段控件在拖动期间跳过读取与写入；`account-footer.ts` 的 `measureAccountRow()` 与 `syncAccountRowBox()` 在拖动期间不读盒；`row-status.ts` 的标题尺寸回调在拖动期间不请求通行；`composer/responsive.ts` 与 `context-stats/session-stats.ts` 的宽度测量在拖动期间暂停；`row-skip.ts` 保留每一行的跳排标记。这些跳过都由释放后 `'sidebar-width'` 理由的通行补齐。拆解时移除三个指针监听、清掉 body 上的标记。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/testing/specs/mechanism/page-scale/frame-columns.spec.ts`

Expected: PASS，17 条用例通过。

- [ ] **Step 5: 提交**

```sh
git add packages/client/src/shared/page-scale-columns.ts packages/client/src/shared/page-zoom.ts packages/client/src/features/workspace/workspace-view.ts packages/client/src/features/workspace/segments.ts packages/client/src/features/account/account-footer.ts packages/client/src/features/sidebar-status/row-status.ts packages/client/src/features/composer/responsive.ts packages/client/src/features/context-stats/session-stats.ts packages/client/src/features/row-skip/row-skip.ts packages/testing/data/surface.json packages/testing/specs/mechanism/page-scale/frame-columns.spec.ts packages/testing/specs/mechanism/row-skip/laid-out.spec.ts packages/testing/specs/mechanism/scheduler-cost/sidebar-width-rebind.spec.ts packages/testing/specs/fixtures/sidebar-width.ts
git commit -m "feat(sidebar): 拖动期推迟内部换行到释放"
```

---

### Task 6: 拆开弹层基态与打开态样式

**Files:**
- Modify: `scripts/css.mjs:47-55,542-566`
- Modify: `packages/client/src/shared/popover.css:20-145`
- Modify: `packages/client/src/core/stylesheet.ts:82-95`
- Modify: `packages/client/src/shared/popover.ts:295-315`
- Test: `packages/testing/specs/behaviour/stylesheets/popover-parts.spec.mjs`

**Interfaces:**
- Consumes: 现有 `StyleGroup`、`STYLESHEET_PARTS`、`addStylesheetGroups`、`removeStylesheetGroups`。
- Produces: `base` 组只含关闭态基态；`popover` 组含打开态与弹层行规则；`setMenuPopoverOpen()` 打开时持有 `popover` 组，关闭动画结束后释放。

- [ ] **Step 1: Write the failing test**

把 `packages/testing/specs/behaviour/stylesheets/popover-parts.spec.mjs` 的断言改为：

```js
    const before = await readActiveSheetGroups(t, GROUP)
    await t.page.locator(TRIGGER).first().click()
    await t.settle()
    const after = await readActiveSheetGroups(t, GROUP)
    t.expectThat.equal(after.includes('popover'), true, `the popover part enters with the card (${after.join(', ')})`)
    t.expectThat.equal(after.filter((group) => group !== 'popover'), before, 'every other part keeps its place')
    const box = await t.read.box(CARD)
    t.expectThat.visible(box, 'the opened card keeps its drawn box')
    await t.page.keyboard.press('Escape')
    await t.page.waitForTimeout(500)
    const closed = await t.page.evaluate(([card, open]) => {
      const node = document.querySelector(card)
      if (node === null) return null
      const style = getComputedStyle(node)
      return { open: node.getAttribute(open), visibility: style.visibility, opacity: style.opacity }
    }, [CARD, OPEN])
    t.expectThat.equal(closed?.open, 'false', 'the card is marked closed')
    t.expectThat.equal(closed?.visibility, 'hidden', 'the base part keeps the closed card hidden')
    t.expectThat.equal(closed?.opacity, '0', 'the base part keeps the closed card paintless')
    t.expectThat.equal((await readActiveSheetGroups(t, GROUP)).includes('popover'), false, 'the popover part leaves after the closing fade')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node packages/testing/behaviour.mjs --spec stylesheets/`

Expected: FAIL，`popover` 组在打开卡片后没有进入活动组，构建产物里该组长度为 0。

- [ ] **Step 3: Write minimal implementation**

`scripts/css.mjs` 新增一个与 `COMPOSER_GATE_MARKER` 同形的分区标记，按标记前后的规则把 `shared/popover.css` 切成两段：

```ts
/** The comment in shared/popover.css above the rules that belong to the opened surface. */
const POPOVER_OPEN_MARKER = '@popover-open'

  /** The same sheet's text before and after one comment marker, in source order. */
  function splitAtMarker(text: string, marker: string, label: string) {
    const root = postcss.parse(text, { from: label })
    const found = root.nodes.find((node) => node.type === 'comment' && node.text === marker)
    if (found === undefined) throw new Error(`build: ${label} is missing the /* ${marker} */ marker`)
    const end = found.source.end.offset
    return {
      before: text.slice(0, found.source.start.offset).trim(),
      after: text.slice(end).trim(),
    }
  }
```

切片表达式改为：

```ts
  const slices = processed
    .filter((item) => item.sheet.scope !== 'surface')
    .flatMap((item) => {
      if (item.sheet.file !== 'shared/popover.css') return [{ group: styleGroupOf(item.sheet), text: item.text }]
      const split = splitAtMarker(item.text, POPOVER_OPEN_MARKER, 'shared/popover.css')
      return [{ group: 'base', text: split.before }, { group: 'popover', text: split.after }]
    })
```

在 `packages/client/src/shared/popover.css` 里，把关闭态基态保留在文件前部，并在打开态规则之前写 `/* @popover-open */`；打开态的卡片外观、宿主菜单行、弹层行与分隔线规则放在标记之后。选择器、声明与顺序保持原样，构建只按标记切分文本。

`packages/client/src/core/stylesheet.ts` 的 `holdPopoverStylesheet()` 与 `releasePopoverStylesheet()` 保持现有计数；关闭时的延迟释放已由 `setMenuPopoverOpen()` 的 `motionMs('--dsh-claude-duration-exit')` 提供。不要在关闭动画结束前释放。

- [ ] **Step 4: Run test to verify it passes**

Run: `node packages/testing/behaviour.mjs --spec stylesheets/`

Expected: PASS。`after.includes('popover')` 为真，`after.filter((group) => group !== 'popover')` 与打开前相同，关闭后 `popover` 离开活动组且关闭卡片仍为 `hidden`。另运行 `node packages/testing/behaviour.mjs --spec account-menu/`，确认关闭态基态仍让卡片不可见。

- [ ] **Step 5: 提交**

```sh
git add scripts/css.mjs packages/client/src/shared/popover.css packages/client/src/core/stylesheet.ts packages/client/src/shared/popover.ts packages/testing/specs/behaviour/stylesheets/popover-parts.spec.mjs
git commit -m "refactor(stylesheets): 分开弹层关闭基态与打开表面"
```

---

### Task 7: 在真实桌面窗口上补齐读数

**Files:**
- Modify: `packages/testing/data/bounds.json`
- Modify: `packages/testing/data/check-numbers.json`
- Modify: `docs/SIDEBAR-SCROLL-PERFORMANCE.md` 的“已取得的读数”和“真实宿主复核”两节
- Modify: `docs/SIDEBAR-SCROLL-PERFORMANCE-PLAN.md` 的“实施结果”
- Test: 真实宿主的 `sidebarDrag`、`scrollPace`、`readerScroll`、`longSession`、`shots`、`importance`

**Interfaces:**
- Consumes: Task 0 的 `sidebarDrag`；现有 `scrollPace`、`readerScroll`、`longSession`。
- Produces: 环境事实、每项读数的改动前后中位数、验收上限；没有取得真实宿主读数时，本节保持未完成，不写成通过。

- [ ] **Step 1: 确认真实宿主的版本**

Run: `dsh --version`

Expected: 打印已安装的 `dsh` 版本。若输出 `Harness CLI not found`，本节停止，记录“真实宿主不可用”，不伪造读数。

Run: `node packages/testing/host-version.mjs`

Expected: 打印当前发布的最新版本；与 `dsh --version` 不一致时按仓库约定不给出端到端判决。

- [ ] **Step 2: 采三次中位数**

Run:

```sh
DSH_CLAUDE_STYLE_PASS_READINGS=1 npm run build
node packages/testing/e2e.mjs --scenario sidebarDrag --jobs 1
node packages/testing/e2e.mjs --scenario scrollPace,readerScroll,longSession --jobs 1
node packages/testing/e2e.mjs --scenario motion,washLine,shots,importance --jobs 1
```

每条命令连续运行三次，取每次的 `frames`、`p95`、`over33`、`passes`、`measures`、`rects`、`styles`、`longTotal` 中位数。同一台机器、同一棵树、同一窗口尺寸、同一会话。

- [ ] **Step 3: 写上限**

把三次中位数写进 `packages/testing/data/bounds.json`，每条上限带理由；运行 `npm run checks:numbers` 重写 `packages/testing/data/check-numbers.json`。上限不得高于改动前中位数。

- [ ] **Step 4: 回填文档**

把读数写进 `docs/SIDEBAR-SCROLL-PERFORMANCE.md` 的读数表；如果某项未取得，写“未取得真实宿主读数”，并保留对应验收项为未完成。

- [ ] **Step 5: 提交**

```sh
git add packages/testing/data/bounds.json packages/testing/data/check-numbers.json docs/SIDEBAR-SCROLL-PERFORMANCE.md docs/SIDEBAR-SCROLL-PERFORMANCE-PLAN.md
git commit -m "docs(perf): 补齐侧栏拖动与会话滚动的真实读数"
```

---

### Task 8: 同步文档索引与变更片段

**Files:**
- Modify: `README.md:93-103`
- Modify: `README.en.md:104-116`
- Create: `docs/changes/sidebar-scroll-performance.json`
- Test: `npm run changelog:check`、`npm run docs:check`、`npm run lint`

**Interfaces:**
- Consumes: Task 7 的读数与两份新文档。
- Produces: 文档索引与变更记录；发布时 `npm run changelog` 能从片段生成下一版条目。

- [ ] **Step 1: 写变更片段**

新建 `docs/changes/sidebar-scroll-performance.json`：

```json
{
  "at": "2026-11-08",
  "group": "improvements",
  "order": 40,
  "external": false,
  "zh": "改善侧栏拖动和会话滚动：宽度变化只唤醒依赖盒的侧栏功能，弹层基态与打开表面分片挂载，并补齐同机前后读数",
  "en": "Improve sidebar dragging and conversation scrolling: a width change wakes only the box-reading sidebar features, closed popover base and open surfaces mount in parts, and the before and after readings are recorded"
}
```

- [ ] **Step 2: 更新中文与英文索引**

`README.md` 的文档表新增两行：

```md
| 侧栏拖动与会话滚动卡顿方案：docs/SIDEBAR-SCROLL-PERFORMANCE.md | 两项卡顿的测量证据、根因、解决方案与验收读数 |
| 侧栏拖动与会话滚动整改计划：docs/SIDEBAR-SCROLL-PERFORMANCE-PLAN.md | 整改的任务顺序、失败测试、实现代码、验证命令与提交边界 |
```

`README.en.md` 的文档表新增两行：

```md
| Sidebar drag and scroll performance: docs/SIDEBAR-SCROLL-PERFORMANCE.md | The measurements, root causes, fixes and acceptance readings for the two stutters |
| Sidebar drag and scroll implementation plan: docs/SIDEBAR-SCROLL-PERFORMANCE-PLAN.md | The task order, failing tests, implementation code, verification commands and commit boundaries for the fixes |
```

- [ ] **Step 3: Run checks**

Run:

```sh
npm run changelog:check
npm run docs:check
npm run lint
```

Expected: 全部 PASS。

- [ ] **Step 4: 提交**

```sh
git add README.md README.en.md docs/changes/sidebar-scroll-performance.json
git commit -m "docs(perf): 索引侧栏拖动与会话滚动方案"
```

---

## 实施结果

### 已完成

- Task 0：`packages/testing/sidebar-drag.mjs` 登记为 `sidebarDrag` 场景，读数经 `packages/testing/scroll-sample.mjs` 与 `scrollPace` 共用；三条上限写进 `packages/testing/data/bounds.json`。
- Task 1、Task 4：`WakeReason` 增加 `sidebar-width`；宽度来源由 `packages/engine/src/host.ts` 的 `observeSidebarWidth` 提供，根节点被替换时由 `observeMatches` 重绑，拆解时释放旧根。
- Task 2：侧栏状态根订阅不再把 `style` 当结构变化；标题尺寸回调只在宽度真的变化时请求，拖动期只记录最终宽度。
- Task 3：`composer`、`footer`、`contextStats` 声明 `sidebar-width`；`workspace`、`dateGroups`、`manualUnread`、`sidebarEntries` 保持只声明 `sidebar`。
- Task 5：拖动标记由皮肤在侧栏手柄的按下与释放上写入 `data-dsh-claude-sidebar-dragging`，并登记在 `packages/testing/data/surface.json`；框架轨道、侧栏宽度与手柄位置逐帧跟随指针，工作区分段控件、页脚账户行、标题尺寸与侧栏状态在拖动期不重算。宽度与手柄在按住期间保留宿主原值会让页面缩放下的边界比指针多走一个缩放倍数，该做法已移除。
- 复核修复：侧栏根节点在拖动中被宿主重画时，新的尺寸观察不再把同一宽度当作新宽度；`row-skip` 在拖动期间保留跳排标记，释放后一次重排；输入卡的响应式工具栏与统计行的几何读取在拖动期暂停。
- Task 6：`scripts/css.mjs` 按 `@popover-open` 把 `shared/popover.css` 切成 `base` 与 `popover` 两段；账号菜单、自建账户抽屉、回合导航与 `setMenuPopoverOpen()` 的卡片都持有打开态分组，关闭动画结束后释放。
- Task 8：README 两份索引与 `docs/changes/sidebar-scroll-performance.json` 已就位。

### 离线读数

样式规模，取自拆分后的构建产物：

| 组 | 字符数 | 规则数 | 选择器数 | `!important` 数 |
| --- | --- | --- | --- | --- |
| base | 162,922 | 475 | 553 | 121 |
| conversation | 43,490 | 172 | 198 | 30 |
| composer | 91,318 | 352 | 445 | 102 |
| sidebar | 49,396 | 228 | 263 | 12 |
| popover（打开时挂载） | 6,526 | 30 | 32 | 21 |

会话页常驻四组从 353,651 字符、1,400 条规则、1,663 个选择器降到 347,126 字符、1,227 条规则、1,459 个选择器。`popover` 组由 0 字符变为 6,526 字符，只在卡片打开时进入页面；卡片的填充、边框与圆角留在关闭态基态，打开态只带可见性、动画与宿主菜单外观。

机制层与行为层的验收：

- `npx vitest run packages/testing/specs/mechanism/scheduler-cost packages/testing/specs/mechanism/sidebar-status packages/testing/specs/mechanism/page-scale/frame-columns.spec.ts packages/testing/specs/mechanism/row-skip/laid-out.spec.ts`：16 个文件、107 条用例通过。
- `node packages/testing/behaviour.mjs --spec behaviour/account-menu,behaviour/stylesheets,behaviour/background-opacity,behaviour/page-scale,behaviour/manual-unread,behaviour/sidebar-hierarchy,behaviour/conversation-width,behaviour/view-tabs --jobs 1`：61 条通过。
- `node packages/testing/smoke.mjs --feature workspace,account,composer --quick --jobs 1`：9 个浏览器用例通过。
- `node packages/testing/smoke.mjs --case skin-center-handoff,skin-center-arrival,popovers,desktop --quick --jobs 1`：3 个浏览器用例通过。
- `npm run build`、`npm run lint` 通过。

### 未完成

- 真实桌面窗口上的 `sidebarDrag`、`scrollPace`、`readerScroll`、`longSession` 读数；本机的 `dsh` CLI 没有完整宿主，`node packages/testing/e2e.mjs` 无法取得判决。
- 真实窗口上的 `shots` 与 `importance` 回看。
- Task 5 的最终逐像素对照需要在真实窗口完成。
- 整层快速烟雾在本机仍有品牌图、宿主色板与预览动画的失败；这些用例在本轮改动之前就以相同读数失败，不在本次侧栏与弹层的改动范围内。
