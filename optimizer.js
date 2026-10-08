import { getRaindrop, updateRaindrop } from './api.js';
import {
  DEFAULT_OPTIMIZE_SETTINGS,
  EXCERPT_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  clampLength,
  extractJsonObject,
  normalizeOptimizeSettings,
  optimizeBookmarkFields
} from './utils.mjs';

const OPTIMIZE_STORAGE_KEYS = [
  'optimizeEnabled',
  'optimizeMode',
  'optimizeApiKey',
  'optimizeApiModel',
  'optimizeApiBase',
  'optimizeApiLanguage'
];

// Raindrop parses link metadata in the background, so the description and cover
// are not present on the create response. Wait for them before optimizing.
const PARSE_POLL_INTERVAL = 1200;
const PARSE_POLL_ATTEMPTS = 6;
const AI_REQUEST_TIMEOUT = 30000;

export async function loadOptimizeSettings() {
  const stored = await chrome.storage.local.get(OPTIMIZE_STORAGE_KEYS);
  return normalizeOptimizeSettings({ ...DEFAULT_OPTIMIZE_SETTINGS, ...stored });
}

export async function saveOptimizeSettings(changes = {}) {
  const current = await loadOptimizeSettings();
  const next = normalizeOptimizeSettings({ ...current, ...changes });
  await chrome.storage.local.set({
    optimizeEnabled: next.optimizeEnabled,
    optimizeMode: next.optimizeMode,
    optimizeApiKey: next.optimizeApiKey,
    optimizeApiModel: next.optimizeApiModel,
    optimizeApiBase: next.optimizeApiBase,
    optimizeApiLanguage: next.optimizeApiLanguage
  });
  return next;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Poll until Raindrop has filled in the metadata it fetches from the page.
 * Only `excerpt` and `cover` count: `type` is already populated on the create
 * response, so including it would make every poll succeed immediately.
 * Returns the freshest item, or null when the page never produced one.
 */
async function waitForParsedItem(raindropId) {
  let item = null;
  for (let attempt = 0; attempt < PARSE_POLL_ATTEMPTS; attempt += 1) {
    item = await getRaindrop(raindropId);
    const parsed = Boolean(item?.excerpt || item?.cover);
    if (parsed || attempt === PARSE_POLL_ATTEMPTS - 1) return item;
    await delay(PARSE_POLL_INTERVAL);
  }
  return item;
}

function languageLabel(id) {
  if (id === 'zh') return '简体中文';
  if (id === 'en') return 'English';
  return 'the same language as the input';
}

async function requestAiRewrite(settings, fields) {
  const base = settings.optimizeApiBase.replace(/\/+$/, '');
  // Without a timeout a hung endpoint would leave this promise pending forever.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT);
  const prompt = [
    `Write the excerpt in ${languageLabel(settings.optimizeApiLanguage)}.`,
    'Remove the site name and SEO noise from the title. Keep it under 80 characters.',
    `Describe the page in one or two sentences, at most ${EXCERPT_MAX_LENGTH} characters, with no marketing filler.`,
    'Reply with JSON only, using exactly the keys "title" and "excerpt".',
    '',
    `URL: ${fields.link}`,
    `Domain: ${fields.domain || ''}`,
    `Current title: ${fields.title || ''}`,
    `Current excerpt: ${fields.excerpt || ''}`
  ].join('\n');

  let response;
  try {
    response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.optimizeApiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: settings.optimizeApiModel,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: 'You rewrite bookmark titles and excerpts. You always reply with a single JSON object.'
          },
          { role: 'user', content: prompt }
        ]
      })
    });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('AI 请求超时');
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let detail = '';
    try {
      const errorBody = await response.json();
      detail = errorBody?.error?.message || errorBody?.message || '';
    } catch (_) {
      // Body is not JSON; the status alone is enough.
    }
    throw new Error(`AI 优化失败（HTTP ${response.status}）${detail ? `：${detail}` : ''}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '';
  return extractJsonObject(content);
}

function runLocalOptimization(item) {
  const optimized = optimizeBookmarkFields({
    title: item.title,
    excerpt: item.excerpt,
    link: item.link
  });
  return {
    updates: {
      title: clampLength(optimized.title, TITLE_MAX_LENGTH),
      excerpt: clampLength(optimized.excerpt, EXCERPT_MAX_LENGTH)
    },
    changed: optimized.changed
  };
}

async function runAiOptimization(settings, item) {
  const rewrite = await requestAiRewrite(settings, {
    link: item.link,
    domain: item.domain,
    title: item.title,
    excerpt: item.excerpt
  });
  if (!rewrite) throw new Error('AI 未返回可解析的 JSON');

  const updates = {
    title: clampLength(rewrite.title, TITLE_MAX_LENGTH),
    excerpt: clampLength(rewrite.excerpt, EXCERPT_MAX_LENGTH)
  };
  // An empty rewrite would erase good metadata; keep whatever the page provided.
  if (!updates.title) updates.title = item.title;
  if (!updates.excerpt) updates.excerpt = item.excerpt;

  return { updates, changed: updates.title !== item.title || updates.excerpt !== item.excerpt };
}

/**
 * Optimize a freshly created bookmark. Never throws: a failed optimization must
 * not turn a successful save into an error.
 */
export async function optimizeCreatedRaindrop(raindrop) {
  if (!raindrop?._id) return { status: 'skipped', reason: 'no-id' };

  try {
    const settings = await loadOptimizeSettings();
    if (!settings.optimizeEnabled) return { status: 'skipped', reason: 'disabled' };

    const item = await waitForParsedItem(raindrop._id);
    if (!item?.link) return { status: 'skipped', reason: 'no-item' };

    const result = settings.optimizeMode === 'ai'
      ? await runAiOptimization(settings, item)
      : runLocalOptimization(item);

    if (!result.changed) return { status: 'unchanged' };
    await updateRaindrop(raindrop._id, result.updates);
    return { status: 'optimized' };
  } catch (error) {
    console.error('书签优化失败：', error);
    return { status: 'failed', message: error.message || '优化失败' };
  }
}