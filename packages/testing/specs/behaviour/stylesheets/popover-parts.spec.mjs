/**
 * A skin card opened on the page draws from the mounted sheet, and closing it
 * leaves the shared closed base in place: the card stays hidden rather than
 * falling back to the host's own look. The mounted parts keep their build order
 * through both states.
 *
 * @capability stylesheets
 * @features core, model, shared
 * @risk A closed card loses the skin's hidden base with its sheet's rules, or
 *       opening one never brings a drawn box the reader can see.
 */
import { spec, surface } from '../../fixtures/behaviour.mjs'
import { readActiveSheetGroups } from '../../fixtures/stylesheet.mjs'

const GROUP = surface.attribute('stylesheets.sheet')
const CARD = surface('popover.card')
const OPEN = surface.attribute('popover.open')
const TRIGGER = surface('model.trigger')

export default spec({ page: 'model-meter' }, ({ test }) => {
  test('opening the model picker draws its card and keeps every mounted part in place', async (t) => {
    const before = await readActiveSheetGroups(t, GROUP)
    await t.page.locator(TRIGGER).first().click()
    await t.settle()
    const after = await readActiveSheetGroups(t, GROUP)
    t.expectThat.equal(after, before, 'opening a card moves no mounted part')
    const box = await t.read.box(CARD)
    t.expectThat.visible(box, 'the opened card keeps its drawn box')
    // Close through Escape, the card's own dismiss route, and wait past the
    // closing fade: the base part must still make the closed card invisible.
    await t.page.keyboard.press('Escape')
    await t.page.waitForTimeout(500)
    const closed = await t.page.evaluate(([card, open]) => {
      const node = document.querySelector(card)
      if (node === null) return null
      const style = getComputedStyle(node)
      return { open: node.getAttribute(open), visibility: style.visibility, opacity: style.opacity }
    }, [CARD, OPEN])
    t.expectThat.equal(closed?.open, 'false', 'the card is marked closed')
    t.expectThat.equal(closed?.visibility, 'hidden', 'a closed card keeps the hidden base')
    t.expectThat.equal(closed?.opacity, '0', 'a closed card keeps no paint')
  })
})
