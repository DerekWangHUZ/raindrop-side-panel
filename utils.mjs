export const THEME_COLORS = {
  violet: { label: '紫罗兰', light: '#6d5dfc', dark: '#8a7cff' },
  blue: { label: '蓝色', light: '#2563eb', dark: '#60a5fa' },
  teal: { label: '青色', light: '#0f766e', dark: '#2dd4bf' },
  green: { label: '绿色', light: '#15803d', dark: '#4ade80' },
  orange: { label: '橙色', light: '#c2410c', dark: '#fb923c' },
  rose: { label: '玫红', light: '#be123c', dark: '#fb7185' },
  gray: { label: '灰色', light: '#5f6368', dark: '#a3aab5' }
};

export const THEME_MODES = [
  { id: 'system', label: '跟随系统' },
  { id: 'light', label: '固定浅色' },
  { id: 'dark', label: '固定深色' }
];

export const DEFAULT_THEME_SETTINGS = {
  themeColor: 'violet',
  themeMode: 'system'
};

export const SORT_OPTIONS = [
  { id: '-created', label: '最近添加' },
  { id: 'created', label: '最早添加' },
  { id: '-lastUpdate', label: '最近更新' },
  { id: '+lastUpdate', label: '最早更新' },
  { id: 'title', label: '标题 A–Z' },
  { id: '-title', label: '标题 Z–A' },
  { id: 'domain', label: '域名 A–Z' },
  { id: '-domain', label: '域名 Z–A' },
  { id: '-sort', label: '自定义顺序' }
];

export const DEFAULT_SORT = '-created';

export function normalizeSort(value) {
  const candidate = String(value || '');
  return SORT_OPTIONS.some(option => option.id === candidate) ? candidate : DEFAULT_SORT;
}

// "off" is intentionally not offered as a mode: the settings checkbox already
// controls on/off, and a mode that disabled the feature would hide the only
// control able to switch it back on.
export const OPTIMIZE_MODES = [
  { id: 'local', label: '本地规则' },
  { id: 'ai', label: 'AI 模型' }
];

export const DEFAULT_OPTIMIZE_SETTINGS = {
  optimizeEnabled: false,
  optimizeMode: 'local',
  optimizeApiKey: '',
  optimizeApiModel: 'gpt-4o-mini',
  optimizeApiBase: 'https://api.openai.com/v1',
  optimizeApiLanguage: 'auto'
};

export const OPTIMIZE_LANGUAGES = [
  { id: 'auto', label: '跟随原文' },
  { id: 'zh', label: '中文' },
  { id: 'en', label: 'English' }
];

export const TITLE_MAX_LENGTH = 1000;
export const EXCERPT_MAX_LENGTH = 1000;

export function normalizeOptimizeSettings(settings = {}) {
  // A stored "off" predates the removal of that mode; fall back to "local".
  const candidate = settings.optimizeMode === 'off' ? DEFAULT_OPTIMIZE_SETTINGS.optimizeMode : settings.optimizeMode;
  const mode = OPTIMIZE_MODES.some(option => option.id === candidate)
    ? candidate
    : DEFAULT_OPTIMIZE_SETTINGS.optimizeMode;
  return {
    optimizeEnabled: Boolean(settings.optimizeEnabled),
    optimizeMode: mode,
    optimizeApiKey: String(settings.optimizeApiKey || '').trim(),
    optimizeApiModel: String(settings.optimizeApiModel || DEFAULT_OPTIMIZE_SETTINGS.optimizeApiModel).trim(),
    optimizeApiBase: String(settings.optimizeApiBase || DEFAULT_OPTIMIZE_SETTINGS.optimizeApiBase).trim(),
    optimizeApiLanguage: OPTIMIZE_LANGUAGES.some(option => option.id === settings.optimizeApiLanguage)
      ? settings.optimizeApiLanguage
      : DEFAULT_OPTIMIZE_SETTINGS.optimizeApiLanguage
  };
}

export function normalizeTags(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(values.map(tag => String(tag).trim()).filter(Boolean))];
}

