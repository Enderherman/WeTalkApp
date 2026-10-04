import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Module from 'node:module'
import { parse, compileScript } from '@vue/compiler-sfc'
import { build } from 'esbuild'
import * as Vue from 'vue'

let nextHarness = 0
export async function mountSfc(relativePath, context, mocks = {}, components = {}) {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const filename = path.join(root, 'src/renderer/src', relativePath)
  const key = `__wetalkSfc${++nextHarness}`
  globalThis[key] = context
  const { descriptor } = parse(await readFile(filename, 'utf8'), { filename })
  const script = compileScript(descriptor, { id: key, inlineTemplate: true })
  const output = await build({
    stdin: { contents: script.content, resolveDir: path.dirname(filename), sourcefile: filename + '.js' },
    bundle: true, write: false, platform: 'node', format: 'cjs', external: ['vue'],
    define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'sfc-harness', setup(builder) {
      builder.onResolve({ filter: /^@\// }, (args) => mocks[args.path]
        ? { path: args.path, namespace: 'mock' }
        : { path: path.join(root, 'src/renderer/src', args.path.slice(2)) + (path.extname(args.path) ? '' : '.js') })
      builder.onResolve({ filter: /^vue$/ }, () => ({ path: 'vue', external: true }))
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path: name }) => ({ contents: `const context = globalThis[${JSON.stringify(key)}]; ${mocks[name]}` }))
    } }],
  })
  const compiled = new Module(path.join(root, 'tests', 'sfc-harness.cjs'))
  compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(output.outputFiles[0].text, compiled.id)
  const host = () => ({ tag: 'root', children: [], props: {}, parent: null })
  const remove = (node) => { const list = node.parent?.children; if (list) { const index = list.indexOf(node); if (index >= 0) list.splice(index, 1) } node.parent = null }
  const renderer = Vue.createRenderer({
    createElement: (tag) => ({ ...host(), tag }),
    createText: (text) => ({ ...host(), tag: '#text', text }),
    createComment: (text) => ({ ...host(), tag: '#comment', text }),
    setText: (node, text) => { node.text = text },
    setElementText: (node, text) => { node.children = []; node.text = text },
    patchProp: (node, name, previous, value) => { node.props[name] = value },
    insert: (node, parent, anchor) => { remove(node); const index = anchor ? parent.children.indexOf(anchor) : -1; if (index < 0) parent.children.push(node); else parent.children.splice(index, 0, node); node.parent = parent },
    remove,
    parentNode: (node) => node.parent,
    nextSibling: (node) => { const list = node.parent?.children || []; return list[list.indexOf(node) + 1] || null },
    querySelector: () => null,
  })
  const app = renderer.createApp(compiled.exports.default)
  const warnings = []
  app.config.warnHandler = (message) => warnings.push(message)
  app.directive('infinite-scroll', {})
  for (const name of ['ContentPanel', 'Avatar', 'el-input', 'el-button', 'el-dropdown', 'el-dropdown-item', 'el-dropdown-menu', 'el-image']) {
    app.component(name, Vue.defineComponent({ inheritAttrs: false, setup(_, { slots, attrs }) { return () => Vue.h(name, attrs, Object.values(slots).flatMap((slot) => slot?.() || [])) } }))
  }
  for (const [name, component] of Object.entries(components)) app.component(name, component)
  const tree = host()
  app.mount(tree)
  const nodes = () => { const found = []; const walk = (node) => { found.push(node); node.children.forEach(walk) }; walk(tree); return found }
  const text = (node) => (node.tag === '#comment' ? '' : node.text || '') + node.children.map(text).join('')
  const flush = async () => { await new Promise((resolve) => setImmediate(resolve)); await Vue.nextTick() }
  await flush()
  return { tree, nodes, text, flush, warnings, unmount() { app.unmount(); delete globalThis[key] } }
}
