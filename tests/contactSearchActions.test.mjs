import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mountSfc } from './helpers/mountSfc.mjs'
const { createMemoryHistory, createRouter } = createRequire(import.meta.url)('vue-router')

for (const result of [
  { contactId: 'Ufriend', contactType: 'USER', status: 1, nickName: 'Friend' },
  { contactId: 'Gjoined', contactType: 'GROUP', status: 1, nickName: 'Joined group' },
]) test(`the rendered search action opens the existing ${result.contactType} conversation without creating a message`, async () => {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/contact/search', component: { render: () => null } },
    { path: '/chat', component: { render: () => null } },
  ] })
  await router.push('/contact/search'); await router.isReady()
  const requests = []
  const context = {
    plugins: [router],
    userStore: { getInfo: () => ({ userId: 'Uself' }) },
    request: async (config) => { requests.push(config); assert.equal(config.url, '/contact/searchByKeyword'); return { code: 200, data: [result] } },
  }
  const mounted = await mountSfc('views/contact/Search.vue', context, {
    '@/utils/Request': 'export default context.request',
    '@/plugin/Message': 'export default { warning() {} }',
    '@/stores/UserInfoStore': 'export const useUserInfoStore = () => context.userStore',
    '@/components/UserBaseInfo.vue': "import { h } from 'vue'; export default { inheritAttrs: false, setup: () => () => h('user-info') }",
    '@/views/contact/SearchAdd.vue': "import { h } from 'vue'; export default { setup(_, { expose }) { expose({ show() {} }); return () => h('search-add') } }",
  })
  try {
    const input = mounted.nodes().find((node) => node.tag === 'el-input')
    input.props['onUpdate:modelValue'](result.contactId)
    const search = mounted.nodes().find((node) => String(node.props.class || '').includes('search-btn'))
    await search.props.onClick()
    await mounted.flush()
    const send = mounted.nodes().find((node) => node.tag === 'el-button' && mounted.text(node).trim() === '发送消息')
    assert.ok(send, 'An existing friend/group exposes the send-message action')
    assert.equal(typeof send.props.onClick, 'function', 'The visible action has a live handler')
    await send.props.onClick()
    await mounted.flush()
    assert.equal(router.currentRoute.value.path, '/chat')
    assert.equal(router.currentRoute.value.query.chatId, result.contactId)
    assert.ok(Number(router.currentRoute.value.query.timestamp) > 0)
    assert.equal(requests.length, 1, 'Navigation does not send a placeholder message or create a fake session')
    assert.equal(mounted.warnings.some((warning) => warning.includes('sendMessage')), false)
  } finally { mounted.unmount() }
})
