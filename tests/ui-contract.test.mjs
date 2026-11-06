import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 界面层的静态契约。浏览器扩展没有渲染测试，所以用源码断言把两类最易漂移的
// 东西钉住：JS 与 HTML 之间的 id/图标契约，以及「样式确实复用了参考项目」这件事。

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFileSync(join(root, name), 'utf8');

const SIDEPANEL_HTML = read('sidepanel.html');
const SIDEPANEL_JS = read('sidepanel.js');
const SIDEPANEL_CSS = read('sidepanel.css');
const OPTIONS_HTML = read('options.html');
const OPTIONS_JS = read('options.js');
const OPTIONS_CSS = read('options.css');
const UI_BASE_CSS = read('ui-base.css');
const APPLE_MUSIC_CSS = read('apple-music.css');

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
    'ui-base.css': UI_BASE_CSS
  };
  for (const [name, source] of Object.entries(sources)) {
    const found = BANNED_GLYPHS.filter(glyph => source.includes(glyph));
    assert.deepEqual(found, [], `${name} 仍包含符号型图标：${found.join(' ')}`);
  }
});

// --- 复用参考项目样式 ------------------------------------------------------

test('两个页面都先引入 vendor 的 apple-music.css', () => {
  for (const name of ['sidepanel.html', 'options.html']) {
    const html = read(name);
    const vendor = html.indexOf('href="apple-music.css"');
    const base = html.indexOf('href="ui-base.css"');
    const own = html.search(/href="(sidepanel|options)\.css"/);
    assert.ok(vendor > -1, `${name} 未引入 apple-music.css`);
    assert.ok(base > vendor, `${name} 的 ui-base.css 应在 apple-music.css 之后`);
    assert.ok(own > base, `${name} 的自身样式表应在最后`);
  }
});

// 这条是「真的复用了参考项目的样式」而不是「学了个风格」的守门人：
// 一旦有人把手写样式换回自创类名，测试就会失败。
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
  assert.match(APPLE_MUSIC_CSS, /commit be958b4fba80a7d2e6bfbacb12d025c3641d24c3/, 'apple-music.css 缺少来源 commit');
  assert.match(APPLE_MUSIC_CSS, /逐字 vendor/, 'apple-music.css 缺少「不要手工微调」的说明');
  // 抽查参考项目的原始取值，任何一处被改都会在这里暴露。
  for (const token of [
    '--bg: #1f1f1f;',
    '--nav-bg: rgba(38, 38, 40, 0.6);',
    '--player-bg: rgba(45, 45, 45, 0.88);',
    '--hairline: rgba(255, 255, 255, 0.08);',
    '--panel-shadow: 0 8px 32px rgba(0, 0, 0, 0.28);'
  ]) {
    assert.ok(APPLE_MUSIC_CSS.includes(token), `apple-music.css 丢失参考取值：${token}`);
  }
  // 参考项目本文里不应再出现未改写的主题媒体查询：只允许 token 块那一处保留
  // 媒体查询结构（theme.js 异步解析设置，首帧靠它避免闪主题）。
  const withoutComments = APPLE_MUSIC_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const mediaQueries = matches(withoutComments, /@media \(prefers-color-scheme: (\w+)\)/g);
  assert.deepEqual(mediaQueries, ['light'], `主题媒体查询应只剩 token 块那一处，实际：${mediaQueries.join(', ')}`);
});

test('页面样式表只做几何覆盖，不重复定义主题 token', () => {
  for (const [name, css] of [['sidepanel.css', SIDEPANEL_CSS], ['options.css', OPTIONS_CSS]]) {
    assert.doesNotMatch(css, /data-theme-color=/, `${name} 不应重复定义主题色映射`);
    assert.doesNotMatch(css, /--nav-bg:/, `${name} 不应重复定义参考 token`);
  }
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
  assert.match(UI_BASE_CSS, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(UI_BASE_CSS, /@media \(prefers-reduced-transparency: reduce\)/);
  assert.match(UI_BASE_CSS, /@media \(prefers-contrast: more\)/);
});

// --- CSP 契约 --------------------------------------------------------------

test('HTML 不含内联脚本与内联事件处理器', () => {
  for (const name of ['sidepanel.html', 'options.html']) {
    const html = read(name);
    assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)[^>]*>/i, `${name} 含内联脚本`);
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, `${name} 含内联事件处理器`);
  }
});
