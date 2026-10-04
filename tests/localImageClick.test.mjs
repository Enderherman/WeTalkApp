import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSfc } from './helpers/mountSfc.mjs'

function clickWithBubbling(node) {
  const event = { stopped: false, stopPropagation() { this.stopped = true } }
  for (let target = node; target && !event.stopped; target = target.parent) {
    for (const handler of [target.props?.onClick].flat().filter((value) => typeof value === 'function')) handler(event)
  }
}

test('local image keeps a parent-provided chat preview click without an undefined handler warning', async () => {
  let previews = 0
  const mounted = await mountSfc('components/ShowLocalImage.vue', { props: { fileId: 7, partType: 'chat', onClick: () => previews++ } }, {
    '@/stores/GlobalInfoStore': 'export const useGlobalInfoStore = () => ({ getInfo: () => 12345 })',
  })
  try {
    clickWithBubbling(mounted.nodes().find((node) => node.props.class === 'image-panel'))
    assert.equal(previews, 1)
    assert.equal(mounted.warnings.some((warning) => warning.includes('showImageHander')), false)
  } finally { mounted.unmount() }
})

test('an avatar thumbnail click still bubbles to the real outer avatar preview action', async () => {
  const image = await mountSfc('components/ShowLocalImage.vue', {}, {
    '@/stores/GlobalInfoStore': 'export const useGlobalInfoStore = () => ({ getInfo: () => 12345 })',
  })
  const childComponent = image.component
  image.unmount()
  const calls = [], previousWindow = globalThis.window
  globalThis.window = { ipcRenderer: { send: (...args) => calls.push(args) } }
  const mounted = await mountSfc('components/AvatarBase.vue', { props: { userId: 'Uavatar', showDetail: true } }, {
    '@/stores/AvatarUploadStore': 'export const useAvatarInfoStore = () => ({ getForceReload: () => false, setForceReload() {} })',
  }, { ShowLocalImage: childComponent })
  try {
    clickWithBubbling(mounted.nodes().find((node) => node.props.class === 'image-panel'))
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], 'newWindow')
    assert.equal(calls[0][1].path, '/showMedia')
    assert.equal(calls[0][1].data.fileList[0].fileId, 'Uavatar')
  } finally { mounted.unmount(); globalThis.window = previousWindow }
})
