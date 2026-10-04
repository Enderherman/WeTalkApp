import test from 'node:test'
import assert from 'node:assert/strict'
import { createContactApplicationPager } from '../src/renderer/src/utils/contactApplicationPaging.mjs'

const initial = () => ({ items: [], pageNo: 0, pageTotal: 1, loading: false, error: '' })
test('application pagination sends the actual page and deduplicates overlapping records', async () => {
  const state = initial(), pages = []
  const pager = createContactApplicationPager({ state, request: async ({ params }) => { pages.push(params.pageNo); return { data: { pageTotal: 2, list: params.pageNo === 1 ? [{ applyId: 1 }] : [{ applyId: 1 }, { applyId: 2 }] } } } })
  await pager.load(); await pager.load(); await pager.load()
  assert.deepEqual(pages, [1, 2])
  assert.deepEqual(state.items.map((item) => item.applyId), [1, 2])
})

test('failed page does not advance pagination and can be retried', async () => {
  const state = initial(), pages = []
  let fail = true
  const pager = createContactApplicationPager({ state, request: async ({ params }) => { pages.push(params.pageNo); return fail ? null : { data: { pageTotal: 1, list: [{ applyId: 1 }] } } } })
  await pager.load()
  assert.equal(state.pageNo, 0)
  assert.ok(state.error)
  fail = false; await pager.load()
  assert.deepEqual(pages, [1, 1])
})

test('refresh replaces the list and ignores an older in-flight response', async () => {
  const state = initial()
  let release, first = true
  const gate = new Promise((resolve) => { release = resolve })
  const pager = createContactApplicationPager({ state, request: async () => { if (first) { first = false; await gate; return { data: { pageTotal: 1, list: [{ applyId: 1 }] } } } return { data: { pageTotal: 1, list: [{ applyId: 2 }] } } } })
  const old = pager.load()
  await pager.reload()
  release(); await old
  assert.deepEqual(state.items, [{ applyId: 2 }])
})
