/**
 * A closed card carries no backdrop filter, so the compositor keeps no blurred
 * layer for a surface nobody sees; an open one keeps the same blur it had.
 *
 * @capability account-menu
 * @features shared
 * @risk Every closed menu card keeps a full-window blur layer alive and scrolling the conversation drops frames on an integrated GPU.
 */
import { spec, surface } from '../../fixtures/behaviour.mjs'

export default spec({ page: 'host-palette' }, ({ test }) => {
  test('a closed card carries no backdrop filter and an open one does', async (t) => {
    await t.prefs({ palette: 'host' })
    const card = surface('popover.card')
    const openAttribute = surface.attribute('popover.open')
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
