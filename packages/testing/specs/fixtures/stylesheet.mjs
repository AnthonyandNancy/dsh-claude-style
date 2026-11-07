/**
 * The stylesheet parts a behaviour spec reads: the group attribute comes from
 * the surface table, and only a part carrying rules counts as active.
 */
import { loadModule } from '../../../../scripts/shared/ts-module.mjs'

const { STYLE_PLUGIN_CSS } = loadModule('packages/client/src/constants.ts')

export const SHEET_TAGS = `style[data-plugin-css="${STYLE_PLUGIN_CSS}"]`

export function readActiveSheetGroups(t, group) {
  return t.page.evaluate(([selector, name]) => [...document.querySelectorAll(selector)]
    .filter((sheet) => (sheet.textContent ?? '').trim() !== '')
    .map((sheet) => sheet.getAttribute(name)), [SHEET_TAGS, group])
}
