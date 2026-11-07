/**
 * Mounting a plugin's own sheets, and keeping a sibling's out of the client
 * module system's bookkeeping (D9).
 *
 * The mechanism knows nothing of the skin it serves: which sheet is mounted
 * under which id, and which tag parks a sibling's, is handed in with each call.
 * A sheet may arrive in ordered parts: each part keeps its own tag, and a page
 * fills or clears a part in place, so the cascade never moves.
 */

/** The generation whose copy of each sheet is mounted, by the sheet's element id. */
const mountedGenerations = new Map<string, number>()
/** The last generation handed out, across the sheets. */
let lastGeneration = 0

/** The page or surface a part serves. */
export type StyleGroup = 'base' | 'conversation' | 'composer' | 'sidebar' | 'settings' | 'home' | 'popover'

/** The groups every conversation page draws before any surface opens: the shell, the column and its composer. */
export const INITIAL_STYLE_GROUPS: readonly StyleGroup[] = ['base', 'conversation', 'composer', 'sidebar']

/** One part of a stylesheet, in cascade order. */
export interface SheetPart {
  group: StyleGroup
  text: string
}

/** One sheet, as the package that owns it mounts it. */
export interface SheetRequest {
  /** The `<style>` element's id. */
  id: string
  /** The sheet's text; left out when `parts` carries it. */
  text?: string
  /** The package's own name, as its bookkeeping spells it. */
  packageName: string
  /** The sheet's key in the client module system's bookkeeping. */
  pluginCss: string
  /** The sheet in ordered parts; left out, the sheet mounts whole. */
  parts?: readonly SheetPart[]
}

/** The groups each mounted sheet currently fills. */
const filledGroups = new Map<string, Set<StyleGroup>>()
/** Each mounted sheet's tags, by group, in the build's order. */
const mountedParts = new Map<string, Map<StyleGroup, HTMLStyleElement>>()

/**
 * Park a sibling's untagged stylesheet so no package's bookkeeping can take it.
 *
 * The client module system claims every untagged `<style>` in the document for
 * the package whose factory has just materialized (`claimStyles`, reading
 * `style:not([data-plugin])`), and that package's next reload removes every tag
 * carrying its id (`removeOwnedStyles`). A sibling that mounts its sheet from
 * `apply()` — after its own materialization — leaves it untagged, so the next
 * package to materialize would take it into custody and delete it at that
 * package's next reload, stripping the sibling's rules off a page that keeps
 * running. Every untagged sheet that is not this package's own is therefore
 * parked under a resting tag: the tag carries a slash, can never equal a package
 * name, and matches no removal step, so the sibling keeps its sheet — and its
 * own teardown still removes that sheet by reference when its generation ends.
 *
 * @param untaggedSelector - what an untagged sheet matches.
 * @param styleId - this package's own sheet, which is left alone.
 * @param foreignTag - the resting tag a sibling's sheet is parked under.
 */
export function parkForeignSheets(untaggedSelector: string, styleId: string, foreignTag: string) {
  const untagged = document.querySelectorAll<HTMLStyleElement>(untaggedSelector)
  for (const el of untagged) {
    if (el.id !== styleId) el.dataset.plugin = foreignTag
  }
}

/**
 * Write the groups `active` names into the mounted tags and clear the rest.
 * A tag whose text is already what this call wants is left alone, and no tag
 * moves: the parts stand in the order the build made them.
 */
export function updateStylesheetGroups(id: string, active: ReadonlySet<StyleGroup>, parts: readonly SheetPart[]) {
  const tags = mountedParts.get(id)
  if (tags === undefined) return
  for (const part of parts) {
    const sheet = tags.get(part.group)
    if (sheet === undefined) continue
    const wanted = active.has(part.group) ? part.text : ''
    if (sheet.textContent !== wanted) sheet.textContent = wanted
  }
  filledGroups.set(id, new Set(active))
}

