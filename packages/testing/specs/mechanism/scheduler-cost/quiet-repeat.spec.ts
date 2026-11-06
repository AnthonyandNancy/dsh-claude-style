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

const settle = () => new Promise(resolve => setTimeout(resolve, 0))

test('a match list reports a version that moves when its set changes, and not before', async () => {
  const root = document.createElement('div')
  document.body.append(root)
  const list = observeMatches<HTMLElement>('[data-test-version]')
  const before = list.version()
  expect(list.version()).toBe(before)
  // A node the selector does not match is no change of the set.
  const other = document.createElement('b')
  root.append(other)
  await settle()
  expect(list.version()).toBe(before)
  const one = document.createElement('i')
  one.setAttribute('data-test-version', '')
  root.append(one)
  await settle()
  expect(list.version()).toBe(before + 1)
  // Reading the same set again moves nothing.
  expect(list.all()).toEqual([one])
  expect(list.version()).toBe(before + 1)
  list.release()
  root.remove()
})
