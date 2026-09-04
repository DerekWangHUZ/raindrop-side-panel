const API_BASE = 'https://api.raindrop.io/rest/v1';

export class RaindropApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = 'RaindropApiError';
    this.status = status;
    this.details = details;
  }
}

export async function getStoredToken() {
  const { raindropToken = '' } = await chrome.storage.local.get('raindropToken');
  return raindropToken.trim();
}

export async function apiFetch(path, options = {}, tokenOverride = '') {
  const token = tokenOverride.trim() || await getStoredToken();
  if (!token) {
    throw new RaindropApiError('尚未设置 Raindrop Test Token', 401);
  }

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });
  } catch (error) {
    throw new RaindropApiError(`网络请求失败：${error.message}`);
  }

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => null);
  } else {
    data = await response.text().catch(() => null);
  }

  if (!response.ok || (data && typeof data === 'object' && data.result === false)) {
    const apiMessage = data?.errorMessage || data?.error || data?.message;
    const message = apiMessage || `Raindrop API 请求失败（HTTP ${response.status}）`;
    throw new RaindropApiError(message, response.status, data);
  }

  return data;
}

export async function validateToken(token) {
  const data = await apiFetch('/user', { method: 'GET' }, token);
  return data?.user || null;
}

export async function getCollectionData() {
  const [userData, rootsData, childrenData] = await Promise.all([
    apiFetch('/user'),
    apiFetch('/collections'),
    apiFetch('/collections/childrens')
  ]);

  return {
    user: userData?.user || null,
    roots: rootsData?.items || [],
    children: childrenData?.items || []
  };
}

export async function getRaindrops(collectionId = 0, {
  search = '',
  page = 0,
  perpage = 30,
  nested = false,
  sort = '-created'
} = {}) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('perpage', String(Math.min(Math.max(perpage, 1), 50)));
  params.set('sort', sort);
  if (search.trim()) params.set('search', search.trim());
  if (nested) params.set('nested', 'true');

  return apiFetch(`/raindrops/${collectionId}?${params.toString()}`);
}

function normalizedCollectionId(collectionId) {
  const numericCollectionId = Number(collectionId);
  return Number.isFinite(numericCollectionId) && numericCollectionId !== 0
    ? numericCollectionId
    : -1;
}

function normalizedTags(tags) {
  if (Array.isArray(tags)) {
    return [...new Set(tags.map(tag => String(tag).trim()).filter(Boolean))];
  }
  return [...new Set(String(tags || '')
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean))];
}

export function buildRaindropPayload({
  link,
  title = '',
  collectionId = -1,
  tags = [],
  note = '',
  excerpt = ''
}) {
  if (!link) throw new RaindropApiError('没有可保存的网页地址');

  const payload = {
    link,
    pleaseParse: {},
    collection: { $id: normalizedCollectionId(collectionId) }
  };

  if (String(title).trim()) payload.title = String(title).trim();
  const normalizedTagList = normalizedTags(tags);
  if (normalizedTagList.length) payload.tags = normalizedTagList;
  if (String(note).trim()) payload.note = String(note).trim();
  if (String(excerpt).trim()) payload.excerpt = String(excerpt).trim();

  return payload;
}

export async function createRaindrop(options) {
  const payload = buildRaindropPayload(options);

  const data = await apiFetch('/raindrop', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return data?.item || null;
}

export async function createRaindrops(items, common = {}) {
  if (!Array.isArray(items) || !items.length) {
    throw new RaindropApiError('没有可新增的书签');
  }
  if (items.length > 100) {
    throw new RaindropApiError('单次最多新增 100 条书签');
  }

  const payload = {
    items: items.map(item => buildRaindropPayload({ ...common, ...item }))
  };
  const data = await apiFetch('/raindrops', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return data?.items || [];
}

function buildUpdatePayload(updates = {}) {
  const payload = {};
  if (Object.prototype.hasOwnProperty.call(updates, 'link')) payload.link = String(updates.link).trim();
  if (Object.prototype.hasOwnProperty.call(updates, 'title')) payload.title = String(updates.title || '').trim();
  if (Object.prototype.hasOwnProperty.call(updates, 'collectionId')) {
    payload.collection = { $id: normalizedCollectionId(updates.collectionId) };
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'tags')) payload.tags = normalizedTags(updates.tags);
  if (Object.prototype.hasOwnProperty.call(updates, 'note')) payload.note = String(updates.note || '').trim();
  if (Object.prototype.hasOwnProperty.call(updates, 'excerpt')) payload.excerpt = String(updates.excerpt || '').trim();
  return payload;
}

export async function updateRaindrop(id, updates) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    throw new RaindropApiError('无效的书签 ID');
  }
  const data = await apiFetch(`/raindrop/${numericId}`, {
    method: 'PUT',
    body: JSON.stringify(buildUpdatePayload(updates))
  });
  return data?.item || null;
}

export async function updateRaindrops(collectionId, { ids, ...updates }) {
  const numericCollectionId = Number(collectionId);
  const normalizedIds = (ids || []).map(Number).filter(id => Number.isFinite(id) && id > 0);
  if (!Number.isFinite(numericCollectionId) || numericCollectionId === 0) {
    throw new RaindropApiError('批量更新不能使用“全部书签”作为来源收藏夹');
  }
  if (!normalizedIds.length) throw new RaindropApiError('没有可更新的书签');

  const data = await apiFetch(`/raindrops/${numericCollectionId}`, {
    method: 'PUT',
    body: JSON.stringify({ ids: normalizedIds, ...buildUpdatePayload(updates) })
  });
  return data?.modified || 0;
}

export async function getRaindrop(id) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    throw new RaindropApiError('无效的书签 ID');
  }
  const data = await apiFetch(`/raindrop/${numericId}`);
  return data?.item || null;
}

export async function deleteRaindrop(id) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    throw new RaindropApiError('无效的书签 ID');
  }
  await apiFetch(`/raindrop/${numericId}`, { method: 'DELETE' });
}

export async function deleteRaindrops(collectionId, ids) {
  const numericCollectionId = Number(collectionId);
  const normalizedIds = (ids || []).map(Number).filter(id => Number.isFinite(id) && id > 0);
  if (!Number.isFinite(numericCollectionId) || numericCollectionId === 0) {
    throw new RaindropApiError('批量删除不能使用“全部书签”作为来源收藏夹');
  }
  if (!normalizedIds.length) throw new RaindropApiError('没有可删除的书签');

  await apiFetch(`/raindrops/${numericCollectionId}`, {
    method: 'DELETE',
    body: JSON.stringify({ ids: normalizedIds })
  });
}
