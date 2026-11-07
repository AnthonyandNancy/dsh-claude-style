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
import { BUILD_VIEW_STRIP, HEADER_SLOT, TAB_LIST, WINDOWS_TITLEBAR } from '../../fixtures/view-tabs-strip.mjs'

const HEADER = HEADER_SLOT
const TABS = TAB_LIST
const WINDOWS = WINDOWS_TITLEBAR
const STRIP = surface.attribute('view-tabs.strip')
const PILL = surface.attribute('view-tabs.pill')

export default spec({ page: 'view-tabs-row' }, ({ test }) => {
  test('the Windows caption row reads only the boxes the pill needs', async (t) => {
    const reading = await t.page.evaluate(async ([buildSource, headerAttrs, tabsAttrs, windows, strip, pillAttribute]) => {
      const settle = () => window.__dshSmokeProbe.settle()
      const build = eval(buildSource)
      const { slot } = build(headerAttrs, tabsAttrs, ['Chat', 'Trajectory'])
      document.body.append(slot)
      document.documentElement.setAttribute(windows, '')
      await settle()
      const marked = document.querySelector(`[${strip}]`)
      if (marked === null) throw new Error('view-tabs: the page carries no strip')
      const pill = document.querySelector(`[${pillAttribute}]`)
      if (pill === null) throw new Error('view-tabs: the page carries no pill')
      let stripReads = 0
      let pillReads = 0
      const original = Element.prototype.getBoundingClientRect
      // cost: D40 — every box the titlebar read makes is counted here for the acceptance reading.
      Element.prototype.getBoundingClientRect = function () {
        if (this === marked || (marked.contains(this) && !pill.contains(this) && this !== pill)) stripReads += 1
        if (this === pill || pill.contains(this)) pillReads += 1
        return original.call(this)
      }
      try {
        window.dispatchEvent(new Event('resize'))
        await settle()
        return { stripReads, pillReads }
      } finally {
        // cost: D40 — the page's prototype goes back after the counted resize.
        Element.prototype.getBoundingClientRect = original
        document.documentElement.removeAttribute(windows)
        slot.remove()
      }
    }, [BUILD_VIEW_STRIP, HEADER, TABS, WINDOWS, STRIP, PILL])
    // Under the caption row the strip is fixed by the stylesheet; only the
    // pill's placement inside the tablist still needs boxes.
    t.expectThat.equal(reading.stripReads, 0, 'the caption row reads no shift box')
    t.expectThat.equal(reading.pillReads > 0, true, `the pill is measured (${reading.pillReads})`)
  })
})
