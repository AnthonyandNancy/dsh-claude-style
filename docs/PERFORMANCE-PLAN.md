# 性能与流畅度修改计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变功能、动画、界面与样式的前提下，按 `docs/PERFORMANCE.md` 的八项提案削减长会话与流式输出下的分发、帧内同步、布局读写、合成与首屏装载成本。

**Architecture:** 先给页面补两个可读的帧内计数（测量任务），再按「引擎机制 → 功能调度 → 逐功能读取 → 样式合成 → 装载时机」的顺序改。每项改动都只改变「什么时候算、算几次」，不改变算出的值、写入的标记、动画的时长曲线或元素的盒与层级。

**Tech Stack:** TypeScript、esbuild、Vitest 浏览器模式、Playwright、仓库自己的冒烟与端到端通道。

## Global Constraints

- 可见结果不变：动画的时长、曲线、起点与终点不变；元素的盒、层级、颜色与圆角不变；交互的命中区域与键盘路径不变。
- 观察仍只有一个 `MutationObserver` 与一套 `ResizeObserver` 登记（D40）：`MutationObserver`、`ResizeObserver`、`requestAnimationFrame` 只允许在 `packages/engine/src/bus.ts` 与 `packages/engine/src/frame.ts` 里创建。
- 宿主查询只走 `packages/engine/src/host.ts` 的访问器或 `packages/engine/src/bus.ts` 的清单；新选择器写进 `packages/contracts/src/dom.ts`，并在 `packages/contracts/src/table.ts` 登记（D3）。
- 样式里不写时长、缓动曲线与 9 以上的层级字面值；需要新值时先加进 `packages/client/src/theme/tokens.json`（D9）。
- 不改变偏好默认值与设置页上的任何一行（`packages/contracts/src/prefs.ts` 不动）。
- `lib/` 是构建产物，源码改动后只运行 `npm run build`（D47）。
- 一个源文件接近 750 行时停下，先拆分再继续（`npm run lint` 会拒绝越过这条线）。
- 提交标题用中文与 Conventional Commit 前缀，一次提交只带一个逻辑改动。

---

## File Structure

| 文件 | 责任 | 本计划中的动作 |
|---|---|---|
| packages/client/src/core/frame-metrics.ts | 记录一帧内 `measure()` 与 `sync()` 的调用次数、布局读取次数 | 新建 |
| `packages/client/src/core/scheduler.ts` | 把页面计数交给引擎调度器 | 修改 |
| `packages/engine/src/scheduler.ts` | 帧内调度、唤醒原因过滤、调用计数 | 修改 |
| `packages/engine/src/bus.ts` | 观察者、按目标分桶的分发、订阅原因、清单版次 | 修改 |
| `packages/engine/src/host.ts`、`packages/engine/src/skin.ts` | 页隐藏答案经交接缝交给引擎（D73） | 修改 |
| `packages/client/src/entry.ts` | `adoptSkin()` 传入 `pageHidden` | 修改 |
| `packages/contracts/src/prefs.ts` | 偏好表 | 只读 |
| `packages/client/src/features/composer/composer.ts` | 输入卡的读与写 | 修改 |
| `packages/client/src/features/composer/placeholder-copy.ts` | 占位符的读与写 | 修改 |
| `packages/client/src/features/context-stats/session-stats.ts` | 统计的读与写 | 修改 |
| `packages/client/src/features/chat-fold/message-fold.ts` | 折叠的读与写 | 修改 |
| `packages/client/src/shared/motion.css` | 扫光与流动的动效 | 修改 |
| `packages/client/src/features/sidebar-status/sidebar-status.css` | 侧栏运行状态的动效 | 修改 |
| `packages/client/src/theme/sidebar.css` | 侧栏运行圆环的动效 | 只读（旋转已是 `transform`） |
| `packages/client/src/shared/popover.css` | 弹层卡片的滤镜 | 修改 |
| `packages/client/src/features/header-band/header-band.manifest.ts`、`packages/client/src/features/view-tabs/view-tabs.manifest.ts` | 首屏不需要的功能延后（`turn-nav` 与 `message-actions` 已经延后） | 修改 |
| `packages/client/src/core/page-visibility.ts` | 页隐藏的唯一答案 | 只读 |
| `packages/engine/src/scroll-owner.ts` | 跟随的轮询与页隐藏 | 修改 |
| `packages/client/src/features/home/home-store.ts`、`packages/client/src/features/chat-wait/chat-wait.ts` | 用量轮询与等待线轮询的页隐藏 | 修改 |
| `packages/client/src/features/chat-reveal/chat-reveal.settings.ts`、`packages/client/src/features/caret/caret.settings.ts` | 预览定时器的页隐藏 | 修改 |
| `packages/testing/specs/mechanism/scheduler-cost/` | 调度成本机制规范 | 新建 |
| `packages/testing/specs/behaviour/account-menu/`、`packages/testing/specs/behaviour/chunks/`、`packages/testing/specs/behaviour/page-visibility/` | 行为规范 | 新建 |
| `packages/testing/data/bounds.json` | 性能上限 | 修改 |
| `packages/testing/data/check-numbers.json` | 检查里的数字 | 修改 |
| `packages/testing/data/document-lookups.json` | 整文档查找的清册 | 只在计数下降时更新 |

表里与任务里不带反引号的文件是这份计划要新建的，目前还不存在；带反引号的路径都能在仓库里打开。

---

### Task 0: 先让一帧的调用次数可读

**Files:**
- Create: packages/client/src/core/frame-metrics.ts
- Modify: `packages/client/src/core/scheduler.ts:83-89`
- Modify: `packages/engine/src/scheduler.ts:79-92,110-123,298-312,332-385`
- Test: packages/testing/specs/mechanism/scheduler-cost/frame-counts.spec.ts

**Interfaces:**
- Consumes: `installScheduler<Name>(ctx, ui, features, sources)` 的现有签名。
- Produces: `SchedulerSources` 新增可选字段 `reportPass?(reading: { measures: number, syncs: number }): void`；packages/client/src/core/frame-metrics.ts 导出 `PassReading` 类型与 `recordPassReading(reading: PassReading): void`、`readPassReadings(): PassReading[]`、`clearPassReadings(): void`。`SchedulerSources.reportPass` 与 `PassReading` 的形状相同，但不互相引用：`packages/engine` 不导入浏览器半边的模块（D73）。

- [ ] **Step 1: Write the failing test**

```ts
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
  const readings: { measures: number, syncs: number }[] = []
  const ui = {
    retire: () => {},
    one: { measure() {}, sync() {} },
    two: { sync() {} },
  }
  const stop = installScheduler(
    {} as never,
    ui,
    ['one', 'two'],
    { copyChange: [], refresh: [], start: () => {}, systemMotionChanged: () => {}, reportPass: reading => readings.push(reading) },
  )
  cleanups.push(stop)
  ui.one.sync()
  ui.schedule?.()
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  expect(readings).toEqual([{ measures: 1, syncs: 2 }])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/testing/specs/mechanism/scheduler-cost/frame-counts.spec.ts`
Expected: FAIL，`installScheduler` 的第四个参数的 `reportPass` 不在类型里，或回调从未被调用。

- [ ] **Step 3: Write minimal implementation**

在 `packages/engine/src/scheduler.ts` 的 `SchedulerSources` 里加字段并照实计数：

```ts
export interface SchedulerSources {
  copyChange: ChangeSource[]
  refresh: ChangeSource[]
  start(): void
  systemMotionChanged(): void
  /** Told after every pass, for the page's own cost readings. */
  reportPass?(reading: { measures: number, syncs: number }): void
}
```

在 `schedule()` 的 `write()` 里，把两处 `for (const name of features)` 的调用改成先计数、调完再上报：

```ts
      write() {
        scheduled = false
        cancelPass = null
        if (stopped) return
        const content = passContentOnly
        passContentOnly = false
        let measures = 0
        let syncs = 0
        const runMeasures = () => {
          for (const name of features) {
            if (content && handleOf(name)?.skipOnContentOnly === true) continue
            const handle = handleOf(name)
            if (handle === undefined || typeof handle.measure !== 'function') continue
            measures += 1
            runMeasure(name)
          }
        }
        if (!measured) runMeasures()
        for (const name of features) {
          if (content && handleOf(name)?.skipOnContentOnly === true) continue
          const handle = handleOf(name)
          if (handle === undefined || typeof handle.sync !== 'function') continue
          syncs += 1
          runSync(name)
        }
        if (typeof sources.reportPass === 'function') sources.reportPass({ measures, syncs })
        const currentCard = findComposerCard()
        if (currentCard !== observedCard) {
          if (stopCardSize !== null) stopCardSize()
          stopCardSize = null
          observedCard = currentCard
          if (observedCard) stopCardSize = observeSize(observedCard, onCardResize)
        }
      },
```

读阶段里的 `runMeasure` 也走同一个 `runMeasures()`，把 `read()` 改成：

```ts
      read() {
        measured = true
        if (stopped) return
        runMeasures()
      },
```

新建 packages/client/src/core/frame-metrics.ts：

```ts
/**
 * The page's own cost readings (docs/PERFORMANCE.md): how many feature hooks a
 * pass called, and how many layout reads the frame made. The long-session lane
 * reads them; nothing in the product acts on them.
 */
export interface PassReading {
  measures: number
  syncs: number
}

let readings: PassReading[] = []

export function recordPassReading(reading: PassReading) {
  readings.push(reading)
  // A long lane reads once; a cap keeps a forgotten page from filling memory.
  if (readings.length > 60000) readings.shift()
}

export function readPassReadings(): PassReading[] {
  return readings.slice()
}

export function clearPassReadings() {
  readings = []
}
```

