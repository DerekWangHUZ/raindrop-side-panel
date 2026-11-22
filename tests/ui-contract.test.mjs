import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 界面层的静态契约。浏览器扩展没有渲染测试，所以用源码断言把两类最易漂移的
// 东西钉住：JS 与 HTML 之间的 id/图标契约，以及「样式确实复用了参考项目」
// 这件事 —— vendor 层现在是 Solid Glass 模板（src/vendor/solid-glass.css），
// 但类名清单、样式表顺序与可溯源要求不变。

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFileSync(join(root, name), 'utf8');

const SIDEPANEL_HTML = read('sidepanel.html');
const SIDEPANEL_JS = read('sidepanel.js');
const SIDEPANEL_CSS = read('sidepanel.css');
const OPTIONS_HTML = read('options.html');
const OPTIONS_JS = read('options.js');
const OPTIONS_CSS = read('options.css');
const UI_BASE_CSS = read('ui-base.css');
const SOLID_GLASS_CSS = read('src/vendor/solid-glass.css');
const THEME_JS = read('theme.js');
const MAC_SCROLLBAR_JS = read('src/vendor/mac-scrollbar.js');

const matches = (text, pattern) => [...text.matchAll(pattern)].map(match => match[1]);
const unique = values => [...new Set(values)];

const declaredIds = html => new Set(matches(html, /\sid="([A-Za-z0-9_]+)"/g));
const queriedIds = js => unique(matches(js, /document\.querySelector\('#([A-Za-z0-9_]+)'\)/g));

const symbolsIn = html => new Set(matches(html, /<symbol id="(i-[A-Za-z0-9-]+)"/g));

/**
 * icon(...) 调用里出现的图标名。
 *
 * 只看第一个实参，这样 `icon('x', 'icon some-class')` 里的 class 不会被误判；
 * 实参按逗号 / 右括号截断，因此 `icon(a ? 'x' : 'y')` 这种三元写法也能覆盖。
 */
const iconCallNames = js => matches(js, /\bicon\(([^,)]*)/g)
  .flatMap(args => matches(args, /'([A-Za-z0-9-]+)'/g));

