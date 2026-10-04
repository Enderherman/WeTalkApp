import test from 'node:test'
import assert from 'node:assert/strict'
import { removableGroupMembers, createGroupMemberSubmitter } from '../src/renderer/src/utils/groupMembers.mjs'

test('removal excludes the owner by ID regardless of server member order without mutating members', () => {
  const members = [{ userId: 'member', contactName: 'one' }, { userId: 'owner', contactName: 'two' }]
  assert.deepEqual(removableGroupMembers(members, 'owner'), [{ userId: 'member', contactId: 'member', contactName: 'one' }])
  assert.equal(members[0].contactId, undefined)
})

test('member dialog remains pending until backend acknowledgement and prevents duplicate submission', async () => {
  let release, success = 0, requests = 0
  const gate = new Promise((resolve) => { release = resolve })
  const state = { saving: false, error: '' }
  const submit = createGroupMemberSubmitter({ state, request: async (request) => { requests++; assert.equal(request.params.selectContacts, 'Uone,Utwo'); await gate; return { code: 200 } }, onSuccess: () => success++ })
  const form = { groupId: 'Ggroup', opType: 0, selectContacts: ['Uone', 'Utwo', 'Uone'] }
  const pending = submit(form)
  assert.equal(state.saving, true)
  assert.equal(success, 0)
  assert.equal(await submit(form), false)
  release(); await pending
  assert.equal(requests, 1)
  assert.equal(success, 1)
  assert.equal(state.saving, false)
})

test('failed member changes preserve selected contacts and do not close the dialog', async () => {
  const state = { saving: false, error: '' }, form = { groupId: 'Ggroup', opType: 1, selectContacts: ['Uone'] }
  const submit = createGroupMemberSubmitter({ state, request: async () => null, onSuccess: () => { throw new Error('must not close') } })
  assert.equal(await submit(form), false)
  assert.deepEqual(form.selectContacts, ['Uone'])
  assert.match(state.error, /失败/)
})