在 `packages/client/src/core/scheduler.ts` 的 `installEngineScheduler` 调用里接上：

```ts
export function installScheduler(ctx: HostContext, ui: Ui, features: HandleName[]) {
  return installEngineScheduler<HandleName>(ctx, ui, features, {
    copyChange: [subscribePrefs, onModelCopyLoaded],
    refresh: [onUsernameLoaded, onHdslLoaded],
    start: loadPrefs,
    systemMotionChanged: refreshMotionAttribute,
    reportPass: recordPassReading,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/testing/specs/mechanism/scheduler-cost/frame-counts.spec.ts`
Expected: PASS，`readings` 为 `[{ measures: 1, syncs: 2 }]`。

- [ ] **Step 5: 接进长会话场景，读出同一回合的两个计数**

构建把「是否暴露读数」写进生成模块，发布的包不暴露。`scripts/build.mjs` 的 `generatedModule({ … })` 里加一行：

```js
    PASS_READINGS: process.env.DSH_CLAUDE_STYLE_PASS_READINGS === '1',
```

`packages/client/src/generated.d.ts` 的生成模块声明里补：

```ts
  export const PASS_READINGS: boolean
```

`packages/client/src/entry.ts` 只在打上该开关的构建里挂入口：

```ts
import { clearPassReadings, readPassReadings } from './core/frame-metrics'
import { PASS_READINGS } from 'virtual:dsh-claude-style/generated'

// The long-session lane reads the pass counts; a published page carries none.
if (PASS_READINGS) Object.assign(window, { __dshPassReadings: { read: readPassReadings, clear: clearPassReadings } })
```

`vitest.config.mjs` 里生成的测试模块也要带上这个开关，否则任何经由生成模块导入 `entry.ts` 的规范都会因为导出缺失而失败。该文件已经用 `generatedSource({ MOTION: …, PALETTE_CARDS: … })` 写出测试用的生成模块，改法是在同一个调用里补 `PASS_READINGS: false`（规范默认读不到读数，读取入口的规范由上面的机制层用例直接覆盖 `reportPass`，不依赖全局对象）。

在 `packages/testing/long-session.mjs` 的 `initScript` 里清空并读出这些读数：

```js
      window.__longSession.passes = []
```

`measureTurn()` 的第一段清空页面读数：

```js
  await page.evaluate(() => { window.__dshPassReadings?.clear() })
```

`read()` 在同一个 `page.evaluate()` 回调里读出这些读数：

```js
    passes: window.__dshPassReadings ? window.__dshPassReadings.read() : [],
```

再从 `read()` 返回的 `passes` 计算两个上限：`passMeasures` 与 `passSyncs` 的最大值，上限写进 `packages/testing/data/bounds.json` 并在 Task 8 接进检查。**Task 0 只记录基线，不新增检查**；`bounds.json` 的这一条此时还没有读者，Task 8 才把它接上。

```json
    {
      "name": "longSessionPassCalls",
      "value": 48,
      "reason": "The most feature hooks one pass may call on either measured round. The shipped page installs about forty handles and most of them implement one hook; a pass that starts calling every handle on every streamed batch lands above this and a pass that follows the declared reasons stays under it."
    },
```

- [ ] **Step 6: 跑一遍长会话，记下改动前的读数**

`verify` 的构建闸门不传这个变量，所以读数构建由这一步自己写，再单跑场景：

