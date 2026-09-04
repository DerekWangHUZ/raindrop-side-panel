import assert from 'assert';
import { buildRaindropPayload } from '../api.js';
import {
  THEME_COLORS,
  THEME_MODES,
  chunkItems,
  DEFAULT_SORT,
  getItemCollectionId,
  groupItemsByCollection,
  normalizeTags,
  normalizeSort,
  parseBulkLines,
  SORT_OPTIONS
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
console.log('All v4 utility checks passed.');
