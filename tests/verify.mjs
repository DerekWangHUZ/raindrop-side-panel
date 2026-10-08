import assert from 'assert';
import { buildRaindropPayload } from '../api.js';
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

const parsed = parseBulkLines([
  'https://example.com',
  '示例页面 | https://example.com/article',
  'bad | ftp://example.com',
  'https://example.com/also-valid'
].join('\n'));
assert.deepStrictEqual(parsed.items, [
  { link: 'https://example.com', title: '' },
  { link: 'https://example.com/article', title: '示例页面' },
  { link: 'https://example.com/also-valid', title: '' }
]);
assert.strictEqual(parsed.errors.length, 1);
assert.strictEqual(parsed.errors[0].line, 3);

assert.deepStrictEqual(normalizeTags('one, two, one,, three'), ['one', 'two', 'three']);
assert.deepStrictEqual(chunkItems([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);

const grouped = groupItemsByCollection([
  { _id: 1, collection: { $id: 10 } },
  { _id: 2, collection: { $id: 10 } },
  { _id: 3, collection: { $id: 20 } },
  { _id: 4 }
]);
assert.deepStrictEqual([...grouped.keys()], [10, 20, -1]);
assert.deepStrictEqual(grouped.get(10).map(item => item._id), [1, 2]);
assert.strictEqual(getItemCollectionId({ collection: { $id: 0 } }), -1);

assert.deepStrictEqual(buildRaindropPayload({
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

assert.deepStrictEqual(Object.keys(THEME_COLORS), ['violet', 'blue', 'teal', 'green', 'orange', 'rose', 'gray']);
assert.deepStrictEqual(THEME_MODES.map(mode => mode.id), ['system', 'light', 'dark']);
assert.strictEqual(DEFAULT_SORT, '-created');
assert.deepStrictEqual(SORT_OPTIONS.map(option => option.id), [
  '-created', 'created', '-lastUpdate', '+lastUpdate', 'title', '-title', 'domain', '-domain', '-sort'
]);
assert.strictEqual(normalizeSort('title'), 'title');
assert.strictEqual(normalizeSort('unsupported'), DEFAULT_SORT);

// --- 自动优化：设置 ---------------------------------------------------------
assert.deepStrictEqual(OPTIMIZE_MODES.map(mode => mode.id), ['local', 'ai']);
assert.deepStrictEqual(OPTIMIZE_LANGUAGES.map(language => language.id), ['auto', 'zh', 'en']);
assert.strictEqual(DEFAULT_OPTIMIZE_SETTINGS.optimizeMode, 'local');
// 优化改为按钮触发，不再有启用开关。
assert.ok(!('optimizeEnabled' in DEFAULT_OPTIMIZE_SETTINGS));
assert.ok(!('optimizeEnabled' in normalizeOptimizeSettings({ optimizeEnabled: true })));

// 旧存储中的 optimizeEnabled 被忽略；旧的 "off" 模式回落到默认模式。
assert.deepStrictEqual(
  normalizeOptimizeSettings({ optimizeEnabled: true, optimizeMode: 'off' }),
  normalizeOptimizeSettings({})
);
// 未知模式回退到默认模式。
assert.strictEqual(normalizeOptimizeSettings({ optimizeMode: 'nope' }).optimizeMode, 'local');
assert.strictEqual(normalizeOptimizeSettings({ optimizeApiLanguage: 'klingon' }).optimizeApiLanguage, 'auto');
assert.strictEqual(normalizeOptimizeSettings({ optimizeApiKey: '  sk-1  ' }).optimizeApiKey, 'sk-1');

// --- 自动优化：标题规则 -----------------------------------------------------
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
  assert.strictEqual(optimizeTitle(input, link).title, expected, `标题优化：${input}`);
}

// 不应误伤：站点名不在结尾、无站点信息、单词内连字符。
assert.strictEqual(optimizeTitle('Vite', 'https://vitejs.dev/').title, 'Vite');
assert.strictEqual(optimizeTitle('Stack Overflow is great', 'https://stackoverflow.com/q/1').title, 'Stack Overflow is great');
assert.strictEqual(optimizeTitle('E-commerce Growth | Example', 'https://example.com/x').title, 'E-commerce Growth | Example');
assert.strictEqual(optimizeTitle('AWS re:Invent 2024', 'https://aws.amazon.com/x').title, 'AWS re:Invent 2024');
assert.strictEqual(optimizeTitle('', 'https://a.com').title, '');
assert.strictEqual(optimizeTitle('Keep me', '').title, 'Keep me');
// 域名中的点必须保持字面量，"examplecom" 不是 "example.com"。
assert.strictEqual(optimizeTitle('Foo - examplecom', 'https://example.com/x').title, 'Foo - examplecom');

// changed 标记必须与实际结果一致。
assert.strictEqual(optimizeTitle('Vite', 'https://vitejs.dev/').changed, false);
assert.strictEqual(optimizeTitle('Vite - vitejs.dev', 'https://vitejs.dev/').changed, true);

const longTitle = 'x'.repeat(TITLE_MAX_LENGTH + 200);
assert.strictEqual(optimizeTitle(longTitle, 'https://a.com').title.length, TITLE_MAX_LENGTH);

// --- 自动优化：摘要规则 -----------------------------------------------------
assert.strictEqual(optimizeExcerpt('Share this: A short summary.', 'T').excerpt, 'A short summary.');
assert.strictEqual(optimizeExcerpt('Advertisement: buy now', 'T').excerpt, 'buy now');
assert.strictEqual(optimizeExcerpt('Ad: cheap hosting', 'T').excerpt, 'cheap hosting');
assert.strictEqual(optimizeExcerpt('Sponsored post about X', 'T').excerpt, 'post about X');
// 连字符开头的 "Ad" 是正文，不是广告噪声。
assert.strictEqual(optimizeExcerpt('Ad-free hosting is cheap', 'T').excerpt, 'Ad-free hosting is cheap');
assert.strictEqual(optimizeExcerpt('Ad-based tools', 'T').excerpt, 'Ad-based tools');
assert.strictEqual(optimizeExcerpt('Advice for beginners', 'T').excerpt, 'Advice for beginners');
assert.strictEqual(optimizeExcerpt('Add more detail', 'T').excerpt, 'Add more detail');

assert.deepStrictEqual(optimizeExcerpt('same as title', 'Same As Title'), { excerpt: '', changed: true });
assert.deepStrictEqual(optimizeExcerpt('', 'T'), { excerpt: '', changed: false });
assert.strictEqual(optimizeExcerpt('a '.repeat(900), '').excerpt.length <= EXCERPT_MAX_LENGTH, true);

// 剥掉噪声后不剩任何有效内容时，结果为空而不是残留噪声。
for (const noise of ['Share this:', 'Read more', 'Advertisement', 'Cookie policy', 'Ad:']) {
  assert.strictEqual(optimizeExcerpt(noise, 'A Real Title').excerpt, '', `纯噪声：${noise}`);
}
// --- 回归：新建时描述与裸标题相同不应被误删 -------------------------------
// 页面标题带站点名后缀，描述往往正是去掉后缀后的那句话。
const createCase = optimizeBookmarkFields({
  title: '深入理解 CSS Grid - 少数派',
  excerpt: '深入理解 CSS Grid',
  link: 'https://sspai.com/post/12345'
});
assert.strictEqual(createCase.title, '深入理解 CSS Grid');
assert.strictEqual(createCase.excerpt, '深入理解 CSS Grid', '新建时描述不应被当成重复标题删除');

// 编辑场景下描述确实等于标题时，仍然要去重。
assert.strictEqual(
  optimizeBookmarkFields({ title: '深入理解 Grid', excerpt: '深入理解 Grid', link: 'https://sspai.com/p' }).excerpt,
  ''
);

const combined = optimizeBookmarkFields({
  title: 'Foo - Bar',
  link: 'https://blog.bar.com',
  excerpt: 'Share this: useful text'
});
assert.deepStrictEqual(combined, { title: 'Foo', excerpt: 'useful text', changed: true });
assert.strictEqual(optimizeBookmarkFields({ title: 'Vite', link: 'https://vitejs.dev/', excerpt: '' }).changed, false);

assert.strictEqual(siteNameFromLink('https://www.example.co.uk/x'), 'example');
assert.strictEqual(siteNameFromLink('https://blog.example.com/x'), 'example');
assert.strictEqual(siteNameFromLink('https://example.com/x'), 'example.com');
assert.strictEqual(siteNameFromLink('not a url'), '');

// --- 自动优化：AI 响应解析与长度限制 ---------------------------------------
assert.deepStrictEqual(extractJsonObject('{"title":"A","excerpt":"B"}'), { title: 'A', excerpt: 'B' });
assert.deepStrictEqual(extractJsonObject('```json\n{"title":"A"}\n```'), { title: 'A' });
assert.deepStrictEqual(extractJsonObject('Sure! {"title":"A"} hope that helps'), { title: 'A' });
assert.strictEqual(extractJsonObject('no json here'), null);
assert.strictEqual(extractJsonObject(''), null);
assert.strictEqual(extractJsonObject('{ broken'), null);

assert.strictEqual(clampLength('  spaced   out  ', 100), 'spaced out');
assert.strictEqual(clampLength('abcdef', 3), 'abc');

// --- 自动优化：optimizeFields 纯函数行为 ------------------------------------
// optimizer.js 只用到 chrome.storage 与 fetch，打桩后可直接引入。
globalThis.chrome = {
  storage: { local: { async get() { return {}; }, async set() {} } }
};
const { optimizeFields } = await import('../optimizer.js');

const LOCAL = { optimizeMode: 'local' };
const AI = {
  optimizeMode: 'ai',
  optimizeApiKey: 'k',
  optimizeApiBase: 'https://api.openai.com/v1',
  optimizeApiModel: 'm',
  optimizeApiLanguage: 'zh'
};

assert.deepStrictEqual(
  await optimizeFields(
    { link: 'https://blog.example.com/p', title: 'Foo - Example', excerpt: 'Share this: hi' },
    { settings: LOCAL }
  ),
  { title: 'Foo', excerpt: 'hi', changed: true }
);
assert.deepStrictEqual(
  await optimizeFields({ link: 'https://vitejs.dev/', title: 'Vite', excerpt: 'Nice.' }, { settings: LOCAL }),
  { title: 'Vite', excerpt: 'Nice.', changed: false }
);
assert.deepStrictEqual(
  await optimizeFields({ link: '' }, { settings: LOCAL }),
  { title: '', excerpt: '', changed: false }
);
// 新建收藏时只有标题，优化不应凭空造出摘要。
assert.deepStrictEqual(
  await optimizeFields({ link: 'https://github.com/a/b', title: 'Some repo - GitHub' }, { settings: LOCAL }),
  { title: 'Some repo', excerpt: '', changed: true }
);

// AI：正常、空回复保留原值、不可解析、缺 Key。
const aiReply = original => {
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    async json() { return { choices: [{ message: { content: original } }] }; }
  });
};

aiReply('{"title":"优化标题","excerpt":"优化摘要。"}');
assert.deepStrictEqual(
  await optimizeFields({ link: 'https://a.com/x', title: 'T', excerpt: 'E' }, { settings: AI }),
  { title: '优化标题', excerpt: '优化摘要。', changed: true }
);
aiReply('{"title":"","excerpt":""}');
assert.deepStrictEqual(
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

console.log('All utility checks passed.');
