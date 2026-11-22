import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 界面层的静态契约。浏览器扩展没有渲染测试，所以用源码断言把两类最易漂移的
// 东西钉住：JS 与 HTML 之间的 id/图标契约，以及「样式确实复用了 Solid Glass
// 官方材质与组件语言」这件事 —— vendor 层是官方模板（src/vendor/solid-glass.css），
// 页面层用官方组件词汇（Item / SidebarMenuButton / segmented / glass-panel）。

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

// --- 复用 Solid Glass 材质层 ------------------------------------------------

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

// 「真的在用官方组件语言」而不是「学了个风格」的守门人：一旦有人把手写
// 结构换回旧的行式表格或胶囊导航，测试就会失败。2.1 起页面层词汇表是
// Solid Glass 官方组件（Item / SidebarMenuButton / segmented / glass-panel）。
const SIDEPANEL_CLASSES = [
  'toolbar', 'icon-btn', 'search-field', 'save-card', 'item-group', 'item',
  'item__media', 'item__content', 'item__title', 'item__desc', 'more-btn',
  'menu', 'menu-btn', 'menu-btn--selected', 'menu-sub', 'menu-label',
  'list-head', 'selection-bar', 'menu-pane', 'menu-item', 'toast', 'empty',
  'btn-pill', 'sg-dots', 'pick', 'tag'
];

/** HTML/JS 里类名写作 class="x" 或模板串里的 "x y"，都不是 CSS 选择器写法。 */
const usesClass = (sources, name) => new RegExp(`["'\`\\s\\.]${name}["'\`\\s]`).test(sources);

test('侧边栏 markup 真的在用官方组件词汇', () => {
  const sources = `${SIDEPANEL_HTML}\n${SIDEPANEL_JS}`;
  const missing = SIDEPANEL_CLASSES.filter(name => !usesClass(sources, name));
  assert.deepEqual(missing, [], `侧边栏未使用这些官方类名：${missing.join(' ')}`);
});

test('书签列表是留缝卡片流，不是通栏发丝线表格', () => {
  // 结构：ul.item-group > li.item
  assert.match(SIDEPANEL_HTML, /<ul id="bookmarkList" class="item-group"/, '列表容器是 .item-group');
  assert.match(SIDEPANEL_JS, /className = 'item'/, '书签行是 .item');
  assert.doesNotMatch(SIDEPANEL_HTML, /songlist|song-row/, '音乐播放器的行式表格应已退役');
  assert.doesNotMatch(SIDEPANEL_CSS, /border-top: 1px solid var\(--hairline\)[^}]*\}\s*\.song-row|\.songlist \{[^}]*border-top/s,
    '.songlist 通栏线应已退役');
  // Item 材质：--panel 面 + 发丝线 + 内圈 rim，无逐行阴影毛玻璃。
  const start = SIDEPANEL_CSS.indexOf('.item {');
  const rule = SIDEPANEL_CSS.slice(start, SIDEPANEL_CSS.indexOf('}', start));
  assert.ok(start > -1, '未找到 .item 规则');
  assert.match(rule, /var\(--panel\)/, '.item 的面是 --panel 最薄档玻璃');
  assert.match(rule, /var\(--glass-edge\)/, '.item 要有发丝线');
  assert.match(rule, /var\(--glass-inner\)/, '.item 要有内圈 rim');
  assert.doesNotMatch(rule, /box-shadow:\s*[^;]*0 12px|backdrop-filter/, '书签行不做逐行阴影与毛玻璃');
  // 行间留缝（ItemGroup 的 gap），无行贴行。
  const group = SIDEPANEL_CSS.slice(SIDEPANEL_CSS.indexOf('.item-group {'), SIDEPANEL_CSS.indexOf('}', SIDEPANEL_CSS.indexOf('.item-group {')));
  assert.match(group, /gap:\s*\d+px/, '.item-group 行间要有 gap');
});

