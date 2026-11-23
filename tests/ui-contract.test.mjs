import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

test('官方 solid-glass.css 保持原版材质规则，无 AppleMusicUI 遗留变量', () => {
  const css = read('src/styles/solid-glass.css')
  assert.match(css, /Solid Glass: a theme for shadcn\/ui/)
  assert.match(css, /@custom-variant dark \(&:is\(\.dark \*\)\);/)
  assert.match(css, /--background:\s*oklch\(0\.925 0\.007 265\);/)
  assert.match(css, /--background:\s*oklch\(0\.16 0 0\);/)
  assert.match(css, /\.glass-panel/)
  assert.match(css, /\.glass-control/)
  assert.match(css, /\.glass-chosen/)

  for (const legacy of ['--nav-bg', '--player-bg', '--accent-blue', '--transport', '.songlist', '.song-row', '.btn-pill']) {
    assert.ok(!css.includes(legacy), `solid-glass.css 不应包含遗留符号：${legacy}`)
  }
})

test('index.css 按官方顺序导入 Tailwind、tw-animate-css、shadcn 与 solid-glass.css', () => {
  const indexCss = read('src/styles/index.css')
  const tw = indexCss.indexOf('@import "tailwindcss";')
  const anim = indexCss.indexOf('@import "tw-animate-css";')
  const shadcn = indexCss.indexOf('@import "shadcn/tailwind.css";')
  const sg = indexCss.indexOf('@import "./solid-glass.css";')
  assert.ok(tw >= 0 && anim > tw && shadcn > anim && sg > shadcn, 'CSS 导入顺序必须符合官方规范')
})

test('HTML 入口与 dist 构建产物符合 MV3 CSP 且无内联脚本', () => {
  for (const htmlFile of ['sidepanel.html', 'options.html']) {
    const html = read(htmlFile)
    assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)[^>]*>/i, `${htmlFile} 不得含内联脚本`)
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, `${htmlFile} 不得含内联事件处理器`)
  }

  for (const distFile of ['dist/manifest.json', 'dist/background.js', 'dist/sidepanel.html', 'dist/options.html', 'dist/icons/icon128.png']) {
    assert.ok(existsSync(join(root, distFile)), `构建产物缺失：${distFile}`)
  }

  for (const distHtml of ['dist/sidepanel.html', 'dist/options.html']) {
    const html = read(distHtml)
    assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)[^>]*>/i, `${distHtml} 不得含内联脚本`)
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, `${distHtml} 不得含内联事件处理器`)
  }
})