export function parseBulkLines(input) {
  const items = [];
  const errors = [];
  const lines = String(input || '').split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;

    let title = '';
    let link = line;
    const titledLine = line.match(/^(.*?)\s*\|\s*(https?:\/\/\S+)$/i);
    if (titledLine) {
      title = titledLine[1].trim();
      link = titledLine[2].trim();
    } else if (line.includes('|')) {
      errors.push({ line: index + 1, message: '应为“标题 | URL”，且 URL 必须是 HTTP/HTTPS 地址' });
      return;
    }

    try {
      const url = new URL(link);
      if (!/^https?:$/i.test(url.protocol)) throw new Error('protocol');
    } catch (_) {
      errors.push({ line: index + 1, message: 'URL 无效，仅支持 HTTP/HTTPS 地址' });
      return;
    }

    items.push({ link, title });
  });

  return { items, errors };
}

export function getItemCollectionId(item) {
  const collectionId = Number(item?.collection?.$id ?? item?.collectionId);
  return Number.isFinite(collectionId) && collectionId !== 0 ? collectionId : -1;
}

export function groupItemsByCollection(items) {
  const groups = new Map();
  for (const item of items || []) {
    const collectionId = getItemCollectionId(item);
    if (!groups.has(collectionId)) groups.set(collectionId, []);
    groups.get(collectionId).push(item);
  }
  return groups;
}

export function chunkItems(items, size = 100) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function collapseWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

// Common second-level suffixes under a country-code TLD (e.g. "co.uk").
const MULTI_LEVEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'net.uk', 'sch.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'id.au',
  'com.br', 'com.cn', 'com.mx', 'com.tr', 'com.tw', 'co.jp', 'co.kr',
  'co.in', 'co.nz', 'co.za', 'com.sg', 'com.hk'
]);

function hostLabels(link) {
  try {
    return new URL(String(link || '')).hostname.replace(/^www\./i, '').toLowerCase().split('.').filter(Boolean);
  } catch (_) {
    return [];
  }
}

export function siteNameFromLink(link) {
  const labels = hostLabels(link);
  if (!labels.length) return '';
  if (labels.length <= 2) return labels.join('.');

  const lastTwo = labels.slice(-2).join('.');
  // "news.example.co.uk" should yield "example", not "co".
  if (MULTI_LEVEL_SUFFIXES.has(lastTwo)) return labels[labels.length - 3] || lastTwo;
  return labels[labels.length - 2];
}

// Every character class below escapes its own hyphens: a bare leading "-"
// would start a nested class and silently never match.
const TITLE_SEPARATOR_CLASS = '\\-\u2013\u2014_|｜·•:：»›';

