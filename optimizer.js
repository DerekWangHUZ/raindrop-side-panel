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
  'optimizeMode',
  'optimizeApiKey',
  'optimizeApiModel',
  'optimizeApiBase',
  'optimizeApiLanguage'
];

const AI_REQUEST_TIMEOUT = 30000;

export async function loadOptimizeSettings() {
  const stored = await chrome.storage.local.get(OPTIMIZE_STORAGE_KEYS);
  return normalizeOptimizeSettings({ ...DEFAULT_OPTIMIZE_SETTINGS, ...stored });
}

export async function saveOptimizeSettings(changes = {}) {
  const current = await loadOptimizeSettings();
  const next = normalizeOptimizeSettings({ ...current, ...changes });
  await chrome.storage.local.set({
    optimizeMode: next.optimizeMode,
    optimizeApiKey: next.optimizeApiKey,
    optimizeApiModel: next.optimizeApiModel,
    optimizeApiBase: next.optimizeApiBase,
    optimizeApiLanguage: next.optimizeApiLanguage
  });
  return next;
}

function languageLabel(id) {
  if (id === 'zh') return '简体中文';
  if (id === 'en') return 'English';
  return 'the same language as the input';
}

async function requestAiRewrite(settings, fields) {
  const base = settings.optimizeApiBase.replace(/\/+$/, '');
  if (!settings.optimizeApiKey) throw new Error('尚未填写 API Key');

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

function domainFromLink(link) {
  try {
    return new URL(link).hostname.replace(/^www\./i, '');
  } catch (_) {
    return '';
  }
}

function runLocalOptimization({ link, title, excerpt }) {
  const optimized = optimizeBookmarkFields({ title, excerpt, link });
  return {
    title: clampLength(optimized.title, TITLE_MAX_LENGTH),
    excerpt: clampLength(optimized.excerpt, EXCERPT_MAX_LENGTH),
    changed: optimized.changed
  };
}

async function runAiOptimization(settings, { link, title, excerpt }) {
  const rewrite = await requestAiRewrite(settings, {
    link,
    domain: domainFromLink(link),
    title,
    excerpt
  });
  if (!rewrite) throw new Error('AI 未返回可解析的 JSON');

  const result = {
    title: clampLength(rewrite.title, TITLE_MAX_LENGTH),
    excerpt: clampLength(rewrite.excerpt, EXCERPT_MAX_LENGTH)
  };
  // An empty rewrite would erase good metadata; keep whatever we started with.
  if (!result.title) result.title = title;
  if (!result.excerpt) result.excerpt = excerpt;

  return { ...result, changed: result.title !== title || result.excerpt !== excerpt };
}

/**
 * Optimize title and excerpt with the configured mode. Returns the suggested
 * values plus a `changed` flag; it never writes to Raindrop, so the caller
 * stays in control of when the bookmark is updated.
 */
export async function optimizeFields(input = {}, options = {}) {
  const settings = options.settings || await loadOptimizeSettings();
  const source = {
    link: String(input.link || '').trim(),
    title: String(input.title || '').trim(),
    excerpt: String(input.excerpt || '')
  };

  if (!source.title && !source.excerpt) {
    return { title: source.title, excerpt: source.excerpt, changed: false };
  }

  const result = settings.optimizeMode === 'ai'
    ? await runAiOptimization(settings, source)
    : runLocalOptimization(source);

  return { ...result, changed: result.changed };
}