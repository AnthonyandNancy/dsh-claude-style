/**
 * A pass with no change since the last one writes nothing and reads no layout;
 * the feature hands back the same answer without walking its list again.
 *
 * @capability scheduler-cost
 * @features engine
 * @risk A pass that runs on every frame walks every card and bubble on a long conversation and the page stutters without anything changing.
 */
import { expect, test } from 'vitest'
import { observeMatches } from '@dsh-claude-style/engine/bus'

test('a match list reports a version that moves only when its set changes', async () => {
  const root = document.createElement('div')
  document.body.append(root)
  const list = observeMatches<HTMLElement>('[data-test-version]')
  const before = list.version()
  expect(list.version()).toBe(before)
  const one = document.createElement('i')
  one.setAttribute('data-test-version', '')
  root.append(one)
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(list.version()).toBe(before + 1)
  expect(list.version()).toBe(before + 1)
  list.release()
  root.remove()
})