function titleSeparatorVariants() {
  // The hyphen class must never match inside a word such as "e-commerce".
  const alternative = '(?:\\s*[\\-\u2013\u2014_]{1,2}\\s*)|(?:\\s*[|｜·•:：»›]\\s*)|(?:\\s*->\\s*)';
  return { alternative, charClass: TITLE_SEPARATOR_CLASS };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Brand names whose common title suffix does not match the domain spelling.
const KNOWN_SITE_NAMES = {
  'stackoverflow.com': 'Stack Overflow',
  'news.ycombinator.com': 'Hacker News',
  'youtube.com': 'YouTube',
  'github.com': 'GitHub',
  'wikipedia.org': 'Wikipedia',
  'zhihu.com': '知乎',
  'sspai.com': '少数派',
  'reddit.com': 'Reddit',
  'linkedin.com': 'LinkedIn',
  'medium.com': 'Medium',
  'notion.so': 'Notion',
  'figma.com': 'Figma',
  'openai.com': 'OpenAI'
};

function titleSiteAliases(link) {
  const labels = hostLabels(link);
  if (!labels.length) return [];

  const host = labels.join('.');
  const aliases = new Set([siteNameFromLink(link), host]);
  const brand = KNOWN_SITE_NAMES[host];
  if (brand) aliases.add(brand);

  return [...aliases].filter(alias => alias && alias.length > 1);
}

// "stackoverflow" should also match "Stack Overflow" or "stack-overflow".
// Only word-internal spacing flexes; a domain dot stays literal so that
// "example.com" never matches the bare text "examplecom".
function aliasPattern(alias) {
  const escaped = escapeRegExp(alias);
  if (!alias.includes('.') && !alias.includes(' ')) return escaped;
  const classPattern = alias.includes('.') ? '[\\s_\\-·|]*' : '[\\s._\\-·|]*';
  return escaped.replace(/(?:\\?\s)+/g, classPattern);
}

function stripKnownSeparators(title) {
  let next = title;
  const { charClass } = titleSeparatorVariants();
  // Always drop separator-only leading/trailing runs, then any dangling
  // separator left behind once a trailing site name has been removed.
  next = next.replace(new RegExp(`^[\\s${charClass}]+`), '');
  next = next.replace(new RegExp(`[${charClass}\\s]+$`), '');
  return collapseWhitespace(next);
}

function stripTitleAffixes(title, link) {
  const { alternative } = titleSeparatorVariants();
  const aliases = titleSiteAliases(link)
    .sort((a, b) => b.length - a.length)
    .map(aliasPattern);
  if (!aliases.length) return stripKnownSeparators(title);

  const group = `(?:${alternative})`;
  const patterns = [
    new RegExp(`${group}(?:${aliases.join('|')})$`, 'i'),
    new RegExp(`^(?:${aliases.join('|')})${group}`, 'i')
  ];

  let next = title;
  // Two passes settle titles whose site name also appears as a suffix of the core title.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const stripped = patterns.reduce((value, pattern) => value.replace(pattern, ''), next);
    if (stripped === next || !stripped) break;
    next = stripped;
  }

  // Edge separators are always cosmetic, so trim them even without a site match.
  return stripKnownSeparators(next);
}

export function optimizeTitle(title, link = '') {
  const original = collapseWhitespace(title);
  if (!original) return { title: '', changed: false };

  let next = stripTitleAffixes(original, link);
  if (!next) next = original;

  if (next.length > TITLE_MAX_LENGTH) {
    next = collapseWhitespace(next.slice(0, TITLE_MAX_LENGTH));
  }

  return { title: next, changed: next !== original };
}

// The lookahead keeps "Ad-free" / "Ad-based" intact: those are content, not noise.
const EXCERPT_NOISE = [
  /^\s*(?:share this|read more|continue reading|advertisement|sponsored)\b\s*[:：-]?\s*/i,
  /^\s*ad(?=[\s:：]|$)\s*[:：-]?\s*/i,
  /\s*(?:cookie|privacy) policy\.?$/i
];

export function optimizeExcerpt(excerpt, title = '') {
  const original = collapseWhitespace(excerpt);
  if (!original) return { excerpt: '', changed: false };

  let next = original;
  for (const pattern of EXCERPT_NOISE) next = next.replace(pattern, ' ');

  const cleanTitle = collapseWhitespace(title);
  // Drop an excerpt that merely repeats the title.
  if (cleanTitle && next.toLowerCase() === cleanTitle.toLowerCase()) {
    return { excerpt: '', changed: true };
  }

  next = collapseWhitespace(next);
  if (next.length > EXCERPT_MAX_LENGTH) {
    const cut = next.slice(0, EXCERPT_MAX_LENGTH);
    const lastSpace = cut.lastIndexOf(' ');
    next = collapseWhitespace(lastSpace > EXCERPT_MAX_LENGTH * 0.6 ? cut.slice(0, lastSpace) : cut);
  }

  return { excerpt: next, changed: next !== original };
}

export function optimizeBookmarkFields({ title = '', excerpt = '', link = '' } = {}) {
  const nextTitle = optimizeTitle(title, link);
  const nextExcerpt = optimizeExcerpt(excerpt, nextTitle.title);
  return {
    title: nextTitle.title,
    excerpt: nextExcerpt.excerpt,
    changed: nextTitle.changed || nextExcerpt.changed
  };
}

export function clampLength(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max).trim() : text;
}

// Models often wrap JSON in prose or a code fence; recover the object anyway.
export function extractJsonObject(text) {
  if (!text) return null;
  const fenced = String(text).match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : String(text)).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}
