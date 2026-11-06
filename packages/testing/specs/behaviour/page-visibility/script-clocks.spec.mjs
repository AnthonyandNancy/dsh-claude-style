/**
 * A page off screen runs no skin clock: no timer of the skin's asks for a frame
 * while nobody is looking, and the page answers a change again once it comes
 * back. The clocks themselves — the waiting line's poll, the usage panel's poll
 * and the scheduler's minute timer — stop and restart through the same answer
 * this reads; each one's own spec reaches it where its page mounts it.
 *
 * @capability page-visibility
 * @features chat-wait, home
 * @risk A window left in the background keeps polling and frames up, and coming back to it stalls while the queued work catches up.
 */
import { spec } from '../../fixtures/behaviour.mjs'
import { reportPage } from '../../fixtures/page-visibility.mjs'

export default spec({ page: 'context-stats' }, ({ test }) => {
  test('the skin asks for no frame while the page is off screen', async (t) => {
    await t.page.evaluate(() => {
      window.__frames = 0
      const raf = window.requestAnimationFrame.bind(window)
      window.requestAnimationFrame = (callback) => { window.__frames += 1; return raf(callback) }
    })
    await reportPage(t, true)
    // A pass already in flight when the page left finishes first; the window
    // that follows is the one a clock of the skin's own would keep waking.
    await t.page.waitForTimeout(400)
    const before = await t.page.evaluate(() => window.__frames)
    await t.page.waitForTimeout(1200)
    const after = await t.page.evaluate(() => window.__frames)
    t.expectThat.equal(after - before, 0, 'the page asked for no frame while off screen')
    await reportPage(t, false)
    // The return has to leave the page answering: a clock stopped for good, or
    // an observation the round trip took down, would pass every reading above.
    await t.page.evaluate(() => {
      window.__frames = 0
      document.body.appendChild(document.createElement('hr'))
    })
    await t.settle()
    t.expectThat.equal((await t.page.evaluate(() => window.__frames)) > 0, true, 'the page asks for a frame again after the return')
  })
})
