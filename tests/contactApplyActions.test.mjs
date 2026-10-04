import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSfc } from './helpers/mountSfc.mjs'

test('the actual pending-application menu submits blacklist status 3 after confirmation and refreshes the result', async () => {
  const requests = [], confirmations = []
  let status = 0
  const context = {
    contactStore: { setContactReload() {} },
    countStore: { messageCount: { contactApplyCount: 0 } },
    confirm: (config) => confirmations.push(config),
    request: async (config) => {
      requests.push(config)
      if (config.url === '/contact/loadApply') return { code: 200, data: { pageTotal: 1, list: [{ applyId: 7, applyUserId: 'Upeer', contactType: 0, contactName: 'Peer', status, statusName: status === 3 ? '已拉黑' : '待处理' }] } }
      if (config.url === '/contact/dealWithApply' && config.params.status === 3) { status = 3; return { code: 200 } }
      return null
    },
  }
  const mounted = await mountSfc('views/contact/ContactApply.vue', context, {
    '@/utils/Request': 'export default context.request',
    '@/utils/Confirm': 'export default context.confirm',
    '@/stores/ContactStateStore': 'export const useContactStateStore = () => context.contactStore',
    '@/stores/MessageCountStore': 'export const useMessageCountStore = () => context.countStore',
  })
  try {
    const action = mounted.nodes().find((node) => node.tag === 'el-dropdown-item' && mounted.text(node).trim() === '拉黑')
    assert.ok(action, 'The blacklist action is rendered for a pending application')
    action.props.onClick()
    assert.equal(requests.filter((request) => request.url === '/contact/dealWithApply').length, 0)
    assert.equal(confirmations.length, 1)
    await confirmations[0].okfun()
    await mounted.flush()
    assert.deepEqual(requests.find((request) => request.url === '/contact/dealWithApply').params, { applyId: 7, status: 3 })
    assert.equal(status, 3)
    assert.ok(mounted.text(mounted.tree).includes('已拉黑'))
  } finally { mounted.unmount() }
})
