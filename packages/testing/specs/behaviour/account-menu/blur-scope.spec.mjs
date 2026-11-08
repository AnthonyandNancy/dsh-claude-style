/**
 * A closed card carries no backdrop filter, so the compositor keeps no blurred
 * layer for a surface nobody sees; an open one keeps the same blur it had.
 *
 * @capability account-menu
 * @features shared
 * @risk Every closed menu card keeps a full-window blur layer alive and scrolling the conversation drops frames on an integrated GPU.
 */
import { spec, surface } from '../../fixtures/behaviour.mjs'

const CARD = surface('popover.card')
const OPEN = surface.attribute('popover.open')
const TRIGGER = surface('model.trigger')

/** The open card's own computed value; the closed copies behind it are not the surface. */
function cardValue(t, property, wanted) {
  return t.page.evaluate(([selector, open, name, wanted]) => {
    const node = [...document.querySelectorAll(selector)].find((candidate) => candidate.getAttribute(open) === wanted)
    return node === undefined ? null : getComputedStyle(node).getPropertyValue(name)
  }, [CARD, OPEN, property, wanted])
}

export default spec({ page: 'model-meter' }, ({ test }) => {
  test('a closed card carries no backdrop filter and an open one does', async (t) => {
    await t.prefs({ palette: 'host' })
    // Open through the trigger the reader presses: the held surface's part
    // arrives with the card, which is the state the blur belongs to.
    const trigger = t.page.locator(TRIGGER).first()
    await trigger.click()
    await t.page.waitForFunction(([selector, open]) => [...document.querySelectorAll(selector)]
      .some((card) => card.getAttribute(open) === 'true'), [CARD, OPEN], { timeout: 10000 })
    const open = await cardValue(t, 'backdrop-filter', 'true')
    const visible = await cardValue(t, 'visibility', 'true')
    // Close through the card's own dismiss route and wait past the closing fade
    // and the delayed part release: the base part stays, without the blur.
    await t.page.keyboard.press('Escape')
    await t.page.waitForTimeout(500)
    const closed = await cardValue(t, 'backdrop-filter', 'false')
    t.expectThat.equal(/^blur\(16px\)/.test(open), true, `an open card keeps its blur (${open})`)
    t.expectThat.equal(visible, 'visible', 'the open card is the one on screen')
    t.expectThat.equal(closed, 'none', 'a closed card paints no blur after the part leaves')
  })
})
