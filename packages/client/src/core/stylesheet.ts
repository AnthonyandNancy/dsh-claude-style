import { UNTAGGED_SHEET_SELECTOR } from '@dsh-claude-style/contracts/dom'
import { INITIAL_STYLE_GROUPS, clearStylesheetGroups, mountStylesheet as mountSheet, parkForeignSheets as parkSheets, updateStylesheetGroups } from '@dsh-claude-style/engine/stylesheet'
import type { StyleGroup } from '@dsh-claude-style/engine/stylesheet'
import { STYLESHEET_PARTS } from 'virtual:dsh-claude-style/generated'
import { FOREIGN_SHEET_TAG, PACKAGE_NAME, STYLE_ID, STYLE_PLUGIN_CSS } from '../constants'

/**
 * This package's sheets, named for the engine that mounts them (D9, D73): the
 * mechanism lives in packages/engine/src/stylesheet.ts, and the ids, the plugin
 * name and the built sheet are this package's own.
 */

/**
 * Park a sibling's untagged stylesheet so no package's bookkeeping can take it.
 *
 * Two moments call this, because a sweep never waits for the skin: the module
 * scope of packages/client/src/entry.ts, the only code of ours that runs before
 * the sweep of our own materialization, and the head watch, which sees a sheet
 * arriving after it.
 */
export function parkForeignSheets() {
  parkSheets(UNTAGGED_SHEET_SELECTOR, STYLE_ID, FOREIGN_SHEET_TAG)
}

/**
 * Mount one of the skin's stylesheets, once per generation: the theme's own by
 * default, or the surface sheets under their own id (D74). The theme arrives in
 * ordered parts; a surface sheet stays whole.
 *
 * @param id - the `<style>` element's id.
 * @param text - a whole sheet; left out for the theme, whose parts carry it.
 * @param pluginCss - the sheet's key in the client module system's bookkeeping.
 * @returns this generation's stop function.
 */
export function mountStylesheet(id = STYLE_ID, text?: string, pluginCss = STYLE_PLUGIN_CSS) {
  if (text === undefined && id === STYLE_ID) {
    return mountSheet({ id, packageName: PACKAGE_NAME, pluginCss, parts: STYLESHEET_PARTS })
  }
  if (text === undefined) throw new Error(`stylesheet: "${id}" was mounted with neither text nor parts`)
  return mountSheet({ id, text, packageName: PACKAGE_NAME, pluginCss })
}

/**
 * The groups the page draws now. The shell's four are always there; settings,
 * home and popover join while their page or surface is drawn.
 */
/** The attribute each mounted part carries its group under (surface entry stylesheets.sheet). */
export const STYLE_GROUP_ATTRIBUTE = 'data-dsh-claude-sheet'

const activeGroups = new Set<StyleGroup>(INITIAL_STYLE_GROUPS)

/**
 * The open surfaces sharing the popover part: several cards can be up at once.
 * Each holder is its own token, so a close→open before the exit fade ends
 * cancels that holder's pending release rather than letting it take the part
 * out from under the reopened card.
 */
const popoverHolders = new Set<symbol>()
/** Each holder's pending release, by its token. */
const popoverReleases = new Map<symbol, number>()

/** Add groups the page or a surface just brought in, before it paints. */
export function addStylesheetGroups(groups: readonly StyleGroup[]) {
  let changed = false
  for (const group of groups) {
    if (activeGroups.has(group)) continue
    activeGroups.add(group)
    changed = true
  }
  if (changed) updateStylesheetGroups(STYLE_ID, activeGroups, STYLESHEET_PARTS)
}

/** Remove groups a page or surface took away; the shell's four always stay. */
export function removeStylesheetGroups(groups: readonly StyleGroup[]) {
  let changed = false
  for (const group of groups) {
    if (!activeGroups.has(group) || group === 'base' || group === 'conversation' || group === 'sidebar') continue
    activeGroups.delete(group)
    changed = true
  }
  if (changed) updateStylesheetGroups(STYLE_ID, activeGroups, STYLESHEET_PARTS)
}

/**
 * A card opened: the popover part enters before its first painted frame. The
 * card's own feature holds one token per open and releases that same token.
 *
 * @returns the token this card holds.
 */
export function holdPopoverStylesheet() {
  const token = Symbol('popover')
  popoverHolders.add(token)
  addStylesheetGroups(['popover'])
  return token
}

/**
 * A card closed: the part stays while another card is open. A holder yet to
 * close may ask its release to wait for the exit fade.
 *
 * @param token - the token `holdPopoverStylesheet()` answered for this card.
 * @param afterMs - wait this long before the part leaves, for the closing fade.
 *     A later release of the same token replaces that wait.
 */
export function releasePopoverStylesheet(token: symbol, afterMs = 0) {
  const pending = popoverReleases.get(token)
  if (pending !== undefined) window.clearTimeout(pending)
  const drop = () => {
    popoverReleases.delete(token)
    if (!popoverHolders.delete(token)) return
    if (popoverHolders.size > 0) return
    removeStylesheetGroups(['popover'])
  }
  if (afterMs > 0) popoverReleases.set(token, window.setTimeout(drop, afterMs))
  else drop()
}

/** Write the browser half's groups into the tags the mount just made. */
export function syncStylesheetGroups() {
  updateStylesheetGroups(STYLE_ID, activeGroups, STYLESHEET_PARTS)
}

/** The generation ended: the next one starts with the shell's four again. */
export function resetStylesheetGroups() {
  activeGroups.clear()
  for (const group of INITIAL_STYLE_GROUPS) activeGroups.add(group)
  for (const timer of popoverReleases.values()) window.clearTimeout(timer)
  popoverReleases.clear()
  popoverHolders.clear()
  clearStylesheetGroups(STYLE_ID)
}
