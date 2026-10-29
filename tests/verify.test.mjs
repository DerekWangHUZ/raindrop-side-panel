import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RaindropApiError,
  apiFetch,
  buildRaindropPayload,
  clearUserCache,
  getUser,
  isRetryableStatus,
  retryDelayMs
} from '../api.js';
import {
  DEFAULT_OPTIMIZE_SETTINGS,
  EXCERPT_MAX_LENGTH,
  OPTIMIZE_LANGUAGES,
  OPTIMIZE_MODES,
  THEME_COLORS,
  THEME_MODES,
  chunkItems,
  clampLength,
  DEFAULT_SORT,
  extractJsonObject,
  getItemCollectionId,
  groupItemsByCollection,
  normalizeOptimizeSettings,
  normalizeTags,
  normalizeSort,
  optimizeBookmarkFields,
  optimizeExcerpt,
  optimizeTitle,
  parseBulkLines,
  siteNameFromLink,
  SORT_OPTIONS,
  TITLE_MAX_LENGTH
} from '../utils.mjs';
import { optimizeFields } from '../optimizer.js';

const jsonResponse = (body, init = {}) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'content-type': 'application/json' },
  ...init
});

// --- 批量输入解析 ----------------------------------------------------------
test('批量输入：URL、“标题 | URL”与错误行', () => {
  const parsed = parseBulkLines([
    'https://example.com',
    '示例页面 | https://example.com/article',
    'bad | ftp://example.com',
    'https://example.com/also-valid'
  ].join('\n'));
  assert.deepEqual(parsed.items, [
    { link: 'https://example.com', title: '' },
    { link: 'https://example.com/article', title: '示例页面' },
    { link: 'https://example.com/also-valid', title: '' }
  ]);
  assert.equal(parsed.errors.length, 1);
  assert.equal(parsed.errors[0].line, 3);
});

test('批量输入：URL 自带管道符时不当作标题分隔符', () => {
  const parsed = parseBulkLines([
    'https://example.com/a|b',
    '标题 | https://example.com/a|b',
    '仅一个词'
  ].join('\n'));
  assert.deepEqual(parsed.items[0], { link: 'https://example.com/a|b', title: '' });
  assert.deepEqual(parsed.items[1], { link: 'https://example.com/a|b', title: '标题' });
  // 无管道符但也不是 URL 的行仍应报错。
  assert.equal(parsed.errors.length, 1);
  assert.equal(parsed.errors[0].line, 3);
});

