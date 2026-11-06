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
    // The two readings differ by the card's own open state alone: a closed card
    // keeps its box and paints nothing, an open one keeps the blur it always had.
    const visible = await t.read.computed(card, 'visibility')
    t.expectThat.equal(closed, 'none', 'a card nobody opened paints no blur')
    t.expectThat.equal(/^blur\(16px\)/.test(open), true, `an open card keeps its blur (${open})`)
    t.expectThat.equal(visible, 'visible', 'the open card is the one on screen')
  })
})
