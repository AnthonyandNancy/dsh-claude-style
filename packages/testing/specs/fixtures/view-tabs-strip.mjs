/**
 * The page-side builder both view-tabs specs inject: the host's own contract
 * attributes, one selected tab, an optional More button and row class. It is a
 * string because it runs inside `page.evaluate`, not in the Node process.
 */
import { host } from './behaviour.mjs'

/** The host's slot, tablist and Windows mark, and the skin's strip mark. */
export const HEADER_SLOT = host.attributes('shell.header-slot')
export const TAB_LIST = host.attributes('header.conversation-tabs')
export const WINDOWS_TITLEBAR = host('shell.windows-titlebar')

export const BUILD_VIEW_STRIP = `(header, tabs, labels, options) => {
  const slot = document.createElement('div')
  for (const [name, value] of header) slot.setAttribute(name, value)
  const row = document.createElement('div')
  if (options && options.rowClass !== undefined) row.className = options.rowClass
  const list = document.createElement('div')
  for (const [name, value] of tabs) list.setAttribute(name, value)
  list.setAttribute('role', 'tablist')
  for (const label of labels) {
    const tab = document.createElement('button')
    tab.type = 'button'
    tab.setAttribute('role', 'tab')
    tab.setAttribute('aria-selected', label === labels[0] ? 'true' : 'false')
    tab.textContent = label
    list.append(tab)
  }
  row.append(list)
  if (options && options.more === true) {
    const more = document.createElement('button')
    more.type = 'button'
    more.textContent = 'More views'
    row.append(more)
  }
  slot.append(row)
  return { slot, row, list }
}`
