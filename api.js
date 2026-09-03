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

export async function createRaindrop({ link, title = '', collectionId = -1 }) {
  if (!link) throw new RaindropApiError('没有可保存的网页地址');

  const payload = {
    link,
    pleaseParse: {}
  };

  if (title.trim()) payload.title = title.trim();

  // collection 0 代表“全部”，不能作为实际保存目标。
  const normalizedCollectionId = Number(collectionId);
  payload.collection = {
    $id: Number.isFinite(normalizedCollectionId) && normalizedCollectionId !== 0
      ? normalizedCollectionId
      : -1
  };

  const data = await apiFetch('/raindrop', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return data?.item || null;
}
