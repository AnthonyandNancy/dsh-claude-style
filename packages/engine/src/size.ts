/**
 * A size observer entry, read as the one number a caller compares: the
 * border-box width where the browser offers it, and the content rect otherwise.
 * Several readers of a box need that answer the same way (D40), so it is read
 * here rather than spelled again where a subscription is made.
 */

/** The inline size an observed element reports, in its own pixels. */
export function entryInlineSize(entry: ResizeObserverEntry | undefined) {
  if (entry === undefined) return 0
  const size = entry.borderBoxSize
  return size !== undefined && size.length > 0 ? size[0].inlineSize : entry.contentRect.width
}