test('标签、分块工具函数', () => {
  assert.deepEqual(normalizeTags('one, two, one,, three'), ['one', 'two', 'three']);
  assert.deepEqual(chunkItems([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

// --- 收藏夹分组 ------------------------------------------------------------
test('按收藏夹分组与集合 ID 归一化', () => {
  const grouped = groupItemsByCollection([
    { _id: 1, collection: { $id: 10 } },
    { _id: 2, collection: { $id: 10 } },
    { _id: 3, collection: { $id: 20 } },
    { _id: 4 }
  ]);
  assert.deepEqual([...grouped.keys()], [10, 20, -1]);
  assert.deepEqual(grouped.get(10).map(item => item._id), [1, 2]);
  assert.equal(getItemCollectionId({ collection: { $id: 0 } }), -1);
});

// --- 请求体构建 ------------------------------------------------------------
test('buildRaindropPayload 归一化', () => {
  assert.deepEqual(buildRaindropPayload({
    link: 'https://example.com',
    title: ' Example ',
    collectionId: 0,
    tags: 'one, two, one',
    note: 'note'
  }), {
    link: 'https://example.com',
    title: 'Example',
    collection: { $id: -1 },
    pleaseParse: {},
    tags: ['one', 'two'],
    note: 'note'
  });
});

// --- 常量表 ----------------------------------------------------------------
test('主题、排序常量表', () => {
  assert.deepEqual(Object.keys(THEME_COLORS), ['violet', 'blue', 'teal', 'green', 'orange', 'rose', 'gray']);
  assert.deepEqual(THEME_MODES.map(mode => mode.id), ['system', 'light', 'dark']);
  assert.equal(DEFAULT_SORT, '-created');
  assert.deepEqual(SORT_OPTIONS.map(option => option.id), [
    '-created', 'created', '-lastUpdate', '+lastUpdate', 'title', '-title', 'domain', '-domain', '-sort'
  ]);
  assert.equal(normalizeSort('title'), 'title');
  assert.equal(normalizeSort('unsupported'), DEFAULT_SORT);
});

// --- 优化设置 --------------------------------------------------------------
test('优化设置：模式与语言白名单', () => {
  assert.deepEqual(OPTIMIZE_MODES.map(mode => mode.id), ['local', 'ai']);
  assert.deepEqual(OPTIMIZE_LANGUAGES.map(language => language.id), ['auto', 'zh', 'en']);
  assert.equal(DEFAULT_OPTIMIZE_SETTINGS.optimizeMode, 'local');
  // 未知模式回退到默认模式。
  assert.equal(normalizeOptimizeSettings({ optimizeMode: 'nope' }).optimizeMode, 'local');
  assert.equal(normalizeOptimizeSettings({ optimizeApiLanguage: 'klingon' }).optimizeApiLanguage, 'auto');
  assert.equal(normalizeOptimizeSettings({ optimizeApiKey: '  sk-1  ' }).optimizeApiKey, 'sk-1');
});

test('优化设置：显式清空的 API 地址保持为空，不回落默认地址', () => {
  assert.equal(normalizeOptimizeSettings({ optimizeApiBase: '' }).optimizeApiBase, '');
  assert.equal(normalizeOptimizeSettings({ optimizeApiBase: '  ' }).optimizeApiBase, '');
  // 未提供时使用默认地址。
  assert.equal(normalizeOptimizeSettings({}).optimizeApiBase, DEFAULT_OPTIMIZE_SETTINGS.optimizeApiBase);
});

// --- 标题规则 --------------------------------------------------------------
test('标题优化：剥离站点名后缀', () => {
  const titleCases = [
    ['Best Practices 2024 - Stack Overflow', 'https://stackoverflow.com/questions/1', 'Best Practices 2024'],
    ['Medium - How to cook', 'https://medium.com/@x/how-to-cook', 'How to cook'],
    ['Deno 2.0 released | Hacker News', 'https://news.ycombinator.com/item?id=1', 'Deno 2.0 released'],
    ['中文标题 - 少数派', 'https://sspai.com/p/1', '中文标题'],
    ['Build a CLI in Rust - GitHub', 'https://github.com/foo/bar', 'Build a CLI in Rust'],
    ['Title — site.com', 'https://www.site.com/bar', 'Title'],
    ['siteName - Real Title', 'https://blog.siteName.com/p', 'Real Title'],
    ['- Leading dash title', 'https://x.com/a', 'Leading dash title'],
    ['Trailing dash -', 'https://a.com', 'Trailing dash'],
    ['   spaced    out   title   ', 'https://a.com', 'spaced out title']
  ];
  for (const [input, link, expected] of titleCases) {
    assert.equal(optimizeTitle(input, link).title, expected, `标题优化：${input}`);
  }
});

test('标题优化：不应误伤的用例', () => {
  // 站点名不在结尾、无站点信息、单词内连字符。
  assert.equal(optimizeTitle('Vite', 'https://vitejs.dev/').title, 'Vite');
  assert.equal(optimizeTitle('Stack Overflow is great', 'https://stackoverflow.com/q/1').title, 'Stack Overflow is great');
  assert.equal(optimizeTitle('E-commerce Growth | Example', 'https://example.com/x').title, 'E-commerce Growth | Example');
  assert.equal(optimizeTitle('AWS re:Invent 2024', 'https://aws.amazon.com/x').title, 'AWS re:Invent 2024');
  assert.equal(optimizeTitle('', 'https://a.com').title, '');
  assert.equal(optimizeTitle('Keep me', '').title, 'Keep me');
  // 域名中的点必须保持字面量，"examplecom" 不是 "example.com"。
  assert.equal(optimizeTitle('Foo - examplecom', 'https://example.com/x').title, 'Foo - examplecom');
});

test('标题优化：changed 标记与长度截断', () => {
  assert.equal(optimizeTitle('Vite', 'https://vitejs.dev/').changed, false);
  assert.equal(optimizeTitle('Vite - vitejs.dev', 'https://vitejs.dev/').changed, true);
  const longTitle = 'x'.repeat(TITLE_MAX_LENGTH + 200);
  assert.equal(optimizeTitle(longTitle, 'https://a.com').title.length, TITLE_MAX_LENGTH);
});

// --- 摘要规则 --------------------------------------------------------------
test('摘要优化：去噪声前缀', () => {
  assert.equal(optimizeExcerpt('Share this: A short summary.', 'T').excerpt, 'A short summary.');
  assert.equal(optimizeExcerpt('Advertisement: buy now', 'T').excerpt, 'buy now');
  assert.equal(optimizeExcerpt('Ad: cheap hosting', 'T').excerpt, 'cheap hosting');
  assert.equal(optimizeExcerpt('Sponsored post about X', 'T').excerpt, 'post about X');
  // 连字符开头的 "Ad" 是正文，不是广告噪声。
  assert.equal(optimizeExcerpt('Ad-free hosting is cheap', 'T').excerpt, 'Ad-free hosting is cheap');
  assert.equal(optimizeExcerpt('Ad-based tools', 'T').excerpt, 'Ad-based tools');
  assert.equal(optimizeExcerpt('Advice for beginners', 'T').excerpt, 'Advice for beginners');
  assert.equal(optimizeExcerpt('Add more detail', 'T').excerpt, 'Add more detail');
});

test('摘要优化：与标题重复、空值与截断', () => {
  assert.deepEqual(optimizeExcerpt('same as title', 'Same As Title'), { excerpt: '', changed: true });
  assert.deepEqual(optimizeExcerpt('', 'T'), { excerpt: '', changed: false });
  assert.equal(optimizeExcerpt('a '.repeat(900), '').excerpt.length <= EXCERPT_MAX_LENGTH, true);
  // 剥掉噪声后不剩任何有效内容时，结果为空而不是残留噪声。
  for (const noise of ['Share this:', 'Read more', 'Advertisement', 'Cookie policy', 'Ad:']) {
    assert.equal(optimizeExcerpt(noise, 'A Real Title').excerpt, '', `纯噪声：${noise}`);
  }
});

test('新建时描述与裸标题相同，不当作重复删除', () => {
  // 页面标题带站点名后缀，描述往往正是去掉后缀后的那句话。
  const createCase = optimizeBookmarkFields({
    title: '深入理解 CSS Grid - 少数派',
    excerpt: '深入理解 CSS Grid',
    link: 'https://sspai.com/post/12345'
  });
  assert.equal(createCase.title, '深入理解 CSS Grid');
  assert.equal(createCase.excerpt, '深入理解 CSS Grid', '新建时描述不应被当成重复标题删除');

  // 编辑场景下描述确实等于标题时会去重。
  assert.equal(
    optimizeBookmarkFields({ title: '深入理解 Grid', excerpt: '深入理解 Grid', link: 'https://sspai.com/p' }).excerpt,
    ''
  );
});

test('字段组合优化', () => {
  const combined = optimizeBookmarkFields({
    title: 'Foo - Bar',
    link: 'https://blog.bar.com',
    excerpt: 'Share this: useful text'
  });
  assert.deepEqual(combined, { title: 'Foo', excerpt: 'useful text', changed: true });
  assert.equal(optimizeBookmarkFields({ title: 'Vite', link: 'https://vitejs.dev/', excerpt: '' }).changed, false);
});

test('siteNameFromLink 域名提取', () => {
  assert.equal(siteNameFromLink('https://www.example.co.uk/x'), 'example');
  assert.equal(siteNameFromLink('https://blog.example.com/x'), 'example');
  assert.equal(siteNameFromLink('https://example.com/x'), 'example.com');
  assert.equal(siteNameFromLink('not a url'), '');
});

// --- AI 响应解析与长度限制 --------------------------------------------------
test('extractJsonObject 与 clampLength', () => {
  assert.deepEqual(extractJsonObject('{"title":"A","excerpt":"B"}'), { title: 'A', excerpt: 'B' });
  assert.deepEqual(extractJsonObject('```json\n{"title":"A"}\n```'), { title: 'A' });
  assert.deepEqual(extractJsonObject('Sure! {"title":"A"} hope that helps'), { title: 'A' });
  assert.equal(extractJsonObject('no json here'), null);
  assert.equal(extractJsonObject(''), null);
  assert.equal(extractJsonObject('{ broken'), null);

  assert.equal(clampLength('  spaced   out  ', 100), 'spaced out');
  assert.equal(clampLength('abcdef', 3), 'abc');
});

// --- optimizeFields 纯函数行为 ----------------------------------------------
const LOCAL = { optimizeMode: 'local' };
const AI = {
  optimizeMode: 'ai',
  optimizeApiKey: 'k',
  optimizeApiBase: 'https://api.openai.com/v1',
  optimizeApiModel: 'm',
  optimizeApiLanguage: 'zh'
};

test('optimizeFields：本地模式', async () => {
  assert.deepEqual(
    await optimizeFields(
      { link: 'https://blog.example.com/p', title: 'Foo - Example', excerpt: 'Share this: hi' },
      { settings: LOCAL }
    ),
    { title: 'Foo', excerpt: 'hi', changed: true }
  );
  assert.deepEqual(
    await optimizeFields({ link: 'https://vitejs.dev/', title: 'Vite', excerpt: 'Nice.' }, { settings: LOCAL }),
    { title: 'Vite', excerpt: 'Nice.', changed: false }
  );
  assert.deepEqual(
    await optimizeFields({ link: '' }, { settings: LOCAL }),
    { title: '', excerpt: '', changed: false }
  );
  // 新建收藏时只有标题，优化不应凭空造出摘要。
  assert.deepEqual(
    await optimizeFields({ link: 'https://github.com/a/b', title: 'Some repo - GitHub' }, { settings: LOCAL }),
    { title: 'Some repo', excerpt: '', changed: true }
  );
});

const aiReply = original => {
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    async json() { return { choices: [{ message: { content: original } }] }; }
  });
};

test('optimizeFields：AI 正常、空回复保留原值、不可解析、缺 Key、缺地址', async () => {
  aiReply('{"title":"优化标题","excerpt":"优化摘要。"}');
  assert.deepEqual(
    await optimizeFields({ link: 'https://a.com/x', title: 'T', excerpt: 'E' }, { settings: AI }),
    { title: '优化标题', excerpt: '优化摘要。', changed: true }
  );
  aiReply('{"title":"","excerpt":""}');
  assert.deepEqual(
    await optimizeFields({ link: 'https://a.com/x', title: 'T', excerpt: 'E' }, { settings: AI }),
    { title: 'T', excerpt: 'E', changed: false }
  );
  aiReply('not json');
  await assert.rejects(
    () => optimizeFields({ link: 'https://a.com/x', title: 'T', excerpt: 'E' }, { settings: AI }),
    /AI 未返回可解析的 JSON/
  );
  await assert.rejects(
    () => optimizeFields({ link: 'https://a.com/x', title: 'T', excerpt: 'E' },
      { settings: { ...AI, optimizeApiKey: '' } }),
    /尚未填写 API Key/
  );
  // 显式清空的 API 地址不应回落到默认地址后继续请求。
  await assert.rejects(
    () => optimizeFields({ link: 'https://a.com/x', title: 'T', excerpt: 'E' },
      { settings: { ...AI, optimizeApiBase: '' } }),
    /尚未填写 API 地址/
  );
});

// --- apiFetch 重试策略 ------------------------------------------------------
test('重试策略：状态码与方法组合', () => {
  // 429/503 表示服务器未处理请求，写操作也可安全重试。
  assert.equal(isRetryableStatus(429, 'POST'), true);
  assert.equal(isRetryableStatus(503, 'DELETE'), true);
  assert.equal(isRetryableStatus(503, 'PUT'), true);
  // 500/502/504 可能已应用写入，只有幂等方法才重试。
  assert.equal(isRetryableStatus(500, 'POST'), false);
  assert.equal(isRetryableStatus(500, 'GET'), true);
  assert.equal(isRetryableStatus(502, 'get'), true);
  // 其他状态码与网络级失败不重试。
  assert.equal(isRetryableStatus(401, 'GET'), false);
  assert.equal(isRetryableStatus(404, 'GET'), false);
});

test('重试延迟：指数退避与 Retry-After 封顶', () => {
  assert.equal(retryDelayMs(0, null), 400);
  assert.equal(retryDelayMs(1, null), 800);
  assert.equal(retryDelayMs(0, '2'), 2000);
  assert.equal(retryDelayMs(0, '0'), 0);
  // 服务器给出的超大 Retry-After 被封顶，避免 UI 长时间挂起。
  assert.equal(retryDelayMs(0, '9999'), 5000);
  // 非数值头按指数退避处理。
  assert.equal(retryDelayMs(0, 'soon'), 400);
});

test('apiFetch：429 按 Retry-After 退避后成功', async () => {
  const calls = [];
  const delays = [];
  globalThis.fetch = async url => {
    calls.push(url);
    if (calls.length < 3) return new Response('', { status: 429, headers: { 'retry-after': '0' } });
    return jsonResponse({ result: true, items: [] });
  };
  const data = await apiFetch('/raindrops/0', {}, 'tok', {
    maxRetries: 2,
    sleepFn: ms => { delays.push(ms); }
  });
  assert.equal(calls.length, 3);
  assert.deepEqual(delays, [0, 0]);
  assert.deepEqual(data, { result: true, items: [] });
});

test('apiFetch：重试上限耗尽后抛出原状态码', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response('', { status: 429 }); };
  await assert.rejects(
    () => apiFetch('/user', {}, 'tok', { maxRetries: 2, sleepFn: () => {} }),
    error => error instanceof RaindropApiError && error.status === 429
  );
  assert.equal(calls, 3);
});

test('apiFetch：非幂等方法的 500 不重试', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response('', { status: 500 }); };
  await assert.rejects(
    () => apiFetch('/raindrop/1', { method: 'PUT', body: '{}' }, 'tok', { sleepFn: () => {} }),
    error => error instanceof RaindropApiError && error.status === 500
  );
  assert.equal(calls, 1);
});

test('apiFetch：幂等方法的 500 会重试', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls < 2 ? new Response('', { status: 500 }) : jsonResponse({ result: true });
  };
  const data = await apiFetch('/user', {}, 'tok', { maxRetries: 1, sleepFn: () => {} });
  assert.equal(calls, 2);
  assert.deepEqual(data, { result: true });
});

test('apiFetch：4xx 不重试，直接抛错', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response('', { status: 404 }); };
  await assert.rejects(
    () => apiFetch('/user', {}, 'tok', { sleepFn: () => {} }),
    error => error.status === 404
  );
  assert.equal(calls, 1);
});

// --- getUser 缓存 ------------------------------------------------------------
test('getUser：短 TTL 内复用缓存，force 时重新请求', async () => {
  clearUserCache();
  globalThis.chrome = {
    storage: { local: { async get() { return { raindropToken: 'tok' }; } } }
  };
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return jsonResponse({ user: { fullName: 'A' } }); };

  const first = await getUser();
  const second = await getUser();
  assert.equal(first.fullName, 'A');
  assert.equal(second.fullName, 'A');
  assert.equal(calls, 1);

  await getUser({ force: true });
  assert.equal(calls, 2);

  clearUserCache();
});
