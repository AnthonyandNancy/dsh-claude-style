/**
 * A skin card opened on the page draws from the mounted sheet, and closing it
 * leaves the shared closed base in place: the card stays hidden rather than
 * falling back to the host's own look. The mounted parts keep their build order
 * through both states, and the opened surface's own rules arrive with the card.
 *
 * @capability stylesheets
 * @features core, model, shared
 * @risk A closed card loses the skin's hidden base with its sheet's rules, or
 *       opening one never brings a drawn box the reader can see.
 */
import { spec, surface } from '../../fixtures/behaviour.mjs'
import { SHEET_TAGS, readActiveSheetGroups } from '../../fixtures/stylesheet.mjs'

const GROUP = surface.attribute('stylesheets.sheet')
const CARD = surface('popover.card')
const OPEN = surface.attribute('popover.open')
const TRIGGER = surface('model.trigger')

export default spec({ page: 'model-meter' }, ({ test }) => {
  test('opening the model picker draws its card and keeps every mounted part in place', async (t) => {
    const before = await readActiveSheetGroups(t, GROUP)
    const trigger = t.page.locator(TRIGGER).first()
    await trigger.click()
    await t.page.waitForFunction((selector) => {
      const button = document.querySelector(selector)
      return button !== null && button.getAttribute('aria-expanded') === 'true'
    }, TRIGGER, { timeout: 10000 })
    const reading = await t.page.evaluate(([cardSelector, open, sheetSelector, group, name]) => {
      const card = [...document.querySelectorAll(cardSelector)].find((node) => node.getAttribute(open) === 'true') ?? null
      const sheet = [...document.querySelectorAll(sheetSelector)].find((node) => node.getAttribute(group) === name) ?? null
      return {
        open: card !== null,
        filled: (sheet?.textContent ?? '').trim() !== '',
      }
    }, [CARD, OPEN, SHEET_TAGS, GROUP, 'popover'])
    const after = await readActiveSheetGroups(t, GROUP)
    t.expectThat.equal(reading.open, true, 'the press opened the card')
    t.expectThat.equal(reading.filled, true, "the opened surface's part stands with the card")
    t.expectThat.equal(after.includes('popover'), true, `the popover part enters with the card (${after.join(', ')})`)
    t.expectThat.equal(after.filter((group) => group !== 'popover'), before, 'every other part keeps its place')
    const box = await t.page.evaluate(([cardSelector, open]) => {
      const card = [...document.querySelectorAll(cardSelector)].find((node) => node.getAttribute(open) === 'true') ?? null
      if (card === null) return null
      const rect = card.getBoundingClientRect()
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
    }, [CARD, OPEN])
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
    t.expectThat.equal(closed?.visibility, 'hidden', 'the base part keeps the closed card hidden')
    t.expectThat.equal(closed?.opacity, '0', 'the base part keeps the closed card paintless')
    t.expectThat.equal((await readActiveSheetGroups(t, GROUP)).includes('popover'), false, 'the popover part leaves after the closing fade')
  })
})