/** 页面用到的图标：HTML 里的 <use>、JS 里的 "#i-x" 字面量，以及 icon() 调用。 */
function usedIcons(html, js) {
  return new Set([
    ...matches(html, /<use href="#(i-[A-Za-z0-9-]+)"/g),
    ...matches(js, /['"]#(i-[A-Za-z0-9-]+)['"]/g),
    ...iconCallNames(js).map(name => `i-${name}`)
  ]);
}

// --- id 契约 ---------------------------------------------------------------

test('侧边栏：JS 引用的元素 id 全部存在于 HTML', () => {
  const referenced = queriedIds(SIDEPANEL_JS);
  const declared = declaredIds(SIDEPANEL_HTML);
  // 低于这个数量说明正则失配，断言会变成空转。
  assert.ok(referenced.length > 60, `应识别到侧边栏元素引用，实际 ${referenced.length} 个`);
  assert.deepEqual(referenced.filter(id => !declared.has(id)), []);
});

test('设置页：JS 引用的元素 id 全部存在于 HTML', () => {
  const referenced = queriedIds(OPTIONS_JS);
  const declared = declaredIds(OPTIONS_HTML);
  assert.ok(referenced.length >= 18, `应识别到设置页元素引用，实际 ${referenced.length} 个`);
  assert.deepEqual(referenced.filter(id => !declared.has(id)), []);
});

test('弹层仍是原生 dialog，showModal 才能继续使用', () => {
  for (const id of ['editorDialog', 'bulkAddDialog', 'bulkEditDialog', 'confirmDialog']) {
    assert.match(SIDEPANEL_HTML, new RegExp(`<dialog id="${id}"`), `${id} 必须是 <dialog>`);
  }
  assert.match(SIDEPANEL_JS, /\.showModal\(\)/);
});

// --- 图标契约 --------------------------------------------------------------

test('侧边栏：图标引用都有对应的 sprite symbol', () => {
  const symbols = symbolsIn(SIDEPANEL_HTML);
  const used = [...usedIcons(SIDEPANEL_HTML, SIDEPANEL_JS)];
  assert.ok(used.length >= 14, `应识别到侧边栏图标，实际 ${used.length} 个`);
  assert.deepEqual(used.filter(name => !symbols.has(name)), []);
});

test('sprite 中不残留无人引用的 symbol', () => {
  const pages = [
    ['sidepanel', SIDEPANEL_HTML, SIDEPANEL_JS],
    ['options', OPTIONS_HTML, OPTIONS_JS]
  ];
  for (const [name, html, js] of pages) {
    const used = usedIcons(html, js);
    const unused = [...symbolsIn(html)].filter(symbol => !used.has(symbol));
    assert.deepEqual(unused, [], `${name} 的 sprite 含未引用 symbol：${unused.join(', ')}`);
  }
});

// --- 字形契约 --------------------------------------------------------------

// 这些字符以前被当作图标使用，跨平台渲染差异极大，是界面显得粗糙的主因。
const BANNED_GLYPHS = ['⚙', '⌕', '↻', '🔑', '✎', '✨', '☂', '✓', '＋', '⌄', '›'];

test('界面源码不再出现 emoji 与符号型图标', () => {
  const sources = {
    'sidepanel.html': SIDEPANEL_HTML,
    'sidepanel.js': SIDEPANEL_JS,
    'sidepanel.css': SIDEPANEL_CSS,
    'options.html': OPTIONS_HTML,
    'options.js': OPTIONS_JS,
    'options.css': OPTIONS_CSS,
    'ui-base.css': UI_BASE_CSS,
    'src/vendor/solid-glass.css': SOLID_GLASS_CSS,
    'src/vendor/mac-scrollbar.js': MAC_SCROLLBAR_JS
  };
  for (const [name, source] of Object.entries(sources)) {
    const found = BANNED_GLYPHS.filter(glyph => source.includes(glyph));
    assert.deepEqual(found, [], `${name} 仍包含符号型图标：${found.join(' ')}`);
  }
});

// --- 复用参考项目样式 ------------------------------------------------------

test('两个页面都先引入 vendor 的 solid-glass.css', () => {
  for (const name of ['sidepanel.html', 'options.html']) {
    const html = read(name);
    const vendor = html.indexOf('href="src/vendor/solid-glass.css"');
    const base = html.indexOf('href="ui-base.css"');
    const own = html.search(/href="(sidepanel|options)\.css"/);
    assert.ok(vendor > -1, `${name} 未引入 src/vendor/solid-glass.css`);
    assert.ok(base > vendor, `${name} 的 ui-base.css 应在 solid-glass.css 之后`);
    assert.ok(own > base, `${name} 的自身样式表应在最后`);
  }
});

// 这条是「真的复用了参考项目的样式」而不是「学了个风格」的守门人：
// 一旦有人把手写样式换回自创类名，测试就会失败。类名清单不变 ——
// 换的只是 vendor 层（AppleMusicUI → Solid Glass），这些类在
// src/vendor/solid-glass.css 里仍然提供样式。
const REUSED_CLASSES = [
  'search-field', 'nav-group', 'nav-item', 'nav-link', 'nav-icon', 'nav-label',
  'songlist', 'song-row', 'song-row__img', 'song-row__t', 'btn-pill', 'pbtn',
  'shelf-title', 'sidebar__logo-text', 'drawer', 'empty-note',
  'lcd-title', 'lcd-artist', 'drawer-edit', 'card-sub', 'volume-pop', 'sidebar__scroll'
];

/** HTML/JS 里类名写作 class="x" 或模板串里的 "x y"，都不是 CSS 选择器写法。 */
const usesClass = (sources, name) => new RegExp(`["'\`\\s]${name}["'\`\\s]`).test(sources);

test('侧边栏 markup 真的在用参考项目的类名', () => {
  const sources = `${SIDEPANEL_HTML}\n${SIDEPANEL_JS}`;
  const missing = REUSED_CLASSES.filter(name => !usesClass(sources, name));
  assert.deepEqual(missing, [], `侧边栏未复用这些参考类名：${missing.join(' ')}`);
});

test('设置页 markup 真的在用参考项目的类名', () => {
  const sources = `${OPTIONS_HTML}\n${OPTIONS_JS}`;
  const required = ['page-title', 'shelf-title', 'nav-group', 'nav-item', 'nav-link',
    'nav-label', 'btn-pill', 'field-input', 'card-sub', 'detail-foot', 'page', 'select-inline'];
  const missing = required.filter(name => !usesClass(sources, name));
  assert.deepEqual(missing, [], `设置页未复用这些参考类名：${missing.join(' ')}`);
});

test('vendored 文件保持可溯源，且 token 取值未被改动', () => {
  assert.match(SOLID_GLASS_CSS, /来源：macUI-SolidGlass 模板本机副本，复制日期 2026-11-22/, 'solid-glass.css 缺少来源说明');
  assert.match(SOLID_GLASS_CSS, /token 禁止手工微调/, 'solid-glass.css 缺少「不要手工微调」的说明');
  // 抽查 Solid Glass 模板的原始取值，任何一处被改都会在这里暴露。
  for (const token of [
    '--bg: oklch(0.16 0 0);',
    '--nav-bg: oklch(0.11 0 0 / 50%);',
    '--player-bg: oklch(0.22 0 0 / 96%);',
    '--hairline: oklch(1 0 0 / 11%);',
    '--glass-rim: oklch(1 0 0 / 16%);',
    '--glass-shade: oklch(0 0 0 / 60%);',
    '--glass-blur: blur(26px);'
  ]) {
    assert.ok(SOLID_GLASS_CSS.includes(token), `solid-glass.css 丢失模板取值：${token}`);
  }
  // 模板本文里不应再出现未改写的主题媒体查询：只允许 token 块那一处保留
  // 媒体查询结构（theme.js 异步解析设置，首帧靠它避免闪主题）。
  const withoutComments = SOLID_GLASS_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const mediaQueries = matches(withoutComments, /@media \(prefers-color-scheme: (\w+)\)/g);
  assert.deepEqual(mediaQueries, ['light'], `主题媒体查询应只剩 token 块那一处，实际：${mediaQueries.join(', ')}`);
  // 主题色融合：7 个主题色染 brand/强调层，材质保持中性灰玻璃。
  // matches() 返回的已是第 1 个捕获组（主题色 id）。
  const THEME_COLOR_IDS = ['violet', 'blue', 'teal', 'green', 'orange', 'rose', 'gray'];
  const darkSwatches = matches(SOLID_GLASS_CSS, /:root\[data-theme-color="(\w+)"\] \{ --accent-blue: #[0-9a-f]+; \}/g);
  assert.deepEqual(darkSwatches, THEME_COLOR_IDS, '深色主题色清单应与 utils.mjs 的 7 色一致');
  const lightSwatches = matches(SOLID_GLASS_CSS, /:root\[data-theme-effective="light"\]\[data-theme-color="(\w+)"\] \{ --accent-blue: #[0-9a-f]+; \}/g);
  assert.deepEqual(lightSwatches, THEME_COLOR_IDS, '浅色主题色清单应与 utils.mjs 的 7 色一致');
  // brand 层是主题色的出口：强调 token 名保留，brand 只做别名。
  assert.match(SOLID_GLASS_CSS, /--brand: var\(--accent-blue\);/, '--brand 应是 --accent-blue 的别名');
});

test('页面样式表只做几何覆盖，不重复定义主题 token', () => {
  for (const [name, css] of [['sidepanel.css', SIDEPANEL_CSS], ['options.css', OPTIONS_CSS]]) {
    assert.doesNotMatch(css, /data-theme-color=/, `${name} 不应重复定义主题色映射`);
    assert.doesNotMatch(css, /--nav-bg:/, `${name} 不应重复定义 vendor token`);
    // Solid Glass 材质的 oklch 取值只允许出现在 vendor 层，
    // 覆盖层里手工出现 oklch() 一律视为在微调材质。
    assert.doesNotMatch(css, /oklch\(/, `${name} 不应手写 oklch 材质取值`);
  }
});

// --- HIG 字阶与胶囊选中态（S7 / S4） ---------------------------------------
//
// 字阶 token 照抄模板 tokens.css，散点字号全部改引 token。这里锁住取值
// （防止「调一格」）与「页面层不再出现裸 px 字号标题」两件事。

test('vendor 层提供 HIG 字号与 tracking token，取值与模板一致', () => {
  // 与模板 tokens.css 的「macOS built-in text styles」表逐项对照；
  // 任何一处被改都会在这里暴露。
  for (const token of [
    '--font-large-title-size: 26px;', '--font-large-title-lh: 32px;',
    '--font-title1-size: 22px;', '--font-title1-lh: 26px;',
    '--font-title2-size: 17px;', '--font-title2-lh: 22px;',
    '--font-title3-size: 15px;', '--font-title3-lh: 20px;',
    '--font-headline-size: 13px;', '--font-headline-lh: 16px;',
    '--font-body-size: 13px;', '--font-body-lh: 16px;',
    '--font-callout-size: 12px;', '--font-callout-lh: 15px;',
    '--font-subheadline-size: 11px;', '--font-subheadline-lh: 14px;',
    '--font-footnote-size: 10px;', '--font-footnote-lh: 13px;',
    '--font-caption1-size: 10px;', '--font-caption1-lh: 13px;',
    '--track-10: 0.12px;', '--track-11: 0.06px;', '--track-12: 0px;',
    '--track-13: -0.08px;', '--track-15: -0.23px;', '--track-17: -0.43px;',
    '--track-22: -0.26px;', '--track-26: 0.15px;'
  ]) {
    assert.ok(SOLID_GLASS_CSS.includes(token), `solid-glass.css 丢失字阶 token：${token}`);
  }
});

test('散点字号全部改引字阶 token，页面层不再有裸 px 标题字号', () => {
  // vendor 层的关键字级：page-title 26（large-title）、nav 行 13（body）、
  // shelf-title 17（title2）、分组小节标题 12（callout）。
  assert.match(SOLID_GLASS_CSS, /\.page-title \{[^}]*font-size: var\(--font-large-title-size\)/s,
    '.page-title 应用 large-title 刻度（26px）');
  assert.match(SOLID_GLASS_CSS, /\.nav-link \{[^}]*font-size: var\(--font-body-size\)/s,
    '.nav-link 应用 body 刻度（13px）');
  assert.match(SOLID_GLASS_CSS, /\.shelf-title \{[^}]*font-size: var\(--font-title2-size\)/s,
    '.shelf-title 应用 title2 刻度（17px）');
  assert.match(SOLID_GLASS_CSS, /\.nav-section-title \{[^}]*font-size: var\(--font-callout-size\)/s,
    '.nav-section-title 应用 callout 刻度（12px）');
  // 页面层：标题类规则一律 token 化，不允许再写死标题 px 字号。
  for (const [name, css] of [['sidepanel.css', SIDEPANEL_CSS], ['options.css', OPTIONS_CSS]]) {
    assert.doesNotMatch(css, /font-size:\s*(2[0-9]|3[0-9])px/,
      `${name} 仍有手写的标题级 px 字号`);
  }
  // 顶栏与弹层标题走 toolbar__title 刻度（title1 22px）。
  assert.match(SIDEPANEL_CSS, /\.panel__head \{[^}]*height:\s*48px/s,
    '顶栏高度对齐模板 --chrome-h 的 48px');
  assert.match(SIDEPANEL_CSS, /\.panel__head \.sidebar__logo-text \{[^}]*font-size: var\(--font-title1-size\)/s,
    '顶栏品牌名应用 toolbar__title 刻度（22px）');
  assert.match(UI_BASE_CSS, /\.sheet-form h2 \{[^}]*font-size: var\(--font-title1-size\)/s,
    '弹层标题应用 toolbar__title 刻度（22px）');
});

test('导航选中态是 999px 胶囊 + glass-state 三件套，7 主题色经 accent 染色', () => {
  // S4：模板 chrome.css 的胶囊选中行 —— min-height 33px、圆角 999px、
  // 「唯一状态」三件套（清玻璃 + 顶缘光线 + 发丝线）。
  const link = SOLID_GLASS_CSS.slice(SOLID_GLASS_CSS.indexOf('.nav-link {'),
    SOLID_GLASS_CSS.indexOf('}', SOLID_GLASS_CSS.indexOf('.nav-link {')));
  assert.match(link, /min-height:\s*33px/, '.nav-link 应为 min-height 33px');
  assert.match(link, /border-radius:\s*999px/, '.nav-link 应为 999px 胶囊');
  const selected = SOLID_GLASS_CSS.slice(SOLID_GLASS_CSS.indexOf('.nav-item--selected > .nav-link {'),
    SOLID_GLASS_CSS.indexOf('}', SOLID_GLASS_CSS.indexOf('.nav-item--selected > .nav-link {')));
  assert.match(selected, /var\(--nav-selected\)/, '选中态底色是唯一状态玻璃');
  assert.match(selected, /var\(--glass-state-rim\)/, '选中态要有顶缘光线');
  assert.match(selected, /var\(--glass-state-edge\)/, '选中态要有发丝线');
  // 7 主题色经 --accent-blue 的 14% 染色变体（模板 accent 染色模式）。
  assert.match(SOLID_GLASS_CSS,
    /:root\[data-theme-color\] \.nav-item--selected > \.nav-link \{[^}]*color-mix\(in oklch, var\(--accent-blue\) 14%, transparent\)/s,
    '彩色主题选中态应用 accent 14% 染色');
});

// --- 运行时无障碍降级与自绘滚动条（S10 / S6'） ------------------------------

test('theme.js 实时同步 prefers-reduced-* 到 html class，vendor 层只收 class 分支', () => {
  // 双层机制：ui-base.css 的媒体查询是首帧基线（上面已锁），theme.js 负责
  // 设置中途切换的实时性 —— 模板 chrome.css 的实时降级段。
  assert.match(THEME_JS, /prefers-reduced-motion: reduce/, 'theme.js 应监听减少动态');
  assert.match(THEME_JS, /prefers-reduced-transparency: reduce/, 'theme.js 应监听减少透明');
  assert.match(THEME_JS, /classList\.toggle\('is-reduced-motion'/, '减少动态写入 html class');
  assert.match(THEME_JS, /classList\.toggle\('is-reduced-transparency'/, '减少透明写入 html class');
  // vendor 层的 class 分支：实色 token 组按模板取值（映射 --nav-bg/--player-bg）。
  assert.match(SOLID_GLASS_CSS, /html\.is-reduced-transparency \{[^}]*--glass-blur: none;/s,
    '减少透明时先关模糊');
  assert.match(SOLID_GLASS_CSS, /html\[data-theme-effective="dark"\]\.is-reduced-transparency \{[^}]*--nav-bg: oklch\(0\.19 0 0\);/s,
    '深色实色面板取模板 chrome.css 的 0.19');
  assert.match(SOLID_GLASS_CSS, /html\.is-reduced-motion,/, '减少动态的运行时分支存在');
  // vendor 层仍然不许自带 prefers-reduced-* 媒体查询（守卫收在 ui-base.css）。
  assert.doesNotMatch(SOLID_GLASS_CSS, /@media \(prefers-reduced/,
    'vendor 层不应自带 prefers-reduced-* 媒体查询');
});

test('自绘滚动条：vendor 模块存在且挂在面板滚动容器上', () => {
  // S6'：样式与逻辑都可溯源（模板 chrome.css .mac-scrollbar 的 vanilla 移植）。
  assert.match(SOLID_GLASS_CSS, /\.panel \.mac-scrollbar \{[^}]*position:\s*absolute/s,
    '滚动条轨道应钉在面板内侧');
  assert.match(SOLID_GLASS_CSS, /\.panel \.mac-scrollbar__thumb \{[^}]*border-radius:\s*999px/s,
    '滑块是胶囊');
  assert.match(MAC_SCROLLBAR_JS, /export function attachMacScrollbar/, '滚动条逻辑是 ES Module 导出');
  assert.match(MAC_SCROLLBAR_JS, /requestAnimationFrame/, '同步走 rAF 合帧');
  assert.match(SIDEPANEL_JS, /attachMacScrollbar\(els\.panelScroll\)/, '面板启动时挂载自绘滚动条');
  // 原生滚动条隐藏，避免与自绘滑块叠加。
  assert.match(SIDEPANEL_CSS, /\.panel__scroll \{[^}]*scrollbar-width:\s*none/s, '原生滚动条隐藏（Firefox 语法）');
  assert.match(SIDEPANEL_CSS, /\.panel__scroll::-webkit-scrollbar \{ width: 0; height: 0; \}/, '原生滚动条隐藏（WebKit）');
});

// --- 设置页 Panel 式分组与居中确认弹层（S8' / S8''） ------------------------

test('设置页分节改为 glass-panel 卡片分组', () => {
  // 模板 settings.tsx 的 Panel 结构：最薄档玻璃整卡 + 32px 头 + 内容体。
  assert.match(OPTIONS_HTML, /class="glass-panel options-card"/, '分节应是 .glass-panel 卡片');
  assert.match(OPTIONS_CSS, /\.options-card__head \{[^}]*min-height:\s*32px/s,
    '卡片头部对齐模板 Panel 的 32px 头');
  assert.match(OPTIONS_CSS, /\.options-card \{[^}]*border-radius:\s*14px/s, '卡片圆角收在覆盖层');
  // 头部标题是 .shelf-title（title2 刻度由 vendor 层提供，这里锁结构）。
  assert.match(OPTIONS_HTML, /<h2 class="shelf-title options-card__title"/, '卡片名沿用 .shelf-title');
});

test('确认类弹层有居中 dialog 变体，底部 sheet 仍是主形态', () => {
  // S8''：sidepanel 的 4 个弹层保持底部 sheet（契约锁 <dialog>+showModal）；
  // options 的清除确认走居中变体（popover 最厚档 + 居中 backdrop）。
  assert.match(UI_BASE_CSS, /dialog\.app-dialog\.dialog-pop \{[^}]*margin:\s*auto;/s,
    '居中变体应满屏居中');
  assert.match(UI_BASE_CSS, /dialog\.app-dialog\.dialog-pop \{[^}]*background: var\(--player-bg\);/s,
    '居中变体用最厚档玻璃');
  assert.match(OPTIONS_HTML, /<dialog id="clearConfirmDialog" class="app-dialog dialog-pop"/,
    'options 确认弹层用居中变体');
  assert.match(OPTIONS_JS, /clearConfirmDialog\.showModal\(\)/, '确认弹层走 showModal');
  // 底部 sheet 主形态不变：app-dialog 默认 margin 仍是吸底。
  assert.match(UI_BASE_CSS, /dialog\.app-dialog \{[^}]*margin: auto auto 0;/s,
    'sheet 主形态保持吸底');
});

// --- 样式卫生 --------------------------------------------------------------

test('hover 反馈不靠位移，避免滚动时的抖动', () => {
  for (const [name, css] of [['sidepanel.css', SIDEPANEL_CSS], ['options.css', OPTIONS_CSS]]) {
    assert.doesNotMatch(css, /translateY\(-1px\)/, `${name} 仍在使用位移 hover`);
  }
});

test('书签行不做逐行阴影与毛玻璃', () => {
  const start = SIDEPANEL_CSS.indexOf('.song-row {');
  const rule = SIDEPANEL_CSS.slice(start, SIDEPANEL_CSS.indexOf('}', start));
  assert.ok(start > -1, '未找到 .song-row 规则');
  assert.doesNotMatch(rule, /box-shadow|backdrop-filter/, '书签行不应有阴影或毛玻璃');
});

/**
 * 三个历史回归的源码级守门人（都是真实截图里暴露过的）：
 *   1. #resultCount / .tree-current 带着参考项目 .card-sub 的两行截断盒，
 *      不中和掉就会把「7 项」折成「7」「项」两行；
 *   2. .save-pill 是 28px 半径的胶囊，子元素不内缩会戳出两端的圆帽；
 *   3. 封面必须有垫底首字，且取不到图时要把 <img> 移除，
 *      否则 Chrome 会在首字上叠一个「图片已损坏」图标。
 */
test('列表头：计数与当前收藏夹名单行截断', () => {
  const count = SIDEPANEL_CSS.slice(SIDEPANEL_CSS.indexOf('.list-pick > #resultCount'));
  const countRule = count.slice(0, count.indexOf('}'));
  assert.match(countRule, /display:\s*block/, '#resultCount 要摆脱 .card-sub 的 -webkit-box');
  assert.match(countRule, /white-space:\s*nowrap/, '#resultCount 必须单行');
  const current = SIDEPANEL_CSS.slice(SIDEPANEL_CSS.indexOf('.tree-current {'));
  const currentRule = current.slice(0, current.indexOf('}'));
  assert.match(currentRule, /white-space:\s*nowrap/, '.tree-current 必须单行');
  assert.match(currentRule, /text-overflow:\s*ellipsis/, '.tree-current 需要省略号');
});

test('保存胶囊左右留出圆帽空间', () => {
  const start = SIDEPANEL_CSS.indexOf('.save-pill {');
  const rule = SIDEPANEL_CSS.slice(start, SIDEPANEL_CSS.indexOf('}', start));

  // 胶囊高 56px、圆角 1000px → 实际半径 28px。42px 高的封面竖直占 y=7..49，
  // 要让它的角落在弧线内还留 5px 余量，横向内缩至少 20px（12px 时只剩 2px，
  // 看上去就是「图标和圆角撞在一起」）。这里锁死下限，避免又被调窄。
  const four = rule.match(/padding:\s*0\s+(\d+)px\s+0\s+(\d+)px/);
  const shorthand = rule.match(/padding:\s*0\s+(\d+)px\s*;/);
  const right = four ? Number(four[1]) : shorthand ? Number(shorthand[1]) : null;
  const left = four ? Number(four[2]) : shorthand ? Number(shorthand[1]) : null;
  assert.ok(right !== null && left !== null, '.save-pill 需要写成 "padding: 0 <左右>px"');
  assert.ok(right >= 18, `右内边距 ${right}px 不足：28px 圆帽至少要 18px 才不会压到保存按钮`);
  assert.ok(left >= 18, `左内边距 ${left}px 不足：28px 圆帽至少要 18px 才不会压到封面`);

  // 窄屏也必须靠缩小封面与按钮来省宽度，而不是压缩内缩
  const narrowPad = SIDEPANEL_CSS.match(
    /@media \(max-width: 360px\)[\s\S]*?\.save-pill\s*\{\s*padding:\s*0\s+(\d+)px/
  );
  assert.ok(narrowPad && Number(narrowPad[1]) >= 14,
    `窄屏 .save-pill 内边距 ${narrowPad?.[1] ?? '缺失'} 不足以避开圆帽`);
});

/**
 * 封面方框的核心不变式：里面**恰好一个**元素 —— 要么照片，要么首字。
 *
 * 这里踩过两次坑，都是「两者并存」造成的：
 *   1. 首字垫在照片下面：浏览器图标常是「透明底上的小图形」，object-fit 放大后
 *      透明区域依然透明，首字就透出来了 —— 一个格子里两个图形；
 *   2. 首字与 favicon 都是 grid item 时各占一行，其中一个被挤出方框外。
 * 所以现在由 coverContent() 二选一，且只在这里放行「不是照片就是首字」的写法。
 */
test('封面方框只放一个元素（照片或首字，不并存）', () => {
  const body = SIDEPANEL_JS.slice(SIDEPANEL_JS.indexOf('function coverContent'));
  const fn = body.slice(0, body.indexOf('\nfunction ', 10));
  assert.ok(fn.length > 0, '未找到 coverContent');
  // 没有 cover 时直接返回首字
  assert.match(fn, /if \(!cover\) return initial;/, '没有 cover 时必须直接返回首字');
  // 有 cover 时只返回照片，失败才换成首字
  assert.match(fn, /return photo;/, '有 cover 时必须只返回照片');
  assert.match(fn, /photo\.replaceWith\(initial\)/, '取不到图时才换成首字');
  assert.doesNotMatch(fn, /appendChild/, 'coverContent 不该往方框里追加第二个元素');
  // 排版上不应再出现层叠遮挡的写法
  assert.doesNotMatch(SIDEPANEL_CSS, /\.song-row__photo|\.song-row__initial|\.save-pill__favicon|\.save-pill__initial/,
    '旧的层叠遮挡样式应已删除');
  assert.match(SIDEPANEL_CSS, /\.cover-photo\s*\{[^}]*object-fit:\s*cover/s);
  assert.match(SIDEPANEL_CSS, /\.cover-initial\s*\{/);
});

test('侧边栏与保存胶囊都走同一套封面逻辑', () => {
  assert.match(SIDEPANEL_JS, /coverContent\(\{\s*title:[^}]*cover:\s*item\.cover/s, '书签行封面要走 coverContent');
  assert.match(SIDEPANEL_JS, /coverContent\(\{[\s\S]{0,200}?cover:\s*tab\?\.favIconUrl/s, '保存胶囊封面要走 coverContent');
  assert.match(SIDEPANEL_HTML, /id="saveArt"/, '保存胶囊需要一个由 JS 填充的方框');
  assert.doesNotMatch(SIDEPANEL_JS, /applyFavicon|saveFavicon/, '旧的 favicon 开关逻辑应已删除');
});

/**
 * 抄参考项目的 sprite 时最容易犯的错：连它的「业务语义」一起抄过来。
 * 参考项目是音乐播放器，它的 i-note / i-play / i-album 之类在书签管理器里全是错的
 * （曾经把 i-note 当成「没有 favicon」的占位图标，界面上就出现了一个音符）。
 */
test('面板不出现播放器语义的图标', () => {
  const playerIcons = ['i-note', 'i-play', 'i-pause', 'i-shuffle', 'i-backward',
    'i-forward', 'i-lyrics', 'i-speaker', 'i-album', 'i-apple', 'i-appmusic-app', 'i-tv'];
  for (const name of playerIcons) {
    assert.doesNotMatch(SIDEPANEL_HTML, new RegExp(`<symbol id="${name}"`),
      `书签管理器不该出现播放器图标 ${name}`);
  }
  // 没有 favicon 时用标题首字兜底，而不是借一个图标来凑
  assert.match(SIDEPANEL_JS, /coverContent/, '没有 favicon 时用标题首字兜底');
});

test('封面取不到图时降级为首字', () => {
  assert.match(SIDEPANEL_JS, /addEventListener\('error', fallback/, '图片失败时要换成首字');
  assert.match(SIDEPANEL_JS, /naturalWidth/, '还要处理「200 但 naturalWidth 为 0」的图片');
});

/**
 * 同一个坑的另一处：刷新 / 优化按钮的 spinner 是叠在图标上的。
 * 必须「默认只显示图标、加载时只显示 spinner」，否则又是一格两个图形。
 */
test('加载态与图标互斥', () => {
  assert.match(UI_BASE_CSS, /\.spinner\s*\{[^}]*display:\s*none/s, 'spinner 默认必须隐藏');
  assert.match(UI_BASE_CSS, /\.is-loading[^{]*\.icon\s*\{[^}]*visibility:\s*hidden/s,
    '加载时必须把图标藏起来');
  assert.match(UI_BASE_CSS, /\.is-loading\s+\.spinner\s*\{[^}]*display:\s*block/s,
    '加载时才显示 spinner');
});

test('无障碍偏好：减少动态、减少透明与高对比都有处理', () => {
  // 三个守卫全部在 ui-base.css；vendor 层的 backdrop-filter 材质
  // 依赖这里的加厚兜底，不许在别处单独开一份。
  assert.match(UI_BASE_CSS, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(UI_BASE_CSS, /@media \(prefers-reduced-transparency: reduce\)/);
  assert.match(UI_BASE_CSS, /@media \(prefers-contrast: more\)/);
  // Solid Glass 的玻璃全靠 backdrop-filter：减透明时 vendor 层自身
  // 不得再补第二份媒体查询，材质退化策略统一收在 base 层。
  assert.doesNotMatch(SOLID_GLASS_CSS, /@media \(prefers-(reduced-transparency|contrast)/,
    'vendor 层不应重复无障碍守卫');
});

// --- CSP 契约 --------------------------------------------------------------

test('HTML 不含内联脚本与内联事件处理器', () => {
  for (const name of ['sidepanel.html', 'options.html']) {
    const html = read(name);
    assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)[^>]*>/i, `${name} 含内联脚本`);
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, `${name} 含内联事件处理器`);
  }
});