/** Change the filled set of a mounted sheet, then write the tags once if it moved. */
function changeGroups(id: string, parts: readonly SheetPart[], change: (filled: Set<StyleGroup>) => boolean) {
  const filled = filledGroups.get(id)
  if (filled === undefined) return false
  if (!change(filled)) return false
  updateStylesheetGroups(id, filled, parts)
  return true
}

/** Add groups to a mounted sheet; answer whether anything changed. */
export function addStylesheetGroups(id: string, groups: readonly StyleGroup[], parts: readonly SheetPart[]) {
  return changeGroups(id, parts, (filled) => {
    let changed = false
    for (const group of groups) {
      if (filled.has(group)) continue
      filled.add(group)
      changed = true
    }
    return changed
  })
}

/** Remove groups from a mounted sheet, except the three every conversation draws. */
export function removeStylesheetGroups(id: string, groups: readonly StyleGroup[], parts: readonly SheetPart[]) {
  return changeGroups(id, parts, (filled) => {
    let changed = false
    for (const group of groups) {
      if (group === 'base' || group === 'conversation' || group === 'sidebar') continue
      if (filled.delete(group)) changed = true
    }
    return changed
  })
}

/** Forget one generation's parts, so a stale stop never takes a newer sheet away. */
export function clearStylesheetGroups(id: string) {
  filledGroups.delete(id)
  mountedParts.delete(id)
}

/**
 * Mount one of a package's stylesheets, once per generation (D74).
 *
 * The sheet wears the package's own `data-plugin` and its own `data-plugin-css`
 * from the moment it exists — the claim sweep reads untagged tags alone — so no
 * sibling package's bookkeeping can take it, and it is refreshed in place rather
 * than replaced, so a stale generation's stop can never take a newer
 * generation's sheet away (D9).
 *
 * With `parts`, each group gets its own `<style>` in the build's order, and only
 * the initial groups are filled; the browser half fills or clears the others in
 * place as pages and surfaces open.
 *
 * @param request - the sheet, its element id and the package's own names.
 * @returns this generation's stop function: it unmounts the sheet unless a
 *          newer generation mounted after it.
 */
export function mountStylesheet(request: SheetRequest) {
  const { id, text, packageName, pluginCss, parts } = request
  const generation = ++lastGeneration
  if (parts === undefined) {
    if (text === undefined) throw new Error(`stylesheet: "${id}" carries neither text nor parts`)
    mountedGenerations.set(id, generation)
    let sheet = document.getElementById(id)
    if (sheet === null) {
      sheet = document.createElement('style')
      sheet.id = id
      document.head.appendChild(sheet)
    }
    sheet.dataset.plugin = packageName
    sheet.dataset.pluginCss = pluginCss
    sheet.dataset.skinChrome = id
    if (sheet.textContent !== text) sheet.textContent = text
    return () => {
      if (mountedGenerations.get(id) === generation) sheet.remove()
    }
  }

  mountedGenerations.set(id, generation)
  const tags = new Map<StyleGroup, HTMLStyleElement>()
  for (const part of parts) {
    const tagId = `${id}--${part.group}`
    let sheet = document.getElementById(tagId) as HTMLStyleElement | null
    if (sheet === null) {
      sheet = document.createElement('style')
      sheet.id = tagId
      document.head.appendChild(sheet)
    }
    sheet.dataset.plugin = packageName
    sheet.dataset.pluginCss = pluginCss
    sheet.dataset.skinChrome = id
    sheet.setAttribute('data-dsh-claude-sheet', part.group)
    const wanted = INITIAL_STYLE_GROUPS.includes(part.group) ? part.text : ''
    if (sheet.textContent !== wanted) sheet.textContent = wanted
    tags.set(part.group, sheet)
  }
  mountedParts.set(id, tags)
  filledGroups.set(id, new Set(INITIAL_STYLE_GROUPS))
  return () => {
    if (mountedGenerations.get(id) !== generation) return
    for (const sheet of tags.values()) sheet.remove()
    mountedParts.delete(id)
    filledGroups.delete(id)
  }
}