test('收藏夹树是 SidebarMenuButton/MenuSub 结构，不是胶囊导航', () => {
  assert.match(SIDEPANEL_JS, /className = `menu-btn/, '树行走 .menu-btn');
  assert.match(SIDEPANEL_JS, /'menu-sub'/, '子级渲染进嵌套 ul.menu-sub');
  assert.doesNotMatch(SIDEPANEL_JS, /nav-item|nav-link|collection-toggle|collection-dot/, '旧胶囊导航应已退役');
  const btn = SIDEPANEL_CSS.slice(SIDEPANEL_CSS.indexOf('.menu-btn {'), SIDEPANEL_CSS.indexOf('}', SIDEPANEL_CSS.indexOf('.menu-btn {')));
  assert.match(btn, /min-height:\s*32px/, '.menu-btn 应为 32px 行高（官方 h-8）');
  assert.match(btn, /border-radius:\s*9px/, '.menu-btn 应为 9px 圆角（rounded-md），不是 999px 胶囊');
  const selected = SIDEPANEL_CSS.slice(
    SIDEPANEL_CSS.indexOf('.menu-btn--selected'),
    SIDEPANEL_CSS.indexOf('}', SIDEPANEL_CSS.indexOf('.menu-btn--selected'))
  );
  assert.match(selected, /var\(--glass-state\)/, '选中态底色是唯一状态玻璃');
  assert.match(selected, /var\(--glass-state-rim\)/, '选中态要有顶缘光线');
  assert.match(selected, /var\(--glass-state-edge\)/, '选中态要有发丝线');
  // 子级导轨：缩进 + 左侧 1px 发丝线。
  const sub = SIDEPANEL_CSS.slice(SIDEPANEL_CSS.indexOf('.menu-sub {'), SIDEPANEL_CSS.indexOf('}', SIDEPANEL_CSS.indexOf('.menu-sub {')));
  assert.match(sub, /border-left:\s*1px solid var\(--hairline\)/, '.menu-sub 要有左导轨');
});

test('设置页 markup 真的在用官方组件词汇', () => {
  const sources = `${OPTIONS_HTML}\n${OPTIONS_JS}`;
  const required = ['glass-panel', 'card', 'card__head', 'card__title', 'card__body', 'card-row',
    'field-input', 'select-inline', 'btn-pill', 'segmented', 'detail-foot', 'page'];
  const missing = required.filter(name => !usesClass(sources, name));
  assert.deepEqual(missing, [], `设置页未使用这些官方类名：${missing.join(' ')}`);
});

test('主题模式是凹槽分段控件，唯一状态清玻璃选中', () => {
  assert.match(OPTIONS_HTML, /<div class="segmented" id="themeModeSelect" role="radiogroup"/, '分段控件结构');
  assert.match(OPTIONS_JS, /segmented__btn/, 'JS 驱动分段按钮');
  const seg = OPTIONS_CSS.slice(SIDEPANEL_CSS ? OPTIONS_CSS.indexOf('.segmented {') : -1);
  const rule = seg.slice(0, seg.indexOf('}'));
  assert.match(rule, /var\(--well-shade\)/, '分段容器是凹槽（上唇阴影）');
  assert.match(rule, /var\(--well-rim\)/, '分段容器是凹槽（下缘光线）');
  const active = OPTIONS_CSS.slice(
    OPTIONS_CSS.indexOf('.segmented__btn[aria-checked="true"]'),
    OPTIONS_CSS.indexOf('}', OPTIONS_CSS.indexOf('.segmented__btn[aria-checked="true"]'))
  );
  assert.match(active, /var\(--glass-state\)/, '选中段是唯一状态玻璃');
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
  // 主题色：7 色 data-theme-color 预设已移除（官方 theming 只有 dark/light，
  // "interface has no colour of its own"）——accent 回归中性灰，--brand 用官方青绿直值。
  assert.doesNotMatch(SOLID_GLASS_CSS, /data-theme-color=/, 'vendor 层不应再有 7 主题色预设');
  assert.match(SOLID_GLASS_CSS, /--accent-blue: #a3aab5;/, '深色 accent 应为中性灰');
  assert.match(SOLID_GLASS_CSS, /--accent-blue: #5f6368;/, '浅色 accent 应为中性灰');
  assert.match(SOLID_GLASS_CSS, /--brand: oklch\(0\.78 0\.13 166\);/, '--brand 应为官方原版青绿直值');
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

// --- HIG 字阶（官方 tokens.css，取值锁死） ----------------------------------

test('vendor 层提供 HIG 字号与 tracking token，取值与模板一致', () => {
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
  // 顶栏品牌名走 toolbar__title 刻度（title1 22px）。
  assert.match(SIDEPANEL_CSS, /\.toolbar \{[^}]*height:\s*48px/s,
    '顶栏高度对齐模板 --chrome-h 的 48px');
  assert.match(SIDEPANEL_CSS, /\.toolbar__brand-text \{[^}]*font-size: var\(--font-title1-size\)/s,
    '顶栏品牌名应用 toolbar__title 刻度（22px）');
  assert.match(UI_BASE_CSS, /\.dialog-head h2 \{[^}]*font-size: var\(--font-title1-size\)/s,
    '弹层标题应用 toolbar__title 刻度（22px）');
});

test('加载指示是官方 dot-loader，且与图标互斥', () => {
  assert.match(UI_BASE_CSS, /\.sg-dots i \{[^}]*animation: sg-dot-flash/s,
    '三点指示走官方 sg-dot-flash');
  assert.match(UI_BASE_CSS, /\.is-loading \.sg-dots \{ display: flex; \}/,
    '加载时才显示三点指示');
  assert.match(UI_BASE_CSS, /\.is-loading[^{]*\.icon\s*\{[^}]*visibility:\s*hidden/s,
    '加载时必须把图标藏起来');
  assert.match(SIDEPANEL_HTML, /class="sg-dots"/, 'HTML 用三点指示');
  assert.doesNotMatch(SIDEPANEL_HTML, /class="spinner"/, 'HTML 不应残留 spinner');
  assert.doesNotMatch(UI_BASE_CSS, /\.spinner/, 'ui-base 不应再有旧 spinner');
});

// --- 官方对齐（token 取值与官方 main 一致） ----------------------------------

test('.glass-panel 有官方定义：--panel 面 + rim/inner/edge/panel-shadow 收光', () => {
  const start = SOLID_GLASS_CSS.indexOf('.glass-panel {');
  assert.ok(start > -1, 'vendor 层缺少 .glass-panel 定义（options 卡片在用它）');
  const rule = SOLID_GLASS_CSS.slice(start, SOLID_GLASS_CSS.indexOf('}', start));
  assert.match(rule, /var\(--panel\)/, '面是 --panel 最薄档玻璃');
  assert.match(rule, /var\(--glass-blur\)/, '有官方模糊');
  assert.match(rule, /var\(--glass-rim\)/, '顶缘光线');
  assert.match(rule, /var\(--glass-inner\)/, '内一圈');
  assert.match(rule, /var\(--glass-edge\)/, '外发丝线');
  assert.match(rule, /var\(--panel-shadow\)/, '底部阴影');
});

test('官方 token：--panel / 凹槽 / 语义色相与官方 main 取值一致', () => {
  assert.ok(SOLID_GLASS_CSS.includes('--panel: oklch(1 0 0 / 4.5%);'), '深色 --panel');
  assert.ok(SOLID_GLASS_CSS.includes('--panel: oklch(0.975 0.004 265 / 44%);'), '浅色 --panel');
  for (const token of [
    '--well-shade: oklch(0 0 0 / 38%);',
    '--well-rim: oklch(1 0 0 / 9%);',
    '--well-shade: oklch(0.3 0.06 265 / 14%);',
    '--well-rim: oklch(1 0 0 / 85%);'
  ]) {
    assert.ok(SOLID_GLASS_CSS.includes(token), `丢失凹槽 token：${token}`);
  }
  for (const token of [
    '--success: oklch(0.74 0.16 152);',
    '--success: oklch(0.58 0.15 152);',
    '--code-inline: oklch(0.73 0.13 20);',
    '--code-inline: oklch(0.53 0.17 22);'
  ]) {
    assert.ok(SOLID_GLASS_CSS.includes(token), `丢失语义色 token：${token}`);
  }
});

test('.btn-pill 有官方 hover/active：hover 变薄不换色，active 收起站立阴影', () => {
  const hoverStart = SOLID_GLASS_CSS.indexOf('.btn-pill:hover');
  assert.ok(hoverStart > -1, '缺少官方 hover 态');
  const hover = SOLID_GLASS_CSS.slice(hoverStart, SOLID_GLASS_CSS.indexOf('}', hoverStart));
  assert.match(hover, /calc\(var\(--primary-solid\) - 10%\)/, 'hover 应使墨面变薄 10%（不换色）');
  const activeStart = SOLID_GLASS_CSS.indexOf('.btn-pill:active');
  assert.ok(activeStart > -1, '缺少官方 active 态');
  const active = SOLID_GLASS_CSS.slice(activeStart, SOLID_GLASS_CSS.indexOf('}', activeStart));
  assert.doesNotMatch(active, /0 8px 18px/, 'active 应收起站立阴影');
});

test('输入域聚焦只提亮边线，没有 3px 焦点环', () => {
  assert.doesNotMatch(UI_BASE_CSS, /box-shadow:\s*0 0 0 3px/,
    '官方材料页：输入域被输入时只提亮边线，没有三像素宽的环');
});

test('计数用 tabular-nums，变化中的数字不跳动', () => {
  // #resultCount / #loadingLabel 挂 .list-head__meta，#selectionCount 挂
  // .selection-bar__count —— 两个计数载体都要等宽数字。
  assert.match(SIDEPANEL_CSS, /\.list-head__meta \{[^}]*font-variant-numeric: tabular-nums/s,
    '列表头计数要有 tabular-nums');
  assert.match(SIDEPANEL_CSS, /\.selection-bar__count \{[^}]*font-variant-numeric: tabular-nums/s,
    '选择条计数要有 tabular-nums');
});

test('减透明降级补齐官方实色：--primary-solid 100% 与 --panel 实色', () => {
  assert.match(SOLID_GLASS_CSS, /html\.is-reduced-transparency \{[^}]*--primary-solid: 100%;/s);
  assert.match(SOLID_GLASS_CSS, /html\.is-reduced-transparency \{[^}]*--panel: oklch\(0\.947 0\.006 265\);/s);
  assert.match(
    SOLID_GLASS_CSS,
    /html\[data-theme-effective="dark"\]\.is-reduced-transparency \{[^}]*--panel: oklch\(0\.19 0 0\);/s
  );
});

test('自绘滚动条：vendor 模块存在且挂在面板滚动容器上', () => {
  assert.match(SOLID_GLASS_CSS, /\.panel \.mac-scrollbar \{[^}]*position:\s*absolute/s,
    '滚动条轨道应钉在面板内侧');
  assert.match(SOLID_GLASS_CSS, /\.panel \.mac-scrollbar__thumb \{[^}]*border-radius:\s*999px/s,
    '滑块是胶囊');
  assert.match(MAC_SCROLLBAR_JS, /export function attachMacScrollbar/, '滚动条逻辑是 ES Module 导出');
  assert.match(MAC_SCROLLBAR_JS, /requestAnimationFrame/, '同步走 rAF 合帧');
  assert.match(SIDEPANEL_JS, /attachMacScrollbar\(els\.panelScroll\)/, '面板启动时挂载自绘滚动条');
  assert.match(SIDEPANEL_CSS, /\.panel__scroll \{[^}]*scrollbar-width:\s*none/s, '原生滚动条隐藏（Firefox 语法）');
  assert.match(SIDEPANEL_CSS, /\.panel__scroll::-webkit-scrollbar \{ width: 0; height: 0; \}/, '原生滚动条隐藏（WebKit）');
});

// --- 源码级守门人（历史回归） ----------------------------------------------

test('行尾操作按钮默认隐藏，hover 或键盘聚焦所在行才浮现', () => {
  const base = SIDEPANEL_CSS.slice(SIDEPANEL_CSS.indexOf('.item .more-btn'), SIDEPANEL_CSS.indexOf('@media (hover: none)'));
  assert.match(base, /opacity:\s*0/, '行尾按钮默认隐藏');
  assert.match(base, /\.item:hover \.more-btn,/, 'hover 浮现');
  assert.match(base, /\.item:focus-within \.more-btn/, '键盘聚焦浮现');
  assert.match(SIDEPANEL_CSS, /@media \(hover: none\)/, '触摸设备常显');
});

test('封面方框只放一个元素（照片或首字，不并存）', () => {
  const body = SIDEPANEL_JS.slice(SIDEPANEL_JS.indexOf('function coverContent'));
  const fn = body.slice(0, body.indexOf('\nfunction ', 10));
  assert.ok(fn.length > 0, '未找到 coverContent');
  assert.match(fn, /if \(!cover\) return initial;/, '没有 cover 时必须直接返回首字');
  assert.match(fn, /return photo;/, '有 cover 时必须只返回照片');
  assert.match(fn, /photo\.replaceWith\(initial\)/, '取不到图时才换成首字');
  assert.doesNotMatch(fn, /appendChild/, 'coverContent 不该往方框里追加第二个元素');
  assert.match(SIDEPANEL_CSS, /\.item__media \{[^}]*overflow:\s*hidden/s);
  assert.match(SIDEPANEL_CSS, /\.cover-photo\s*\{[^}]*object-fit:\s*cover/s);
  assert.match(SIDEPANEL_CSS, /\.cover-initial\s*\{/);
});

test('侧边栏与保存卡都走同一套封面逻辑', () => {
  assert.match(SIDEPANEL_JS, /coverContent\(\{\s*title:[^}]*cover:\s*item\.cover/s, '书签行封面要走 coverContent');
  assert.match(SIDEPANEL_JS, /coverContent\(\{[\s\S]{0,200}?cover:\s*tab\?\.favIconUrl/s, '保存卡封面要走 coverContent');
  assert.match(SIDEPANEL_HTML, /id="saveArt"/, '保存卡需要一个由 JS 填充的方框');
  assert.doesNotMatch(SIDEPANEL_JS, /applyFavicon|saveFavicon/, '旧的 favicon 开关逻辑应已删除');
});

/**
 * 抄参考 sprite 最容易犯的错：连「业务语义」一起抄过来。
 * 参考项目是音乐播放器，它的 i-note / i-play / i-album 之类在书签管理器里全是错的。
 */
test('面板不出现播放器语义的图标', () => {
  const playerIcons = ['i-note', 'i-play', 'i-pause', 'i-shuffle', 'i-backward',
    'i-forward', 'i-lyrics', 'i-speaker', 'i-album', 'i-apple', 'i-appmusic-app', 'i-tv'];
  for (const name of playerIcons) {
    assert.doesNotMatch(SIDEPANEL_HTML, new RegExp(`<symbol id="${name}"`),
      `书签管理器不该出现播放器图标 ${name}`);
  }
  assert.match(SIDEPANEL_JS, /coverContent/, '没有 favicon 时用标题首字兜底');
});

test('封面取不到图时降级为首字', () => {
  assert.match(SIDEPANEL_JS, /addEventListener\('error', fallback/, '图片失败时要换成首字');
  assert.match(SIDEPANEL_JS, /naturalWidth/, '还要处理「200 但 naturalWidth 为 0」的图片');
});

test('hover 反馈不靠位移，避免滚动时的抖动', () => {
  for (const [name, css] of [['sidepanel.css', SIDEPANEL_CSS], ['options.css', OPTIONS_CSS]]) {
    assert.doesNotMatch(css, /translateY\(-1px\)/, `${name} 仍在使用位移 hover`);
  }
});

test('无障碍偏好：减少动态、减少透明与高对比都有处理', () => {
  // 三个守卫全部在 ui-base.css；vendor 层的 backdrop-filter 材质
  // 依赖这里的加厚兜底，不许在别处单独开一份。
  assert.match(UI_BASE_CSS, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(UI_BASE_CSS, /@media \(prefers-reduced-transparency: reduce\)/);
  assert.match(UI_BASE_CSS, /@media \(prefers-contrast: more\)/);
  assert.doesNotMatch(SOLID_GLASS_CSS, /@media \(prefers-(reduced-transparency|contrast)/,
    'vendor 层不应重复无障碍守卫');
  // theme.js 实时同步 prefers-reduced-* 到 html class（双层的运行时半边）。
  assert.match(THEME_JS, /prefers-reduced-motion: reduce/, 'theme.js 应监听减少动态');
  assert.match(THEME_JS, /prefers-reduced-transparency: reduce/, 'theme.js 应监听减少透明');
  assert.match(THEME_JS, /classList\.toggle\('is-reduced-motion'/, '减少动态写入 html class');
  assert.match(THEME_JS, /classList\.toggle\('is-reduced-transparency'/, '减少透明写入 html class');
});

// --- CSP 契约 --------------------------------------------------------------

test('HTML 不含内联脚本与内联事件处理器', () => {
  for (const name of ['sidepanel.html', 'options.html']) {
    const html = read(name);
    assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)[^>]*>/i, `${name} 含内联脚本`);
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, `${name} 含内联事件处理器`);
  }
});
