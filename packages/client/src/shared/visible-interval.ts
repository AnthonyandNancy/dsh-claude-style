import { pageHidden, subscribePageHidden } from '../core/page-visibility'

/**
 * An interval that stands still while the page is off screen (D40): a preview
 * ticking for nobody costs a frame a reader never sees, and the return starts
 * the same period again.
 *
 * @param tick - what one period does.
 * @param period - the interval in milliseconds.
 * @returns the stop that clears the interval and the visibility listener.
 */
export function visibleInterval(tick: () => void, period: number) {
  let timer: number | null = null
  const start = () => {
    if (timer !== null || pageHidden()) return
    timer = window.setInterval(tick, period)
  }
  const stop = () => {
    if (timer !== null) window.clearInterval(timer)
    timer = null
  }
  start()
  const stopVisibility = subscribePageHidden(hidden => {
    if (hidden) stop()
    else start()
  })
  return () => {
    stop()
    stopVisibility()
  }
}
