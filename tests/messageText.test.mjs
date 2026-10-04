import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse } from '@vue/compiler-sfc'
import { compile } from '@vue/compiler-dom'
import * as Vue from 'vue'
import { renderToString } from '@vue/server-renderer'
import { messageText, highlightText } from '../src/renderer/src/utils/messageText.mjs'
import { aiStateLabels } from '../src/renderer/src/utils/aiMessages.mjs'

async function renderTemplate(filename, state) {
  const source = await readFile(new URL(`../src/renderer/src/views/chat/${filename}`, import.meta.url), 'utf8')
  const { descriptor } = parse(source)
  const { code } = compile(descriptor.template.content, { mode: 'function' })
  const render = new Function('Vue', code)(Vue)
  const app = Vue.createSSRApp({ render, setup: () => ({ aiState: null, aiError: '', aiStopping: false, currentChatSession: {}, ...state }) })
  app.config.warnHandler = () => {}
  return renderToString(app)
}

test('legacy backend text preserves line breaks and decodes only one entity layer', () => {
  assert.equal(messageText('&lt;img&gt;<br>line &quot;x&quot; &amp;lt;'), '<img>\nline "x" &lt;')
  assert.equal(messageText(null), '')
})

test('search treats regex metacharacters as literal text', () => {
  const parts = highlightText('a[ b[ <img>', '[')
  assert.equal(parts.filter((item) => item.match).length, 2)
  assert.equal(parts.map((item) => item.text).join(''), 'a[ b[ <img>')
  assert.deepEqual(highlightText('Hello', 'HE'), [{ text: 'He', match: true }, { text: 'llo', match: false }])
})

test('actual chat template renders raw AI markup and encoded user markup as text', async () => {
  for (const payload of ['<img src=x onerror=alert(1)>', '&lt;img src=x onerror=alert(1)&gt;']) {
    const html = await renderTemplate('ChatMessage.vue', { data: { sendUserId: 'peer', messageType: 14, status: 1, messageContent: payload }, userInfoStore: { getInfo: () => ({ userId: 'self' }) }, messageText })
    assert.doesNotMatch(html, /<img\s+src=x/)
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/)
  }
})

test('actual search template highlights safe text without interpreting HTML', async () => {
  const html = await renderTemplate('SearchResult.vue', { data: { contactId: 'peer', searchContactParts: highlightText('<img src=x>', 'img'), searchLastParts: highlightText('<script>alert(1)</script>', 'alert') } })
  assert.doesNotMatch(html, /<img\s+src=x|<script>/)
  assert.match(html, /class="highlight">img/)
  assert.match(html, /&lt;script&gt;/)
})

test('actual AI template shows cumulative text while generation is pending', async () => {
  const html = await renderTemplate('ChatMessage.vue', { data: { sendUserId: 'robot', messageType: 14, status: 0, messageContent: '已有部分回答' }, userInfoStore: { getInfo: () => ({ userId: 'self' }) }, messageText, aiState: 'streaming', aiStateLabels, aiStopping: false })
  assert.match(html, /已有部分回答/)
  assert.match(html, /停止生成/)
})

test('group message template displays the server sender nickname', async () => {
  const html = await renderTemplate('ChatMessage.vue', { data: { sendUserId: 'peer', sendUserNickName: '群成员昵称', contactType: 1, messageType: 2, status: 1, messageContent: 'hello' }, userInfoStore: { getInfo: () => ({ userId: 'self' }) }, messageText })
  assert.match(html, /群成员昵称/)
})
