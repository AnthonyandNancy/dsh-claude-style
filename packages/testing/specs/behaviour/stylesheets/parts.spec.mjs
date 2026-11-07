/**
 * The skin's rules arrive in the parts the page needs and keep the cascade they
 * had as one sheet: the parts stand in the build's order, a conversation page
 * carries no active settings or home rules, and an opened card brings its own.
 *
 * @capability stylesheets
 * @features core
 * @risk Every page parses and matches settings, home and popover rules, so a
 *       scroll over the conversation pays for surfaces that are not drawn.
 */
import { spec, surface } from '../../fixtures/behaviour.mjs'
import { SHEET_TAGS, readActiveSheetGroups } from '../../fixtures/stylesheet.mjs'

const GROUP = surface.attribute('stylesheets.sheet')
const SHEET = SHEET_TAGS

export default spec({ page: 'desktop' }, ({ test }) => {
  test('the sheet is mounted as ordered parts, and a conversation page carries no settings or home rules', async (t) => {
    const reading = await t.page.evaluate(([selector, group]) => {
      const sheets = [...document.querySelectorAll(selector)]
      return {
        count: sheets.length,
        groups: sheets.map((sheet) => sheet.getAttribute(group)),
        filled: sheets.filter((sheet) => (sheet.textContent ?? '').trim() !== '').map((sheet) => sheet.getAttribute(group)),
        rules: sheets.reduce((sum, sheet) => sum + (sheet.sheet?.cssRules.length ?? 0), 0),
      }
    }, [SHEET, GROUP])
    t.expectThat.equal(reading.count, 7, 'every build group has its ordered placeholder')
    t.expectThat.equal(reading.groups, ['base', 'conversation', 'composer', 'sidebar', 'settings', 'home', 'popover'], 'the placeholders stand in the build order')
    t.expectThat.equal(reading.filled.includes('base'), true, `the base part is filled (${reading.filled.join(', ')})`)
    t.expectThat.equal(reading.filled.includes('conversation'), true, 'the conversation part is filled')
    t.expectThat.equal(reading.filled.includes('sidebar'), true, 'the sidebar part is filled')
    t.expectThat.equal(reading.filled.includes('settings'), false, `no settings rules on the conversation page (${reading.filled.join(', ')})`)
    t.expectThat.equal(reading.filled.includes('home'), false, 'no home rules on the conversation page')
    t.expectThat.equal(reading.rules > 0, true, `the filled parts carry rules (${reading.rules})`)
  })
})
