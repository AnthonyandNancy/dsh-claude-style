/**
 * The page's visibility at the browser's boundary, for the behaviour specs that
 * judge what a page off screen does (D40). A headless window is never hidden, so
 * the answer the page reads and the event it hears stand in for the move.
 */

/**
 * Report the page off screen, then back.
 *
 * The property is deleted rather than restored, so the return leaves the
 * browser's own answer in place.
 */
export async function reportPage(t, offScreen) {
  await t.page.evaluate((off) => {
    if (off) Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    else delete document.visibilityState
    document.dispatchEvent(new Event('visibilitychange'))
  }, offScreen)
  await t.settle()
}
