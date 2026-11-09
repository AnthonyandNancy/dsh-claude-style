/**
 * scroll-sample.mjs — the counters a scroll or a drag scenario reads off the
 * page: frame gaps, box and style reads, mutations, long tasks, and the pass
 * readings the build records. Both lanes arm the same sampler before the page's
 * own scripts run, so one scenario's numbers mean the same as another's.
 *
 * @capability scroll-pace
 * @features engine
 * @risk Two scenarios arm different counters, so a reading that looks cheaper
 *       is only measuring less of the page than the one beside it.
 */

/**
 * The reading store the page keeps under `name`, armed before its own scripts.
 *
 * @param name - the global the page and the reading share, e.g. `__scrollPace`.
 * @returns the function the page runs as its init script; it must be
 *     serializable, so it reads everything it needs from the window.
 */
export function samplerInit(name) {
  const state = window[name] = {
    passes: [], rects: 0, styles: 0, queries: 0, mutations: 0, frames: [], longtasks: [], extraFrames: 0,
  }
  const raf = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (callback) => { state.extraFrames += 1; return raf(callback) }
  window.__dshSmokeHost = window.__dshSmokeHost ?? {}
  window[`${name}Clear`] = () => {
    state.passes.length = 0
    state.rects = 0
    state.styles = 0
    state.queries = 0
    state.mutations = 0
    state.frames.length = 0
    state.longtasks.length = 0
    state.extraFrames = 0
    window.__dshPassReadings?.clear()
    window.__dshMutationReadings?.clear()
  }
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
  new MutationObserver((records) => { state.mutations += records.length })
    .observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true })
}

/** Empty the counters before one phase. */
export function resetSample(page, name) {
  return page.evaluate((key) => window[`${key}Clear`](), name)
}

/**
 * Read one phase's counters as the numbers the checks bound.
 *
 * @param name - the global the page's sampler stores its reading under.
 * @param extra - further readings this scenario keeps per pass, by field name.
 */
export function readSample(page, name, extra = []) {
  return page.evaluate(([key, fields]) => {
    const state = window[key]
    const gaps = state.frames.slice().sort((left, right) => left - right)
    const at = (share) => gaps.length === 0 ? 0 : gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * share))]
    const passes = window.__dshPassReadings ? window.__dshPassReadings.read() : []
    const mutations = window.__dshMutationReadings ? window.__dshMutationReadings.read() : null
    const reading = {
      passReadings: window.__dshPassReadings !== undefined,
      passes: passes.length,
      rects: state.rects,
      styles: state.styles,
      queries: state.queries,
      mutations: state.mutations,
      frames: gaps.length,
      p95: at(0.95),
      worst: gaps.length === 0 ? 0 : gaps[gaps.length - 1],
      over33: gaps.filter((value) => value > 33).length,
      longTotal: state.longtasks.reduce((sum, duration) => sum + duration, 0),
      extraFrames: state.extraFrames,
      busBatches: mutations?.batches ?? 0,
      busCallbacks: mutations?.callbacks ?? 0,
      busRoutingMs: mutations?.routingMs ?? 0,
      busDispatchMs: mutations?.dispatchMs ?? 0,
      busRemounts: mutations?.remounts ?? 0,
      busSubscribers: mutations?.subscribers ?? {},
    }
    for (const field of fields) reading[field] = passes.map((entry) => entry[field])
    return reading
  }, [name, extra])
}

/**
 * Drag one element's centre by `travel` pixels of a sine wave, one pointer
 * position a frame, while the pointer stays down.
 *
 * @param page - the lane's page.
 * @param selector - the element whose centre the press starts on.
 * @param ms - how long the drag runs.
 * @param travel - how far the pointer swings from the press.
 * @param label - the scenario's name, for a page with no such element.
 * @returns how many pointer positions were sent.
 */
export async function dragBySine(page, selector, ms, travel, label) {
  const box = await page.locator(selector).boundingBox()
  if (box === null) throw new Error(`${label}: the page carries no ${selector}`)
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  const started = Date.now()
  let steps = 0
  while (Date.now() - started < ms) {
    await page.mouse.move(start.x + Math.sin(steps / 8) * travel, start.y)
    steps += 1
    await page.waitForTimeout(16)
  }
  await page.mouse.up()
  return steps
}

/**
 * Fill a conversation past one screen, then settle: the opening every scenario
 * that reads a long transcript's frame cost starts from.
 *
 * @param page - the lane's page.
 * @param send - the lane's prompt sender.
 * @param wait - the lane's turn waiter.
 * @param turns - how many fill turns the transcript needs.
 */
export async function fillTranscript(page, send, wait, turns) {
  for (let turn = 1; turn <= turns; turn += 1) {
    await send(page, `fill the transcript ${turn}`)
    await wait(page)
  }
  await page.waitForTimeout(1200)
}

/**
 * Read the page at rest for two seconds: a pass or a box read in this stretch
 * is a change nobody asked for.
 *
 * @param page - the lane's page.
 * @param reset - the scenario's own counter reset.
 * @param read - the scenario's own reading.
 */
export async function readAtRest(page, reset, read) {
  await reset(page)
  await page.waitForTimeout(2000)
  return read(page)
}

/**
 * The opening both frame-cost scenarios share: a long scripted answer, the
 * transcript filled past a screen, and the counters armed before the page's own
 * scripts run.
 *
 * @param viewport - the window the scenario is read at.
 * @param initScript - the scenario's sampler, run before the page's scripts.
 * @param fill - how the scenario refills the transcript before its turn.
 */
export function frameCostScenario({ viewport, initScript, fill }) {
  return {
    script: 'long',
    prompt: 'write a long answer',
    delayMs: 60,
    viewport,
    initScript,
    beforeSend: fill,
  }
}

/**
 * The after-turn opening both scenarios share: read the page at rest, then
 * start the counters for the phase the scenario is about.
 *
 * @param page - the lane's page.
 * @param reset - the scenario's own counter reset.
 * @param read - the scenario's own reading.
 * @param measure - the phase the scenario reads, run once the counters stand.
 */
export async function idleThen(page, reset, read, measure) {
  const idle = await readAtRest(page, reset, read)
  await reset(page)
  return { idle, phase: await measure() }
}
