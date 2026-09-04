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
