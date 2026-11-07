/**
 * A view-tab strip the host rebuilds when a session is switched is already in
 * its place in the first frame the browser paints: the frame shows the skin's
 * centring rather than the host's own row, and under the Windows caption row
 * the strip is in the band already rather than inside the header for a frame.
 *
 * @capability view-tabs
 * @features view-tabs
 * @risk Switching between two sessions makes the tab strip jump sideways a frame or two after the conversation is drawn, which reads as a page still settling.
 */
import { spec, host, surface } from '../../fixtures/behaviour.mjs'
import { BUILD_VIEW_STRIP, HEADER_SLOT, TAB_LIST, WINDOWS_TITLEBAR } from '../../fixtures/view-tabs-strip.mjs'

const HEADER = HEADER_SLOT
const TABS = TAB_LIST
const WINDOWS = WINDOWS_TITLEBAR
const STRIP = surface.attribute('view-tabs.strip')
const TITLEBAR = surface.attribute('view-tabs.titlebar')

/**
 * Replace the conversation header inside one batch the weight of a session
 * switch, and answer the strip's reading at the frame that batch paints beside
 * the reading the page settles on. The host's row takes the room its title's
 * line leaves and starts at its own left end; the skin's marks move the plate
 * to the middle of the row.
 */
function switchSession(t, options) {
  return t.page.evaluate(async (args) => {
    const [buildSource, header, tabs, marks, batch, windows, titlebar] = args
    const settle = () => window.__dshSmokeProbe.settle()
    // The host's own row: a line of room at its start and its tabs from there.
    const hostStyle = document.createElement('style')
    hostStyle.textContent = '.probe-switch-row { display: flex; justify-content: flex-start; padding-left: 60px; }'
    document.head.append(hostStyle)
    if (titlebar) document.documentElement.setAttribute(windows, '')

    const make = eval(buildSource)
    const build = () => make(header, tabs, ['Chat', 'Trajectory', 'Context'], { rowClass: 'probe-switch-row', more: true })

    let strip = build()
    document.body.append(strip.slot)
    await settle()

    const read = () => {
      const box = strip.list.getBoundingClientRect()
      return {
        strip: strip.row.hasAttribute(marks.strip),
        titlebar: strip.slot.hasAttribute(marks.titlebar),
        position: getComputedStyle(strip.row).position,
        left: Math.round(box.left),
        width: Math.round(box.width),
      }
    }

    // Every box read from here on. The batch's observer callback runs as a
    // microtask after this task, and the placement must not read the page
    // inside it (#196): the shift is measured on the frame that paints, in its
    // own read phase, so nothing is read between the mount and the frame.
    let boxReads = 0
    const originalRect = Element.prototype.getBoundingClientRect
    // cost: D40 — the bus delivers the batch in a microtask; the frame read phase is where a box is taken.
    Element.prototype.getBoundingClientRect = function () { boxReads += 1; return originalRect.call(this) }

    // The switch: the conversation flow mounts in the same task as the header it
    // brings, which is the batch the bus dispatches after the paint.
    const next = build()
    const sink = document.createElement('div')
    document.body.append(sink)
    strip.slot.remove()
    document.body.insertBefore(next.slot, sink)
    for (let index = 0; index < batch; index++) {
      const line = document.createElement('div')
      line.append(document.createElement('span'), document.createElement('span'), document.createElement('span'))
      sink.append(line)
    }
    const atMount = boxReads
    // Two microtask turns: the observer's callback is queued before the first.
    await new Promise((resolve) => queueMicrotask(() => queueMicrotask(resolve)))
    const inBatchCallback = boxReads - atMount
    strip = next
    const painted = await new Promise((resolve) => requestAnimationFrame(() => resolve(read())))
    await settle()
    const settled = read()

    sink.remove()
    next.slot.remove()
    hostStyle.remove()
    if (titlebar) document.documentElement.removeAttribute(windows)
    await settle()
    // cost: D40 — hands the prototype back to the page once the switch has painted.
    Element.prototype.getBoundingClientRect = originalRect
    return { painted, settled, inBatchCallback }
  }, [BUILD_VIEW_STRIP, HEADER, TABS, { strip: STRIP, titlebar: TITLEBAR }, options.batch, WINDOWS, options.titlebar])
}

export default spec({ page: 'view-tabs-row' }, ({ test }) => {
  test('a strip a session switch mounts is centred in the first frame it paints', async (t) => {
    const { painted, settled, inBatchCallback } = await switchSession(t, { batch: 1500, titlebar: false })
    t.expectThat.equal(painted, settled, 'the frame the switch paints reads as the settled page')
    t.expectThat.equal(painted.strip, true, 'the strip\'s row wears the skin\'s mark in that frame')
    t.expectThat.equal(inBatchCallback, 0, 'the batch\'s own callback reads no box')
  })

  test('under the Windows caption row the strip is in the band in the first frame it paints', async (t) => {
    const { painted, settled } = await switchSession(t, { batch: 2, titlebar: true })
    t.expectThat.equal(painted, settled, 'the frame the switch paints reads as the settled page')
    t.expectThat.equal({ titlebar: painted.titlebar, position: painted.position }, { titlebar: true, position: 'fixed' }, 'the header and the strip are in the caption row in that frame')
  })
})
