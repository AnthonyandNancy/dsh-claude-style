/**
 * A feature the first frame does not need arrives in its own chunk, and the
 * page it belongs to paints before that chunk lands.
 *
 * @capability chunks
 * @features header-band, view-tabs
 * @risk A first page waits on scripts for surfaces the reader has not opened and the conversation appears late.
 */
import fs from 'node:fs'
import { spec, surface } from '../../fixtures/behaviour.mjs'

/**
 * The bounds table's values by name, read here because a spec may not import
 * the lane's reader from outside packages/testing/specs/ (D77).
 */
const BOUNDS = new Map(JSON.parse(fs.readFileSync(new URL('../../../data/bounds.json', import.meta.url), 'utf8'))
  .bounds.map(({ name, value }) => [name, value]))

/** One bound by name, refusing a name the table does not carry. */
function bound(name) {
  if (!BOUNDS.has(name)) throw new Error(`bounds: ${name} is not in packages/testing/data/bounds.json`)
  return BOUNDS.get(name)
}

/** The routed chunks the desktop page asks for: one per deferred feature. */
const DEFERRED_CHUNKS = bound('firstPaintDeferredChunks')
/** The part attribute the parts walk writes on the host's own elements. */
const PART = surface.attribute('skin.part')

export default spec({ page: 'desktop' }, ({ test }) => {
  test('the shell paints and the deferred chunks were requested', async (t) => {
    const reading = await t.page.evaluate((part) => ({
      // The routed feature chunks are the classic scripts under the asset route;
      // the bundle's own url is not one of them. The pathname drops any query
      // string, and the set counts a chunk once however often the page reports it.
      chunks: new Set(performance.getEntriesByType('resource')
        .map((entry) => new URL(entry.name).pathname)
        .filter((path) => path.includes('/dsh-claude-style/assets/') && path.endsWith('.js'))).size,
      painted: document.body.checkVisibility({ visibilityProperty: true, opacityProperty: true }),
      content: document.querySelectorAll(`[${part}]`).length,
    }), PART)
    t.expectThat.equal(reading.content > 0, true, 'the shell carries the skin\'s own marks')
    t.expectThat.equal(reading.chunks >= DEFERRED_CHUNKS, true, `the deferred chunks were requested (${reading.chunks} of at least ${DEFERRED_CHUNKS})`)
    t.expectThat.equal(reading.painted, true, 'the body paints')
  })
})
