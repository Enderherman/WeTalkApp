import test from 'node:test'
import assert from 'node:assert/strict'
import { validateRemark, contactDisplayName, applyContactRemark } from '../src/renderer/src/utils/contactRemark.mjs'

test('remark trims whitespace, supports clearing and rejects more than 40 characters', () => {
  assert.equal(validateRemark('  同事  '), '同事')
  assert.equal(validateRemark('   '), '')
  assert.equal(validateRemark('a'.repeat(40)).length, 40)
  assert.throws(() => validateRemark('a'.repeat(41)), /40/)
})

test('remark change preserves the real contact name and cannot update another contact', () => {
  const contact = { contactId: 'Upeer', contactName: '真实昵称' }
  assert.equal(applyContactRemark(contact, { contactId: 'Uother', remark: '其他' }), false)
  applyContactRemark(contact, { contactId: 'Upeer', remark: '同事' })
  assert.equal(contactDisplayName(contact), '同事')
  assert.equal(contact.contactName, '真实昵称')
  applyContactRemark(contact, { contactId: 'Upeer', remark: '' })
  assert.equal(contactDisplayName(contact), '真实昵称')
})