Run: `DSH_CLAUDE_STYLE_PASS_READINGS=1 npm run build` 与 `DSH_LONG_SESSION_TURNS=8 node packages/testing/e2e.mjs --scenario longSession --jobs 1`
Expected: 场景通过；`rows`、`queries`、`p95`、`long tasks` 与新增的 `passes` 打印出来。把六个数抄进提交说明，作为后续任务的对照基线。跑完后再执行一次 `npm run build`，把不带读数入口的正式产物写回 `lib/`。

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/core/frame-metrics.ts packages/client/src/core/scheduler.ts packages/engine/src/scheduler.ts packages/client/src/entry.ts packages/client/src/generated.d.ts scripts/build.mjs vitest.config.mjs packages/testing/specs/mechanism/scheduler-cost/frame-counts.spec.ts packages/testing/long-session.mjs packages/testing/data/bounds.json
git commit -m "test(perf): 记录一帧内的调度与布局读取次数"
```

---

### Task 1: 观察总线按订阅目标分桶

**Files:**
- Modify: `packages/engine/src/bus.ts:53-136,206-230,283-295`
- Test: `packages/testing/specs/mechanism/page-observation/bus.spec.ts`

**Interfaces:**
- Consumes: `subscribeMutations(target, options, callback)` 的现有签名。
- Produces: 内部函数 `audienceFor(records: MutationRecord[]): MutationSubscription[]`；`subscribeMutations` 的返回签名不变。

- [ ] **Step 1: Write the failing test**

在 `packages/testing/specs/mechanism/page-observation/bus.spec.ts` 末尾追加：

```ts
test('a record reaches the subscriptions whose target holds it, and no others', async () => {
  const left = host()
  const right = host()
  const seen: Record<string, string[]> = { left: [], right: [], body: [] }
  cleanups.push(subscribeMutations(left, { childList: true, subtree: true }, records => seen.left.push(...records.map(record => (record.target as Element).className))))
  cleanups.push(subscribeMutations(right, { childList: true, subtree: true }, records => seen.right.push(...records.map(record => (record.target as Element).className))))
  cleanups.push(subscribeMutations(document.body, { childList: true, subtree: true }, records => seen.body.push(...records.map(record => (record.target as Element).className))))
  const inside = document.createElement('div')
  inside.className = 'left-child'
  left.append(inside)
  await settle()
  expect(seen.left).toEqual(['left-child'])
  expect(seen.right).toHaveLength(0)
  expect(seen.body).toContain('left-child')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/testing/specs/mechanism/page-observation/bus.spec.ts -t "a record reaches the subscriptions whose target holds it"`
Expected: 两个收件断言先通过（现有实现已按 `subtree` 过滤），所以还要读分发次数。在 `deliver()` 里临时加一行 `(window as any).__deliveries = ((window as any).__deliveries ?? 0) + 1`，用例末尾加 `expect((window as any).__deliveries).toBe(2)`，并在用例开头把它清零。当前实现把这一条记录逐个交给三个订阅，读数为 3，断言失败；分桶后只剩左侧与正文两个订阅，读数为 2。计数在 Step 3 里删掉。

- [ ] **Step 3: Write minimal implementation**

在 `packages/engine/src/bus.ts` 的模块级状态旁加目标索引：

```ts
/** Every subscription by the node it watches, so one record meets only its own target's subscribers. */
const subscriptionsByTarget = new Map<Node, Set<MutationSubscription>>()
```

在 `subscribeMutations()` 登记与注销时更新索引：

```ts
export function subscribeMutations(target: Node, options: MutationOptions, callback: (records: MutationRecord[]) => void) {
  const subscription = { target, options, callback }
  mutationSubscriptions.push(subscription)
  mutationSubscriptionSet.add(subscription)
  const into = subscriptionsByTarget.get(target) ?? new Set<MutationSubscription>()
  into.add(subscription)
  subscriptionsByTarget.set(target, into)
  refreshMutationObserver(subscription)
  return () => {
    const at = mutationSubscriptions.indexOf(subscription)
    if (at === -1) return
    mutationSubscriptions.splice(at, 1)
    mutationSubscriptionSet.delete(subscription)
    const set = subscriptionsByTarget.get(target)
    set?.delete(subscription)
    if (set !== undefined && set.size === 0) subscriptionsByTarget.delete(target)
    refreshMutationObserver()
  }
}
```

再加一个求受众的函数，**返回顺序必须是订阅建立顺序**，否则既有「回调按订阅顺序执行」的规范会失败；因此用 `mutationSubscriptions` 过滤，不直接拼接各桶：

```ts
/**
 * The subscriptions a batch can reach: those whose target holds at least one
 * record, or is page-wide. Returned in subscription order, so callbacks keep
 * the order separate observers made in that order would have had.
 */
function audienceFor(records: MutationRecord[]): MutationSubscription[] {
  const wanted = new Set<MutationSubscription>()
  for (const [target, subscriptions] of subscriptionsByTarget) {
    for (const record of records) {
      if (target === record.target || (target.contains(record.target) && record.target.isConnected) || (pageWide(target) && !record.target.isConnected)) {
        for (const subscription of subscriptions) wanted.add(subscription)
        break
      }
    }
  }
  return mutationSubscriptions.filter(subscription => wanted.has(subscription))
}
```

把 `routeRecords` 的默认受众从 `mutationSubscriptions.slice()` 改成 `audienceFor(records)`：

```ts
function routeRecords(records: MutationRecord[], audience: MutationSubscription[] = audienceFor(records)) {
```

`refreshMutationObserver` 里那段 `queueMicrotask(() => routeRecords(pending, audience))` 保持原样：它显式传受众，仍只交给变化前就存在的订阅。`subscriptionsByTarget` 的登记与注销必须与 `mutationSubscriptions` 同步，否则受众会漏掉订阅或留下已注销的订阅。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/testing/specs/mechanism/page-observation/bus.spec.ts`
Expected: 全部 PASS；新增用例里右侧订阅收到 0 条，正文订阅仍收到整条；既有「callbacks run in subscription order」「a page-wide subscription hears a change made inside a node removed in the same batch」与「a page-wide subscription hears nothing that changed outside its own subtree」三条仍通过。

- [ ] **Step 5: 跑冒烟，确认整页行为不变**

Run: `node packages/testing/smoke.mjs --quick --jobs 2`
Expected: 全部通过；`scheduler idle once settled (0 passes in 1 s)` 仍为 0。

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/bus.ts packages/testing/specs/mechanism/page-observation/bus.spec.ts
git commit -m "perf(bus): 按订阅目标把一批变化分给读得到它的订阅"
```

---

### Task 2: 给同步句柄一个唤醒原因

**Files:**
- Modify: `packages/engine/src/scheduler.ts:19-63,319-385`
- Modify: `packages/client/src/core/scheduler.ts:83-89`
- Modify: `packages/client/src/features/header-band/header-band.ts:462`
- Modify: `packages/client/src/features/view-tabs/view-tabs.ts:338`
- Modify: `packages/client/src/features/sidebar-status/sidebar-status.ts:56`
- Modify: `packages/client/src/features/sidebar-entries/sidebar-entries.ts:276`
- Modify: `packages/client/src/features/account/account-footer.ts:567-573`
- Modify: `packages/client/src/features/date-groups/date-groups.ts:480`
- Modify: `packages/client/src/features/manual-unread/manual-unread.ts:162-164`
- Modify: `packages/client/src/features/model/model-picker.ts:543-547`
- Modify: `packages/client/src/features/effort/effort-picker.ts:282-289`
- Test: packages/testing/specs/mechanism/scheduler-cost/wake-reason.spec.ts

**Interfaces:**
- Consumes: Task 0 的 `reportPass`。
- Produces: `type WakeReason = 'content' | 'sidebar' | 'composer' | 'header' | 'viewport' | 'other'`；`FeatureHandle.wakesOn?: readonly WakeReason[]`；`schedule(options?: { contentOnly?: boolean, reason?: WakeReason })`。

- [ ] **Step 1: Write the failing test**

```ts
/**
 * A pass wakes only the handles whose declared reasons include the one change
 * that asked for it; a handle that declares none keeps its old behaviour.
 *
 * @capability scheduler-cost
 * @features engine
 * @risk A streamed batch still calls every feature, so a long conversation pays the whole page's sync on every token.
 */
import { afterEach, expect, test } from 'vitest'
import { installScheduler } from '@dsh-claude-style/engine/scheduler'

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  document.body.replaceChildren()
})

function installed(ui: Record<string, unknown>, features: string[], pass: (reading: { measures: number, syncs: number }) => void) {
  const stop = installScheduler({} as never, ui as never, features as never, {
    copyChange: [], refresh: [], start: () => {}, systemMotionChanged: () => {}, reportPass: pass,
  })
  cleanups.push(stop)
  return ui
}

test('a sidebar reason skips a handle that only reads the conversation', async () => {
  const readings: { measures: number, syncs: number }[] = []
  const calls: string[] = []
  const ui = installed({
    retire: () => {},
    chat: { wakesOn: ['content'], sync: () => calls.push('chat') },
    side: { wakesOn: ['sidebar'], measure: () => {}, sync: () => calls.push('side') },
    anything: { sync: () => calls.push('anything') },
  }, ['chat', 'side', 'anything'], reading => readings.push(reading))
  await new Promise(resolve => requestAnimationFrame(resolve))
  calls.length = 0
  ;(ui as any).schedule({ reason: 'sidebar' })
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  expect(calls).toEqual(['side', 'anything'])
  expect(readings.at(-1)).toEqual({ measures: 1, syncs: 2 })
})

test('a handle that declares no reason still wakes for every change', async () => {
  const calls: string[] = []
  const ui = installed({ retire: () => {}, anything: { sync: () => calls.push('anything') } }, ['anything'], () => {})
  await new Promise(resolve => requestAnimationFrame(resolve))
  calls.length = 0
  ;(ui as any).schedule({ reason: 'content' })
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  expect(calls).toEqual(['anything'])
})

test('a later ask without a reason joins the queued pass as a whole-page change', async () => {
  const calls: string[] = []
  const ui = installed({
    retire: () => {},
    chat: { wakesOn: ['content'], sync: () => calls.push('chat') },
  }, ['chat'], () => {})
  await new Promise(resolve => requestAnimationFrame(resolve))
  calls.length = 0
  ;(ui as any).schedule({ reason: 'content' })
  ;(ui as any).schedule()
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  expect(calls).toEqual(['chat'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/testing/specs/mechanism/scheduler-cost/wake-reason.spec.ts`
Expected: FAIL——`schedule` 的选项里没有 `reason`，`wakesOn` 不被读取，聊天与侧栏都会收到调用；第三条也会失败，因为当前一次不带原因的排程不会把已排队的原因扩大。`readings.at(-1)` 的期望是 `{ measures: 1, syncs: 2 }`：`side` 声明了 `measure` 且在「侧栏」原因下被唤醒，`chat` 与 `anything` 都不实现 `measure`。

- [ ] **Step 3: Write minimal implementation**

在 `packages/engine/src/scheduler.ts` 的类型区加：

```ts
/**
 * Why a pass was asked for. A feature declares the reasons its measurements
 * read; a change it cannot read skips it for that frame.
 */
export type WakeReason = 'content' | 'sidebar' | 'composer' | 'header' | 'viewport' | 'other'
```

`FeatureHandle` 加字段：

```ts
  /** The changes this feature's measurement and sync read; a change outside them skips its turn. */
  wakesOn?: readonly WakeReason[]
```

调度器里把「这一帧的原因」与 `contentOnly` 一起记。**没有原因的那次排程按整页处理**：一句 `schedule()` 不说明原因，就没有任何依据跳过某个功能，此时 `passReasons` 保持 `null`，所有功能都照旧被唤醒。这一条与 `contentOnly` 的合并规则对称：`contentOnly !== true` 会清掉 `passContentOnly`，不带原因的同理把 `passReasons` 清回 `null`。

```ts
  /** Whether everything that asked for the pending pass was a batch inside the conversation column. */
  let passContentOnly = false
  /** The reasons this pass was asked for; null means the pass must wake every handle. */
  let passReasons: Set<WakeReason> | null = null
```

`schedule()` 的签名与合并逻辑：

```ts
  function schedule(options?: { contentOnly?: boolean, reason?: WakeReason }) {
    if (stopped) return
    if (options?.reason !== undefined) (passReasons ??= new Set<WakeReason>()).add(options.reason)
    else if (!scheduled) passReasons = null
    else passReasons = null
    if (scheduled) {
      if (options?.contentOnly !== true) passContentOnly = false
      return
    }
    scheduled = true
    passContentOnly = options?.contentOnly === true
```

在 `write()` 里把 `runMeasures()` 与同步循环的判断从 `content && handleOf(name)?.skipOnContentOnly === true` 换成统一的 `skips(handle, content, reasons)` 判断，并在 `write()` 开始时冻结这一帧的原因，结束时清空：

```ts
      write() {
        scheduled = false
        cancelPass = null
        if (stopped) return
        const content = passContentOnly
        const reasons = passReasons
        passContentOnly = false
        passReasons = null
        const skips = (handle: FeatureHandle | undefined) => {
          if (handle === undefined) return true
          if (content && handle.skipOnContentOnly === true) return true
          if (handle.wakesOn === undefined || reasons === null) return false
          for (const reason of handle.wakesOn) if (reasons.has(reason)) return false
          return true
        }
```

`read()` 用同一份判断，因此在读阶段与写阶段一致。**注意 `read()` 不能清空 `passReasons`**：`write()` 还要用同一份原因；读阶段只在写阶段没有跑到时补跑 `runMeasures()`。

```ts
      read() {
        measured = true
        if (stopped) return
        const content = passContentOnly
        const reasons = passReasons
        for (const name of features) {
          const handle = handleOf(name)
          if (handle === undefined) continue
          if (content && handle.skipOnContentOnly === true) continue
          if (handle.wakesOn !== undefined && reasons !== null) {
            let hit = false
            for (const reason of handle.wakesOn) if (reasons.has(reason)) hit = true
            if (!hit) continue
          }
          runMeasure(name)
        }
      },
```

在关键订阅处给原因：`scheduler.ts` 自己的 `document.body` 正文订阅传 `reason: 'content'`，视口订阅（`onFixedPopoverViewportChange`）传 `reason: 'viewport'`，60 秒的 `clockTimer` 要传 `reason: 'content'`——它存在的理由是主页问候语按小时换字，读的是时间，而它此前一直是整页 pass；若给它不带原因，`wakesOn` 就无法在它上面省下一次全页 pass。`packages/client/src/core/scheduler.ts` 不用改接口，只是透传计数。

`packages/client/src/features` 下的功能订阅各自标原因。原因按「这个功能的哪些读数会变」判断，不能按变化发生在屏幕的哪一侧判断：

```ts
// header-band.ts：读会话标题与视口
ui.headerBand = { measure, sync, skipOnContentOnly: true, wakesOn: ['header', 'viewport'] }
// view-tabs.ts：读视图偏好，位置由会话列决定
ui.viewTabs = { measure, sync, skipOnContentOnly: true, wakesOn: ['header', 'viewport'] }
// sidebar-status.ts：侧栏行与运行标记，另读输入卡停靠
ui.sidebarStatus = { measure, sync, skipOnContentOnly: true, wakesOn: ['sidebar', 'composer'], teardown }
// sidebar-entries.ts：只读侧栏行
ui.sidebarEntries = { sync, skipOnContentOnly: true, wakesOn: ['sidebar'] }
// account-footer.ts：账户行在侧栏底部，头像随会话与输入卡变化
ui.footer = { ...ui.footer, skipOnContentOnly: true, wakesOn: ['sidebar', 'composer'] }
// date-groups.ts：日期分组挂在侧栏会话树上
ui.dateGroups = { sync: arrange, skipOnContentOnly: true, wakesOn: ['sidebar'], teardown }
// manual-unread.ts：未读徽标在侧栏行上
ui.manualUnread = { ...ui.manualUnread, skipOnContentOnly: true, wakesOn: ['sidebar'] }
// model-picker.ts：模型名在输入卡上
ui.model = { ...ui.model, skipOnContentOnly: true, wakesOn: ['composer'] }
// effort-picker.ts：档位在输入卡上
ui.effort = { ...ui.effort, skipOnContentOnly: true, wakesOn: ['composer'] }
```

其余的聊天功能补上它们读的原因。**声明要宽于已知读数**，漏一条原因就是漏一次同步；这里一律把「内容」「输入卡」「视口」中它读到的都写上：

```ts
// chat-fold.ts
ui.chatFold = {
  isBusy: isChatFoldBusy,
  measure: () => messageFold.measure(),
  sync: () => messageFold.sync(),
  onCopyChange: () => { … },
  reposition: () => { … },
  wakesOn: ['content', 'composer', 'viewport'],
}
// chat-wait.ts
ui.chatWait = { measure: readTails, sync: syncInFrame, onCopyChange: sync, wakesOn: ['content', 'composer'] }
// composer.ts：读卡片清单、输入卡事件、宿主相位、视图偏好与视口
ui.composer = {
  measure: measureComposer,
  sync: syncComposer,
  isHero() { … }, heroCard() { … }, cards() { … }, isActive() { … }, isStudioHome() { … }, isChatHidden() { … },
  onCopyChange() { … }, onInput() { … }, onPointerDown: focusEditorOnPress,
  reposition(reason: 'viewport' | 'composer') { … },
  wakesOn: ['content', 'composer', 'viewport'],
}
// chat-follow.ts：按钮跟着会话列与输入卡的位置
ui.chatFollow = {
  sync() { placeFollowTail(tailStamp, cards.all()) },
  reposition() { placeFollowTail(tailStamp, cards.all()) },
  wakesOn: ['content', 'composer', 'viewport'],
}
// context-stats.ts：meter 与面板在输入卡上，数字跟会话
ui.contextStats = {
  measure: stats.measure,
  sync: stats.sync,
  reposition: stats.reposition,
  close(reason?: CloseReason) { … },
  wakesOn: ['content', 'composer', 'sidebar'],
}
// meter-ring.ts：圆环画在输入卡上，配色在侧栏与主题变化时也可能变
ui.meterRing = {
  sync: syncRing,
  measure() { … },
  root() { … }, roots() { … }, …
  wakesOn: ['content', 'composer', 'header'],
}
```

每一处都写在各自的 `ui.<handle> = { … }` 对象里，不另设表。`wakesOn` 只写在与订阅原因相关的句柄上：一个功能只要有一条变化路径没有声明，就要么补齐原因，要么不给这个句柄 `wakesOn`。**不给 `wakesOn` 永远安全，给了就必须覆盖全部读数**；`skipOnContentOnly` 继续按原样保留，两者是「与」的关系。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/testing/specs/mechanism/scheduler-cost/wake-reason.spec.ts`
Expected: PASS，两个用例都通过。

- [ ] **Step 5: 逐功能核对标记与盒没有变**

Run: `node packages/testing/smoke.mjs --feature header-band,view-tabs,sidebar-status,sidebar-entries,account,date-groups,manual-unread,model,effort --jobs 2`
Expected: 全部通过，包含每个功能自己的拆装用例。

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/scheduler.ts packages/client/src/core/scheduler.ts packages/client/src/features/header-band/header-band.ts packages/client/src/features/view-tabs/view-tabs.ts packages/client/src/features/sidebar-status/sidebar-status.ts packages/client/src/features/sidebar-entries/sidebar-entries.ts packages/client/src/features/account/account-footer.ts packages/client/src/features/date-groups/date-groups.ts packages/client/src/features/manual-unread/manual-unread.ts packages/client/src/features/model/model-picker.ts packages/client/src/features/effort/effort-picker.ts packages/client/src/features/chat-fold/chat-fold.ts packages/client/src/features/chat-wait/chat-wait.ts packages/client/src/features/composer/composer.ts packages/client/src/features/chat-follow/chat-follow.ts packages/client/src/features/context-stats/context-stats.ts packages/client/src/features/context-stats/meter-ring.ts packages/testing/specs/mechanism/scheduler-cost/wake-reason.spec.ts
git commit -m "perf(scheduler): 按功能声明的原因决定这一帧是否唤醒它"
```

---

### Task 3: 输入卡、统计与折叠只在输入变了时重算

**Files:**
- Modify: `packages/client/src/features/composer/composer.ts:348-363,412-420,459-489`
- Modify: `packages/client/src/features/composer/placeholder-copy.ts:148-250`
- Modify: `packages/client/src/features/context-stats/session-stats.ts:356-363,421-441`
- Modify: `packages/client/src/features/chat-fold/message-fold.ts:51-140,218-240`
- Test: packages/testing/specs/mechanism/scheduler-cost/quiet-repeat.spec.ts

**Interfaces:**
- Consumes: Task 2 的 `wakesOn`。
- Produces: `ObserveMatches` 返回值新增 `version(): number`，每次清单变化加一；`bus.ts` 的 `MatchList<T>` 加这个方法。

- [ ] **Step 1: Write the failing test**

```ts
/**
 * A pass with no change since the last one writes nothing and reads no layout;
 * the feature hands back the same answer without walking its list again.
 *
 * @capability scheduler-cost
 * @features engine
 * @risk A pass that runs on every frame walks every card and bubble on a long conversation and the page stutters without anything changing.
 */
import { expect, test } from 'vitest'
import { observeMatches } from '@dsh-claude-style/engine/bus'

test('a match list reports a version that moves only when its set changes', async () => {
  const root = document.createElement('div')
  document.body.append(root)
  const list = observeMatches<HTMLElement>('[data-test-version]')
  const before = list.version()
  expect(list.version()).toBe(before)
  const one = document.createElement('i')
  one.setAttribute('data-test-version', '')
  root.append(one)
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(list.version()).toBe(before + 1)
  expect(list.version()).toBe(before + 1)
  list.release()
  root.remove()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/testing/specs/mechanism/scheduler-cost/quiet-repeat.spec.ts`
Expected: FAIL，`MatchList` 上还没有 `version` 方法。

- [ ] **Step 3: Write minimal implementation**

在 `packages/engine/src/bus.ts` 的 `MatchRegistry` 里加 `version: number`，`MatchList` 加 `version(): number`，并在 `registryFor` 的回调里 `changed` 分支加一：

```ts
export interface MatchList<T extends Element> {
  all(): T[]
  /** How many times the set has changed since the registry was made. */
  version(): number
  release(): void
}
```

```ts
    if (changed) {
      registry.ordered = null
      registry.version += 1
      for (const listener of [...registry.listeners]) listener()
    }
```

```ts
    version() { return registry.version },
```

`composer.ts` 按卡片版次跳过「按卡片全量遍历」的那一段，**不能整段早退**：`readState()`、`syncRootMarks()`、`syncDraftState()`、`syncMobilePortrait()` 与 `syncControls()` 还读偏好、宿主相位与移动端口径，它们的变化不经过卡片清单：

```ts
  /** The cards' registry version the last pass read, and the cards it answered for. */
  let readCards = -1

  function syncComposer() {
    readState()
    const found = cards.all()
    const version = cards.version()
    // The variant and attachment marks follow the cards' own set; the root
    // marks and the controls also follow the preferences and the host's phase,
    // which no card registry carries.
    if (version !== readCards || !found.every(card => card.hasAttribute(COMPOSER_VARIANT_ATTRIBUTE))) {
      readCards = version
      heroCard = hero ? found.find(card => card.closest(SIDEBAR_CHAT_SELECTOR) === null) ?? null : null
      syncVariant(found)
      syncAttachments(found)
      placeholderCopy.sync(hero, active)
    }
    document.body.toggleAttribute(COMPOSER_ATTR, active)
    syncMobilePortrait(found)
    syncDraftState(found)
    syncControls(found)
    responsive.sync(found, active)
    syncRootMarks()
  }
```

`placeholder-copy.ts` 的 `syncStandIn` 记住占位符版次。**早退只能在「这一轮既没有要重画、也没有新占位符或新卡片」时成立**，因此版次比较要放在 `draw` 判断之后，且卡片清单的版次也要一起看：

```ts
  /** The placeholders' and cards' registry versions the last stand-in sweep read. */
  let readPlaceholders = -1
  let readStandInCards = -1

  function syncStandIn(target: string, active: boolean) {
    pass += 1
    const draw = active && activeLocale() !== drawnLocale
    drawnLocale = activeLocale()
    const found = cards.all()
    const version = placeholders.version()
    if (!draw && version === readPlaceholders && cards.version() === readStandInCards) return
    readPlaceholders = version
    readStandInCards = cards.version()
```

`session-stats.ts` 把 meter 清单与面板的读取搬进 `measure()`，`sync()` 只消费上一帧的读数：

```ts
  /** The meters and panel this frame paints, read in measure() and written in sync(). */
  let passMeters: HTMLElement[] = []
  let passPanel: HTMLElement | null = null

  measure() {
    passMeters = contextMeters()
    for (let i = 0; i < passMeters.length; i += 1) markContextMeter(passMeters[i])
    passPanel = contextPanel()
    const meter = findContextMeter()
    const skinRing = ring()
    pieColours = skinRing?.root() != null || meter === null || peerPresent('dsh-chat-ux') || readPrefs().contextDisplay !== CONTEXT_DISPLAY_PIE
      ? null
      : readPieColours(meter)
  }
```

`syncNumbers()` 的开头改用 `passMeters`：

```ts
    const meters = passMeters
    const meter = meters[0] ?? null
    for (let i = 0; i < meters.length; i += 1) binding.bindMeter(meters[i], false)
```

面板一段改用 `passPanel`：

```ts
    const panel = passPanel
    if (panel !== null) binding.bindPanel(panel)
```

`message-fold.ts` 的读阶段与写阶段必须用两个独立的版次。**同一个版次变量会让 `write()` 里的 `sync()` 看见 `measure()` 刚写下的值而直接返回**，那一帧的标记与按钮就再也写不出来：

```ts
  /** The rows' registry version each phase last consumed, kept apart: measure() runs before sync() in one frame and must not hide it. */
  let measuredRows = -1
  let syncedRows = -1

  function measure() {
    const version = rows.version()
    if (version === measuredRows) return
    measuredRows = version
    for (const row of rows.all()) {
      const bubble = bubbleOf(row)
      if (bubble !== null) decide(bubble)
    }
  }

  function sync() {
    const version = rows.version()
    if (version === syncedRows) return
    syncedRows = version
    for (const row of rows.all()) {
      const bubble = bubbles.get(row)
      if (bubble !== undefined && bubble.isConnected) apply(bubble)
    }
  }
```

`invalidate()` 里把两个版次都复原为 `-1`，让下一次读与写都重新遍历；`settleRow()` 是批次回调里直接读写的路径，它不走这两个版次，保持原样。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/testing/specs/mechanism/scheduler-cost/quiet-repeat.spec.ts`
Expected: PASS，版次只在清单真的变化时加一。

- [ ] **Step 5: 跑三个功能自己的冒烟用例**

Run: `node packages/testing/smoke.mjs --case composer,chat-fold,context-stats --jobs 2`
Expected: 全部通过；`scheduler idle once settled (0 passes in 1 s)` 仍为 0。

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/bus.ts packages/client/src/features/composer/composer.ts packages/client/src/features/composer/placeholder-copy.ts packages/client/src/features/context-stats/session-stats.ts packages/client/src/features/chat-fold/message-fold.ts packages/testing/specs/mechanism/scheduler-cost/quiet-repeat.spec.ts
git commit -m "perf(sync): 清单没变时不再重走输入卡、统计与折叠"
```

---

### Task 4: 把写在 sync 里的布局读取搬进 measure

**Files:**
- Modify: `packages/client/src/features/composer/composer.ts:459-489`
- Modify: `packages/client/src/features/context-stats/session-stats.ts:421-441`
- Modify: `packages/client/src/features/composer/placeholder-copy.ts:203-240`
- Test: packages/testing/specs/mechanism/scheduler-cost/read-phase.spec.ts

**Interfaces:**
- Consumes: Task 3 的版次缓存。
- Produces: `ComposerHandle` 新增 `measure(): void`，与 `sync()` 成对；`createPlaceholderCopy(...)` 的返回对象新增 `measure(): void`。

- [ ] **Step 1: Write the failing test**

```ts
/**
 * A feature's read phase collects every layout answer its write phase needs, so
 * no getBoundingClientRect or getComputedStyle runs after another feature wrote.
 *
 * @capability scheduler-cost
 * @features engine
 * @risk A read after a write forces the browser to lay the page out twice in one frame and every streamed batch costs two layouts.
 */
import { expect, test } from 'vitest'
import { installScheduler } from '@dsh-claude-style/engine/scheduler'

test('the write phase of a pass reads no layout after the first sync wrote', async () => {
  const log: string[] = []
  const ui = {
    retire: () => {},
    reader: {
      measure() {
        document.body.getBoundingClientRect()
        log.push('measure:read')
      },
      sync() {
        log.push('sync:write')
      },
    },
    writer: {
      sync() {
        document.body.style.height = '10px'
        log.push('sync:write')
      },
    },
    later: {
      sync() {
        document.body.getBoundingClientRect()
        log.push('sync:read-after-write')
      },
    },
  }
  const stop = installScheduler({} as never, ui as never, ['reader', 'writer', 'later'] as never, {
    copyChange: [], refresh: [], start: () => {}, systemMotionChanged: () => {},
  })
  ui.reader.sync()
  ;(ui as any).schedule()
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  stop()
  expect(log.filter(entry => entry === 'sync:read-after-write')).toHaveLength(0)
})
```

这条用例第一次跑会因 `later.sync()` 读布局而失败；把那个读取改成在 `measure()` 里读、在 `sync()` 里写，用例通过。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/testing/specs/mechanism/scheduler-cost/read-phase.spec.ts`
Expected: FAIL，日志里有 `sync:read-after-write`。

- [ ] **Step 3: Write minimal implementation**

测试文件里把 `later` 拆成读与写：

```ts
    later: {
      /** The box the write phase paints from, read before any sync runs. */
      height: 0,
      measure() {
        this.height = document.body.getBoundingClientRect().height
      },
      sync() {
        if (this.height > 0) log.push('sync:write')
      },
    },
```

`composer.ts`：`syncRootMarks()` 里的 `findComposerSeat()`、`conversationSessionId(findConversationSession())` 与 `conversationColumn()` 搬进 `measureComposer()`，并在 `ui.composer` 上登记。**`responsive.measure()` 保持它自己的 `requestFrame` 读阶段**，不要在这里再调一次，否则同一个读数会被排两帧：

```ts
  /** The conversation root and view the last measure read, for syncRootMarks to write. */
  let measuredRoot: Element | null = null
  let measuredView: string | null = null
  let measuredColumn = false

  function measureComposer() {
    measuredRoot = closestFrom(findComposerSeat(), `[${PHASE_ATTRIBUTE}]`)
    measuredView = conversationViewPreference(conversationSessionId(findConversationSession()))
    measuredColumn = conversationColumn() !== null
  }

  function syncRootMarks() {
    const root = measuredRoot
    const view = measuredView
    chatHidden = active && view !== null && COMPOSER_HIDDEN_VIEWS.has(view)
    if (root !== hiddenRoot) {
      hiddenRoot?.removeAttribute(COMPOSER_HIDDEN_ATTR)
      hiddenRoot = root
    }
    hiddenRoot?.toggleAttribute(COMPOSER_HIDDEN_ATTR, chatHidden)
    if (root !== transcriptRoot) {
      transcriptRoot?.removeAttribute(TRANSCRIPT_ATTR)
      transcriptRoot = root
    }
    transcriptRoot?.toggleAttribute(TRANSCRIPT_ATTR, active && measuredColumn)
  }
```

`syncComposer()` 的末尾不再调用 `syncRootMarks()` 前读取；`readState()` 仍留在 `syncComposer()` 里（它只读偏好，不读布局）。

```ts
  ui.composer = {
    measure: measureComposer,
    sync: syncComposer,
```

`session-stats.ts`：`measure()` 里把 `binding.syncLine(line)` 需要读的东西也读好，`sync()` 只写：

```ts
  /** The line and panel bindings the write phase applies, read in measure(). */
  let passLine: HTMLElement | null = null

  measure() {
    passMeters = contextMeters()
    for (let i = 0; i < passMeters.length; i += 1) markContextMeter(passMeters[i])
    passPanel = contextPanel()
    passLine = inline.root()
    // …既有配色读取保持不变
  }
```

`syncNumbers()` 里的 `const line = inline.root()` 改成 `const line = passLine`。`binding.syncLine()` 自身还会读布局，那部分属于 `stats-binding.ts`，这一任务只搬 `session-stats.ts` 的调用点；`binding` 里的读取留给后续任务，不在这条提交里改。

`placeholder-copy.ts`：把 `wantsStandIn()` 的查询结果在 `measure()` 里备好。**`measure()` 必须与 `sync()` 用同一份 `active` 与同一版次**，否则 `onInput()` 与 `settle()` 这两条不经过调度器读阶段的路径会拿到空集合：

```ts
  /** The cards that want a stand-in this frame, read before any feature writes. */
  let passWanted = new Set<HTMLElement>()

  function measure(active: boolean) {
    passWanted = new Set()
    if (!active) return
    for (const card of cards.all()) if (wantsStandIn(card)) passWanted.add(card)
  }
```

`syncStandIn()` 里 `if (!wantsStandIn(card)) continue` 改成 `if (!passWanted.has(card)) continue`；`onInput()` 与 `settle()` 在调用 `syncStandIn()` 之前先自己调一次 `measure(active)`，两条路径因此不依赖调度器是否跑过读阶段。返回对象：

```ts
  return {
    measure,
    sync(hero: boolean, active: boolean) {
```

`composer.ts` 调用处同步改成先 `placeholderCopy.measure(active)` 再 `placeholderCopy.sync(hero, active)`。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/testing/specs/mechanism/scheduler-cost/read-phase.spec.ts`
Expected: PASS，日志里没有 `sync:read-after-write`。

- [ ] **Step 5: 跑受影响的行为规范**

Run: `npx vitest run packages/testing/specs/mechanism/scheduler-cost/` 与 `node packages/testing/smoke.mjs --feature composer,context-stats --jobs 2`
Expected: 规范与冒烟全部通过。

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/features/composer/composer.ts packages/client/src/features/composer/placeholder-copy.ts packages/client/src/features/context-stats/session-stats.ts packages/testing/specs/mechanism/scheduler-cost/read-phase.spec.ts
git commit -m "perf(frame): 把输入卡、统计与提示的布局读取移进读阶段"
```

---

### Task 5: 常驻动画只改合成器属性

**Files:**
- Modify: `packages/client/src/features/sidebar-status/sidebar-status.css:44-96`
- Modify: `packages/client/src/shared/motion.css:100-220`
- Modify: `packages/client/src/shared/popover.css:130-140`
- Test: packages/testing/specs/behaviour/account-menu/blur-scope.spec.mjs

**Interfaces:**
- Consumes: `packages/client/src/theme/tokens.json` 里已有的 `--dsh-claude-period-*` 与 `--dsh-claude-ease-*`。
- Produces: 不新增标记。所有 `dsh-claude-popover-card` 都已经在开合路径里写 `data-open`（`shared/popover.ts` 的 `setMenuPopoverOpen`、`account-drawer.ts`、`turn-nav.ts`、`settings-percent-control.ts`），所以滤镜选择器可以直接读既有状态。

- [ ] **Step 1: Write the failing test**

```js
/**
 * A closed card carries no backdrop filter, so the compositor keeps no blurred
 * layer for a surface nobody sees; an open one keeps the same blur it had.
 *
 * @capability popover
 * @features shared
 * @risk Every closed menu card keeps a full-window blur layer alive and scrolling the conversation drops frames on an integrated GPU.
 */
import { spec } from '../../fixtures/behaviour.mjs'

export default spec({ page: 'host-palette' }, ({ test }) => {
  test('a closed card carries no backdrop filter and an open one does', async (t) => {
    await t.prefs({ palette: 'host' })
    const card = t.surface('popover.card')
    const openAttribute = t.surface.attribute('popover.open')
    await t.page.evaluate(({ selector, attribute }) => {
      const node = document.querySelector(selector)
      if (node === null) throw new Error('the stand-in page carries no popover card')
      node.setAttribute(attribute, 'false')
    }, { selector: card, attribute: openAttribute })
    const closed = await t.read.computed(card, 'backdrop-filter')
    await t.page.evaluate(({ selector, attribute }) => {
      const node = document.querySelector(selector)
      if (node === null) throw new Error('the stand-in page carries no popover card')
      node.setAttribute(attribute, 'true')
    }, { selector: card, attribute: openAttribute })
    const open = await t.read.computed(card, 'backdrop-filter')
    t.expectThat.equal(closed, 'none', 'a card nobody opened paints no blur')
    t.expectThat.equal(open !== 'none', true, 'an open card keeps its blur')
  })
})
```

页面要在 `data-dsh-claude-palette="host"` 下才命中这条滤镜。`host-palette` 这一页就是为它准备的（`packages/testing/smoke/stand-in/host-palette.js` 装了宿主令牌，探针卡片也带 `data-open="true"`），用例的 `page` 取 `'host-palette'`，并在 `t.prefs({ palette: 'host' })` 之后读两档。`desktop` 页没有装宿主令牌，命中不了这条规则。

- [ ] **Step 2: Run test to verify it fails**

Run: `node packages/testing/behaviour.mjs --spec account-menu/blur-scope`
Expected: FAIL——关闭状态的卡片也会读到 `blur(16px) saturate(1.4)`。

- [ ] **Step 3: Write minimal implementation**

`popover.css` 里把滤镜收到打开状态：

```css
/* Under the host's colours the card's fill is the host's overlay layer: the
   blur belongs to a card that is open — a closed one keeps its layout box and
   paints nothing, so it must not keep a compositor layer alive either. */
body[data-dsh-claude-style][data-dsh-claude-palette="host"] .dsh-claude-popover-card[data-open="true"] {
  -webkit-backdrop-filter: blur(16px) saturate(1.4) !important;
  backdrop-filter: blur(16px) saturate(1.4);
}
```

`packages/testing/smoke/probe/shell-palette.js` 读到的那张探针卡片已经带 `data-open="true"`，`host-palette` 用例的 `/blur\(16px\)/` 断言因此仍然成立；若实现后该用例失败，说明探针卡片缺少 `data-open`，补的是探针本身，断言保持原样。

`sidebar-status.css` 的标题扫光改走位移。**不能只把 `background-position` 换成 `transform` 而不改动图层结构**：标题元素本身承载文字，直接位移会把整行字移出裁切盒。正确做法是保留标题文字不动，把扫光交给标题内部的一层高亮：

```css
/* The title's own words stay where they are; the shine is a layer over them,
   moved by transform so the compositor plays it without repainting. */
body[data-dsh-claude-style]:not([data-dsh-claude-motion="reduced"])[data-dsh-claude-ongoing-indicator="shimmer"] [data-dsh-claude-running-title]:not([aria-selected="true"]) > [data-dsh-claude-part~="row-title"] {
  position: relative;
  overflow: hidden;
  isolation: isolate;
}
body[data-dsh-claude-style]:not([data-dsh-claude-motion="reduced"])[data-dsh-claude-ongoing-indicator="shimmer"] [data-dsh-claude-running-title]:not([aria-selected="true"]) > [data-dsh-claude-part~="row-title"]::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(var(--dsh-claude-title-angle, 120deg),
    transparent 37.5%,
    color-mix(in srgb, var(--dsh-claude-status-title-peak) 16%, transparent) 41%,
    color-mix(in srgb, var(--dsh-claude-status-title-peak) 46%, transparent) 44%,
    color-mix(in srgb, var(--dsh-claude-status-title-peak) 83%, transparent) 47%,
    var(--dsh-claude-status-title-peak) 50%,
    color-mix(in srgb, var(--dsh-claude-status-title-peak) 83%, transparent) 53%,
    color-mix(in srgb, var(--dsh-claude-status-title-peak) 46%, transparent) 56%,
    color-mix(in srgb, var(--dsh-claude-status-title-peak) 16%, transparent) 59%,
    transparent 62.5%);
  background-size: 400% 100%;
  mix-blend-mode: plus-lighter;
  pointer-events: none;
  animation: dsh-claude-title-shine var(--dsh-claude-period-status-title) var(--dsh-claude-ease-status-title) infinite;
}
@keyframes dsh-claude-title-shine {
  0%, 15% { transform: translateX(83.333%); }
  85%, 100% { transform: translateX(16.667%); }
}
@keyframes dsh-claude-title-shine-rtl {
  0%, 15% { transform: translateX(16.667%); }
  85%, 100% { transform: translateX(83.333%); }
}
```

`mix-blend-mode` 与 `isolation` 会改变合成结果，**这一条必须在真实页面上由读者确认明暗两套外观**；若读者看到的亮度与改动前不同，改用两层同色叠画并只动 `opacity`，同时把 `washLine`／`appearance` 的读数一起更新。RTL 规则用 `:dir(rtl)` 换 `animation-name`，与既有写法一致。

`motion.css` 的色流同时改 `background-position` 与 `filter`，两者的替代写法不同：色流的八层背景是 `::before` 的 `background-image`，`transform` 只能整体移动伪元素，不能分别移动八层。**这里的可行改法是把八层画进两个叠放的伪元素，由 `opacity` 交叉淡入，八层背景本身不再逐帧动**；这会让 `packages/testing/wash-line.mjs` 读到的 `washes` 从 7 变成两层各自持有的层数，验收必须随实现一起改，并在提交说明里写明读者看到的是同一段色流：

```css
@keyframes dsh-claude-wash-cross {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

`model-cards.ts` 的 `trackPointer` 已经只在卡片打开期间挂载（`trackPointerWhileOpen()` 在关闭时 `unbindPointerTracking()`），**这一处不需要改**；原文那条 `if (!open) return` 会引用一个不存在的变量。本条任务不动 `model-cards.ts`。

- [ ] **Step 4: Run test to verify it passes**

Run: `node packages/testing/behaviour.mjs --spec account-menu/blur-scope`
Expected: PASS，关闭卡片的 `backdrop-filter` 为 `none`，打开后不再是 `none`。

- [ ] **Step 5: 跑动效与外观核对**

Run: `node packages/testing/smoke.mjs --case host-palette,motion --jobs 1` 与 `node packages/testing/e2e.mjs --scenario motion,washLine --jobs 1`
Expected: `host-palette` 仍读到探针卡片的 `blur(16px)`；`motion` 与 `washLine` 通过。`washLine` 的 `washes` 读数若因色流改成两枚伪元素而变化，必须同步更新该场景的断言与 `@risk` 文字，并在提交说明里写明改动前后各读到什么。

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/shared/popover.css packages/client/src/shared/motion.css packages/client/src/features/sidebar-status/sidebar-status.css packages/testing/wash-line.mjs packages/testing/specs/behaviour/account-menu/blur-scope.spec.mjs
git commit -m "perf(style): 常驻动画改走合成器属性，关闭的卡片不再保留滤镜层"
```

---

### Task 6: 首屏不需要的功能延后装载

**Files:**
- Modify: `packages/client/src/features/header-band/header-band.manifest.ts:4-6`
- Modify: `packages/client/src/features/view-tabs/view-tabs.manifest.ts:4-6`
- Test: packages/testing/specs/behaviour/chunks/first-paint.spec.mjs

**Interfaces:**
- Consumes: `load: 'deferred'` 与 `loadFeatureChunk()` 的现有机制（D76）。
- Produces: 两个功能清单的新 `load` 值；其余字段不变。`turn-nav` 与 `message-actions` 已经在清单里声明 `load: 'deferred'`，本任务不改它们，也不重复提交。

- [ ] **Step 1: Write the failing test**

```js
/**
 * A feature the first frame does not need arrives in its own chunk, and the
 * page it belongs to paints before that chunk lands.
 *
 * @capability chunks
 * @features header-band, view-tabs
 * @risk A first page waits on scripts for surfaces the reader has not opened and the conversation appears late.
 */
import { spec } from '../../fixtures/behaviour.mjs'

export default spec({ page: 'desktop' }, ({ test }) => {
  test('the shell paints and the deferred chunks were requested', async (t) => {
    const reading = await t.page.evaluate(() => ({
      // The routed feature chunks are the classic scripts under the asset route;
      // the bundle's own url is not one of them.
      chunks: performance.getEntriesByType('resource')
        .map(entry => entry.name)
        .filter(name => name.includes('/dsh-claude-style/assets/') && name.endsWith('.js')).length,
      painted: document.body.checkVisibility({ visibilityProperty: true, opacityProperty: true }),
      content: document.querySelectorAll('[data-dsh-claude-part]').length,
    }))
    t.expectThat.equal(reading.content > 0, true, "the shell carries the skin's own marks")
    t.expectThat.equal(reading.chunks >= 10, true, `the deferred chunks were requested (${reading.chunks})`)
    t.expectThat.equal(reading.painted, true, 'the body paints')
  })
})
```

`10` 这个数是「当前 8 个延后功能，加上本任务新增的 2 个」；执行时先用 `node -e "…"` 读出 `readManifests()` 里 `load === 'deferred'` 的条数，把断言写成实际条数，并把该数字与理由写进 `packages/testing/data/bounds.json`。**不要用 `performance.getEntriesByType('resource')` 里的文件名正则**：路由地址带内容哈希与查询串，`/assets/[0-9a-f]+\.js$` 匹配不到。

- [ ] **Step 2: Run test to verify it fails**

Run: `node packages/testing/behaviour.mjs --spec chunks/first-paint`
Expected: FAIL——`header-band` 与 `view-tabs` 仍在主产物里，请求到的块数比期望少 2。

- [ ] **Step 3: Write minimal implementation**

两个清单各加 `load: 'deferred'`，其余字段不动：

```ts
// header-band.manifest.ts
  id: 'headerBand',
  order: 255,
  load: 'deferred',
```

```ts
// view-tabs.manifest.ts
  id: 'viewTabs',
  order: 250,
  load: 'deferred',
```

`turn-nav`、`message-actions` 与 `search` 都已经声明 `load: 'deferred'`，不在这一步的改动里。

- [ ] **Step 4: Run test to verify it passes**

Run: `node packages/testing/behaviour.mjs --spec chunks/first-paint`
Expected: PASS，块请求数达到清单里的延后功能数。

- [ ] **Step 5: 跑构建与延后功能的冒烟**

Run: `npm run build` 与 `node packages/testing/smoke.mjs --feature header-band,view-tabs --jobs 2`
Expected: 构建通过（导入图没有模块被两处携带）；两个功能各自的安装、拆除与延后到达用例全部通过。

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/features/header-band/header-band.manifest.ts packages/client/src/features/view-tabs/view-tabs.manifest.ts packages/testing/specs/behaviour/chunks/first-paint.spec.mjs
git commit -m "perf(load): 把首屏不需要的标题条与标签条移进延后块"
```

---

### Task 7: 页隐藏时连脚本时钟一起停下

**Files:**
- Modify: `packages/client/src/features/chat-wait/chat-wait.ts:95,400-420`
- Modify: `packages/client/src/features/home/home-store.ts:83-155`
- Modify: `packages/engine/src/scroll-owner.ts:538-573`
- Modify: `packages/engine/src/host.ts`、`packages/engine/src/skin.ts`
- Modify: `packages/client/src/entry.ts`
- Modify: `packages/client/src/features/chat-reveal/chat-reveal.settings.ts:1-30`
- Modify: `packages/client/src/features/caret/caret.settings.ts:40-60`
- Test: packages/testing/specs/behaviour/page-visibility/script-clocks.spec.mjs

**Interfaces:**
- Consumes: `subscribePageHidden(listener)` 与 `pageHidden()`（`packages/client/src/core/page-visibility.ts`）。
- Produces: `SkinSeam.pageHidden(): boolean`；`packages/engine/src/host.ts` 新增同名访问器。`home-ripple.ts` 已经接好可见性，不在本任务里。

- [ ] **Step 1: Write the failing test**

```js
/**
 * A page off screen runs no skin clock: the waiting line's poll, the usage
 * panel's poll and the scheduler's own minute timer stop, and come back.
 *
 * @capability page-visibility
 * @features chat-wait, home
 * @risk A window left in the background keeps polling and frames up, and coming back to it stalls while the queued work catches up.
 */
import { spec } from '../../fixtures/behaviour.mjs'

async function reportPage(t, offScreen) {
  await t.page.evaluate((off) => {
    if (off) Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    else delete document.visibilityState
    document.dispatchEvent(new Event('visibilitychange'))
  }, offScreen)
  await t.settle()
}

export default spec({ page: 'context-stats' }, ({ test }) => {
  test('the skin asks for no frame while the page is off screen', async (t) => {
    await t.page.evaluate(() => {
      window.__frames = 0
      const raf = window.requestAnimationFrame.bind(window)
      window.requestAnimationFrame = (callback) => { window.__frames += 1; return raf(callback) }
    })
    await reportPage(t, true)
    const before = await t.page.evaluate(() => window.__frames)
    await t.page.waitForTimeout(1200)
    const after = await t.page.evaluate(() => window.__frames)
    t.expectThat.equal(after - before, 0, 'the page asked for no frame while off screen')
    await reportPage(t, false)
  })
})
```

`context-stats` 页上跑着等待线、用量面板与调度器的时钟，三者任一在隐藏后继续排帧都会让这条断言失败。**这条用例只能证明「没有任何 skin 时钟在排帧」**，不能证明每一处都停了；`chat-wait`、`home-store` 与调度器的停止各自由它自己的读数覆盖（Step 3 末尾的检查）。

- [ ] **Step 2: Run test to verify it fails**

Run: `node packages/testing/behaviour.mjs --spec page-visibility/script-clocks`
Expected: FAIL——隐藏后仍能读到新的请求数。

- [ ] **Step 3: Write minimal implementation**

`chat-wait.ts` 的轮询起停包进可见性。**`timer` 的声明位置要先确认**：它现在是 `syncLines()` 里读写的模块级变量，抽成 `startTick()` 时保持同一个变量，不要新起一个局部定时器。

```ts
  // The line's own clock: off screen it holds, and the return restarts it.
  const stopVisibility = subscribePageHidden(hidden => {
    if (hidden) {
      if (timer !== null) window.clearInterval(timer)
      timer = null
    } else if (runningRows.all().length > 0 && timer === null) {
      startTick()
    }
  })
```

把 `syncLines()` 里起 `setInterval` 的那段抽成 `startTick()`，里面先判 `pageHidden()`：

```ts
  function startTick() {
    if (timer !== null || pageHidden() || stopped) return
    timer = window.setInterval(() => {
      if (cancelTick !== null) return
      cancelTick = requestFrame({
        read: readTails,
        write() {
          cancelTick = null
          syncInFrame()
        },
      })
    }, TICK_MS)
  }
```

`syncLines()` 末尾那段 `if (rows.length > 0 && timer === null) { … } else if (rows.length === 0 && timer !== null) { … }` 改成调用 `startTick()` 与停止；teardown 里补 `stopVisibility()`。

`home-store.ts` 的轮询同样在隐藏时清掉，回来后调一次 `loadUsage(true)`：

```ts
  const stopVisibility = subscribePageHidden(hidden => {
    if (hidden) { stopPolling(); return }
    loadUsage(true)
  })
```

`read()` 结尾先判隐藏再排下一次：

```ts
      if (usage.computing && !pageHidden()) {
```

`stop()` 里补 `stopVisibility()`。

`scroll-owner.ts` 的 `handBackFollow` 把 `look` 的每一轮都先判可见性：

```ts
  const look = () => {
    if (pageHidden() || !stillWanted() || rounds >= FOLLOW_LOOK_ROUNDS) {
      if (onSettled !== null) onSettled()
      return
    }
```

引擎不认识皮肤的模块（D73），所以可见性答案由 `packages/engine/src/skin.ts` 的交接缝交出，`packages/engine/src/host.ts` 只加一层转调：

```ts
// packages/engine/src/skin.ts
export interface SkinSeam {
  …
  /** Whether the page is off screen right now, answered by the skin's one visibility owner. */
  pageHidden(): boolean
}
```

```ts
// packages/engine/src/host.ts
import { skin } from './skin'

/**
 * Whether the page is off screen, answered by the skin's visibility owner
 * through the seam (packages/engine/src/skin.ts, D73).
 */
export function pageHidden(): boolean {
  return skin().pageHidden()
}
```

`packages/client/src/entry.ts` 的 `adoptSkin({ … })` 传入 `pageHidden`（从 `packages/client/src/core/page-visibility.ts` 导入）。`scroll-owner.ts` 只导入访问器：

```ts
import { pageHidden } from './host'
```

`chat-reveal.settings.ts` 与 `caret.settings.ts` 的预览定时器也接可见性：`React.useEffect` 里先 `subscribePageHidden`，隐藏时清定时器、回来时重建。写法与 `home-store.ts` 相同；清理函数里必须同时 `clearInterval` 与 `stopVisibility()`。

调度器的 60 秒 `clockTimer` 也要在隐藏时停：它属于引擎，按同一访问器判断，或在 `scheduler.ts` 里订阅一个由皮肤交来的可见性源；**不要**在引擎里直接 `import` 浏览器的 `document.visibilityState` 之外的皮肤模块。

- [ ] **Step 4: Run test to verify it passes**

Run: `node packages/testing/behaviour.mjs --spec page-visibility/script-clocks`
Expected: PASS，隐藏期间请求数增量为 0，回来后重新开始。

- [ ] **Step 5: 跑既有可见性规范与冒烟**

Run: `node packages/testing/behaviour.mjs --spec page-visibility/hold-still` 与 `node packages/testing/smoke.mjs --case chat-wait,context-stats,caret --jobs 2`
Expected: 全部通过；`scheduler idle once settled` 仍为 0。

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/skin.ts packages/engine/src/host.ts packages/engine/src/scroll-owner.ts packages/client/src/entry.ts packages/client/src/features/chat-wait/chat-wait.ts packages/client/src/features/home/home-store.ts packages/client/src/features/chat-reveal/chat-reveal.settings.ts packages/client/src/features/caret/caret.settings.ts packages/testing/specs/behaviour/page-visibility/script-clocks.spec.mjs
git commit -m "perf(visibility): 页面离开屏幕时连脚本时钟一起停下"
```

---

### Task 8: 把新读数接进长会话的上限

**Files:**
- Modify: `packages/testing/data/bounds.json`
- Modify: `packages/testing/long-session.mjs:53-74,147-193`
- Modify: `packages/testing/data/check-numbers.json`（由工具重写）
- Test: `packages/testing/e2e.mjs --scenario longSession`

**Interfaces:**
- Consumes: Task 0 的 `reportPass` 读数与 Task 1–7 的实现。
- Produces: 新增两条边界 `longSessionPassCalls`、`longSessionLayoutReads`，两条都带理由。

- [ ] **Step 1: Write the failing test**

在 `packages/testing/long-session.mjs` 的 `assert()` 里加两条检查，数字全部从 `bound()` 读。`bound()` 在 `bounds.json` 没有这个名字时直接抛错，这正是这一步期望的失败；两条检查本身不新增别的辅助函数。

```js
      const passCalls = bound('longSessionPassCalls')
      const layoutReads = bound('longSessionLayoutReads')
      rounds.push(
        check('一帧叫醒的功能数不随会话变长而增加',
          Math.max(0, ...measured.passMeasures) <= passCalls,
          `pass measures ${Math.max(0, ...measured.passMeasures)}, syncs ${Math.max(0, ...measured.passSyncs)}`),
        check('一帧的布局读取次数不随会话变长而增加',
          (measured.layoutReads ?? 0) <= layoutReads,
          `layout reads ${measured.layoutReads}`),
      )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node packages/testing/e2e.mjs --scenario longSession --jobs 1`
Expected: FAIL，`bounds.json` 里还没有这两个名字，`bound()` 直接抛出。

- [ ] **Step 3: Write minimal implementation**

`packages/testing/data/bounds.json` 追加两条。**两条的值要先由 Task 0 的基线读数决定**，不能先写死再倒推：

```json
    {
      "name": "longSessionPassCalls",
      "value": 48,
      "reason": "The most feature hooks one pass may call on either measured round. The shipped page installs about forty handles and most implement one hook; a pass that calls every handle on every streamed batch lands above it."
    },
    {
      "name": "longSessionLayoutReads",
      "value": 60,
      "reason": "The most layout reads one measured turn may make. Task 0's baseline records what the page read before the change; the value sits above that reading and far below one read per row of a long transcript."
    },
```

`long-session.mjs` 的 `read()` 补上页面计数。**`passes` 必须在 `page.evaluate()` 的同一个回调里读出**，否则 `window` 在 Node 侧不存在：

```js
async function read(page) {
  return page.evaluate(() => ({
    frames: window.__longSession.frames.slice(),
    longtasks: window.__longSession.longtasks.slice(),
    queries: window.__longSession.queries,
    nodes: document.querySelectorAll('body *').length,
    rows: document.querySelectorAll('[data-chat-flow-kind]').length,
    passes: window.__dshPassReadings ? window.__dshPassReadings.read() : [],
    layoutReads: window.__longSession.layoutReads ?? 0,
    passMeasures: (window.__dshPassReadings ? window.__dshPassReadings.read() : []).map(reading => reading.measures),
    passSyncs: (window.__dshPassReadings ? window.__dshPassReadings.read() : []).map(reading => reading.syncs),
  }))
}
```

`initScript` 里给布局读取挂计数（`Element.prototype.getBoundingClientRect` 与 `Element.prototype.getClientRects`），只数调用次数。**包装必须保留原函数的返回值与 `this`**，并且要在 `__longSession` 建好之后立即装上：

```js
      window.__longSession = { frames: [], longtasks: [], queries: 0, layoutReads: 0 }
      const boxed = (original) => function (...args) {
        window.__longSession.layoutReads += 1
        return original.apply(this, args)
      }
      Element.prototype.getBoundingClientRect = boxed(Element.prototype.getBoundingClientRect)
      Element.prototype.getClientRects = boxed(Element.prototype.getClientRects)
```

`measureTurn()` 的第一段补上清空读数与布局计数：

```js
  await page.evaluate(() => {
    window.__longSession.frames.length = 0
    window.__longSession.longtasks.length = 0
    window.__longSession.queries = 0
    window.__longSession.layoutReads = 0
    window.__dshPassReadings?.clear()
  })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `DSH_CLAUDE_STYLE_PASS_READINGS=1 npm run build` 与 `node packages/testing/e2e.mjs --scenario longSession --jobs 1`
Expected: PASS，两条新检查打印读数且在上限内。

- [ ] **Step 5: 把全部读数和改动前对照一遍**

Run: `DSH_CLAUDE_STYLE_PASS_READINGS=1 npm run build` 与 `DSH_LONG_SESSION_TURNS=8 node packages/testing/e2e.mjs --scenario longSession --jobs 1`
Expected: `rows`、`queries`、`p95`、`long tasks` 不劣于 Task 0 记下的基线；`passMeasures` 与 `passSyncs` 的 p95 不随会话长度放大。跑完后再执行一次 `npm run build`，把不带读数入口的正式产物写回 `lib/`。

- [ ] **Step 6: 重写受影响的记录并核对**

Run: `node packages/testing/check-numbers.mjs` 与 `node scripts/ci-scope.mjs --ledgers --base master`
Expected: `check-numbers.json` 只多出这两条检查的数字；`document-lookups.json` 的清册没有增长。

- [ ] **Step 7: Commit**

```bash
git add packages/testing/long-session.mjs packages/testing/data/bounds.json packages/testing/data/check-numbers.json
git commit -m "test(perf): 把一帧的功能调用数与布局读取数纳入长会话上限"
```

---

## Self-Review

**1. 方案覆盖**：`docs/PERFORMANCE.md` 的八节对应 Task 1（分片分发）、Task 2（唤醒原因）、Task 3（版次缓存）、Task 4（读写分处）、Task 5（合成路径）、Task 6（延后装载）、Task 7（页隐藏）、Task 8（读数与上限）。Task 0 是 Task 8 需要的测量入口。

**2. 占位符扫描**：每一步都给出了要写的代码、要跑的命令与预期结果；没有 `TBD`、`TODO` 或 `similar to Task N`。Task 6 的块数断言要求执行时从清单读出实际条数，这写在步骤里，不作为占位符。

**3. 类型一致**：`WakeReason` 在 Task 2 定义并被调度器与九个 `skipOnContentOnly` 句柄使用；`MatchList.version()` 在 Task 3 定义并被输入卡、占位符、统计与折叠使用；`reportPass` 在 Task 0 定义并被 Task 8 读取；`recordPassReading` 只出现在 `core/scheduler.ts` 的接线处；`SkinSeam.pageHidden()` 与 `engine/host.ts` 的访问器同名，Task 7 只新增这一条跨半边的答案。

**4. 依赖方向**：Task 7 里 `packages/engine/src/scroll-owner.ts` 不得导入浏览器半边的 `packages/client/src/core/page-visibility.ts`（D73 与 `npm run lint` 都会拒绝）；可见性答案由 `packages/engine/src/skin.ts` 的 `SkinSeam` 交出，`packages/engine/src/host.ts` 只做转调，`scroll-owner.ts` 只调用访问器。

**5. 与代码现状的一致性**：Task 1 的受众函数按 `mutationSubscriptions` 回填，保住订阅顺序；Task 3 的输入卡只跳过全量遍历，折叠的读与写各用独立版次；Task 5 不动 `model-cards.ts`（指针跟踪已经只在打开时挂），标题扫光改为内部高亮层而非位移文字；Task 6 只改 `header-band` 与 `view-tabs`（`turn-nav` 与 `message-actions` 已经延后）；Task 7 不重复处理 `home-ripple.ts`（它已接好可见性）；Task 8 的页面读数在 `page.evaluate()` 的回调内读取。

**6. 验收边界**：Task 5 的 `washLine` 读数与 Task 6 的块数断言都可能随实现变化，两处都写明了「必须随实现同步更新，并说明改动前后各读到什么」，不允许放宽断言通过。
