import {
  createRaindrop,
  getCollectionData,
  getRaindrops,
  getStoredToken
} from './api.js';

const els = {
  setupCard: document.querySelector('#setupCard'),
  mainContent: document.querySelector('#mainContent'),
  settingsButton: document.querySelector('#settingsButton'),
  openSettingsButton: document.querySelector('#openSettingsButton'),
  searchInput: document.querySelector('#searchInput'),
  refreshButton: document.querySelector('#refreshButton'),
  currentPageTitle: document.querySelector('#currentPageTitle'),
  saveDestination: document.querySelector('#saveDestination'),
  saveCurrentButton: document.querySelector('#saveCurrentButton'),
  collectionSelect: document.querySelector('#collectionSelect'),
  listTitle: document.querySelector('#listTitle'),
  resultCount: document.querySelector('#resultCount'),
  loadingLabel: document.querySelector('#loadingLabel'),
  bookmarkList: document.querySelector('#bookmarkList'),
  loadMoreButton: document.querySelector('#loadMoreButton'),
  emptyState: document.querySelector('#emptyState'),
  toast: document.querySelector('#toast')
};

const state = {
  selectedCollectionId: 0,
  page: 0,
  total: 0,
  items: [],
  search: '',
  loading: false,
  collectionsById: new Map(),
  currentTab: null,
  searchTimer: null,
  requestSequence: 0
};

function showToast(message, type = 'normal') {
  els.toast.textContent = message;
  els.toast.classList.toggle('error', type === 'error');
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2200);
}

function setConnected(connected) {
  els.setupCard.classList.toggle('hidden', connected);
  els.mainContent.classList.toggle('hidden', !connected);
}

function collectionName(id) {
  const numericId = Number(id);
  if (numericId === 0) return '全部书签';
  if (numericId === -1) return '未分类';
  return state.collectionsById.get(numericId)?.title || '收藏夹';
}

function saveTargetId() {
  return state.selectedCollectionId === 0 ? -1 : state.selectedCollectionId;
}

function updateSaveDestination() {
  els.saveDestination.textContent = `保存到：${collectionName(saveTargetId())}`;
}

function appendCollectionOption(collection, depth = 0, groupLabel = '') {
  const option = document.createElement('option');
  option.value = String(collection._id);
  const prefix = depth > 0 ? `${'　'.repeat(depth)}↳ ` : '';
  option.textContent = `${prefix}${collection.title}${Number.isFinite(collection.count) ? ` (${collection.count})` : ''}`;
  if (groupLabel) option.dataset.group = groupLabel;
  els.collectionSelect.appendChild(option);
}

function populateCollections({ user, roots, children }) {
  state.collectionsById.clear();
  [...roots, ...children].forEach(item => state.collectionsById.set(Number(item._id), item));

  els.collectionSelect.replaceChildren();
  const all = new Option('全部书签', '0');
  const unsorted = new Option('未分类', '-1');
  els.collectionSelect.add(all);
  els.collectionSelect.add(unsorted);

  const childMap = new Map();
  children.forEach(child => {
    const parentId = Number(child.parent?.$id);
    if (!childMap.has(parentId)) childMap.set(parentId, []);
    childMap.get(parentId).push(child);
  });
  for (const list of childMap.values()) {
    list.sort((a, b) => (b.sort || 0) - (a.sort || 0));
  }

  const rootsById = new Map(roots.map(root => [Number(root._id), root]));
  const seen = new Set();

  const appendTree = (item, depth, groupLabel) => {
    if (!item || seen.has(Number(item._id))) return;
    seen.add(Number(item._id));
    appendCollectionOption(item, depth, groupLabel);
    const nested = childMap.get(Number(item._id)) || [];
    nested.forEach(child => appendTree(child, depth + 1, groupLabel));
  };

  const groups = Array.isArray(user?.groups)
    ? [...user.groups].filter(group => !group.hidden).sort((a, b) => (a.sort || 0) - (b.sort || 0))
    : [];

  if (groups.length) {
    for (const group of groups) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = group.title || '收藏夹';
      els.collectionSelect.appendChild(optgroup);

      for (const id of group.collections || []) {
        const root = rootsById.get(Number(id));
        if (!root || seen.has(Number(id))) continue;
        const rootOption = document.createElement('option');
        rootOption.value = String(root._id);
        rootOption.textContent = `${root.title}${Number.isFinite(root.count) ? ` (${root.count})` : ''}`;
        optgroup.appendChild(rootOption);
        seen.add(Number(root._id));

        const walkChildren = (parentId, depth) => {
          for (const child of childMap.get(Number(parentId)) || []) {
            const childOption = document.createElement('option');
            childOption.value = String(child._id);
            childOption.textContent = `${'　'.repeat(depth)}↳ ${child.title}${Number.isFinite(child.count) ? ` (${child.count})` : ''}`;
            optgroup.appendChild(childOption);
            seen.add(Number(child._id));
            walkChildren(child._id, depth + 1);
          }
        };
        walkChildren(root._id, 1);
      }
    }
  }

  // API 数据中可能存在未出现在 groups 的共享/特殊根收藏夹。
  for (const root of roots) appendTree(root, 0, '');

  const selectedStillExists = [...els.collectionSelect.options]
    .some(option => Number(option.value) === state.selectedCollectionId);
  if (!selectedStillExists) {
    state.selectedCollectionId = 0;
    chrome.storage.local.set({ lastCollectionId: 0 }).catch(() => {});
  }
  els.collectionSelect.value = String(state.selectedCollectionId);
  updateSaveDestination();
}

function createBookmarkCard(item) {
  const card = document.createElement('article');
  card.className = 'bookmark-card';
  card.tabIndex = 0;
  card.setAttribute('role', 'link');
  card.title = item.link || '';

  let visual;
  if (item.cover) {
    visual = document.createElement('img');
    visual.className = 'bookmark-cover';
    visual.src = item.cover;
    visual.alt = '';
    visual.loading = 'lazy';
    visual.referrerPolicy = 'no-referrer';
    visual.addEventListener('error', () => {
      visual.replaceWith(createFallback(item));
    }, { once: true });
  } else {
    visual = createFallback(item);
  }

  const main = document.createElement('div');
  main.className = 'bookmark-main';

  const title = document.createElement('div');
  title.className = 'bookmark-title';
  title.textContent = item.title || item.link || '无标题';

  const domain = document.createElement('div');
  domain.className = 'bookmark-domain';
  domain.textContent = item.domain || safeHostname(item.link);

  main.append(title, domain);

  if (item.excerpt) {
    const excerpt = document.createElement('div');
    excerpt.className = 'bookmark-excerpt';
    excerpt.textContent = item.excerpt;
    main.appendChild(excerpt);
  }

  if (Array.isArray(item.tags) && item.tags.length) {
    const tags = document.createElement('div');
    tags.className = 'tags';
    item.tags.slice(0, 3).forEach(tagText => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = tagText;
      tags.appendChild(tag);
    });
    main.appendChild(tags);
  }

  card.append(visual, main);

  const open = () => {
    if (!item.link) return;
    chrome.tabs.create({ url: item.link });
  };
  card.addEventListener('click', open);
  card.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  });

  return card;
}

function createFallback(item) {
  const fallback = document.createElement('div');
  fallback.className = 'bookmark-cover bookmark-fallback';
  const text = (item.title || item.domain || '?').trim();
  fallback.textContent = text.charAt(0).toUpperCase() || '?';
  return fallback;
}

function safeHostname(link) {
  try { return new URL(link).hostname; } catch (_) { return ''; }
}

function renderBookmarks() {
  els.bookmarkList.replaceChildren(...state.items.map(createBookmarkCard));
  els.emptyState.classList.toggle('hidden', state.loading || state.items.length > 0);
  els.resultCount.textContent = state.total ? `${state.total} 项` : '';
  els.loadMoreButton.classList.toggle('hidden', state.items.length >= state.total || state.items.length === 0);
}

async function loadBookmarks({ reset = true } = {}) {
  const sequence = ++state.requestSequence;
  const collectionId = state.selectedCollectionId;
  const search = state.search;
  const requestedPage = reset ? 0 : state.page + 1;

  state.loading = true;

  if (reset) {
    state.page = 0;
    state.items = [];
    state.total = 0;
    els.bookmarkList.replaceChildren();
  }

  els.loadingLabel.textContent = '加载中…';
  els.loadMoreButton.classList.add('hidden');
  els.emptyState.classList.add('hidden');

  try {
    const data = await getRaindrops(collectionId, {
      search,
      page: requestedPage,
      perpage: 30,
      nested: false,
      sort: search ? 'score' : '-created'
    });

    // 只接受最后一次请求，避免快速切换收藏夹/搜索词时旧响应覆盖新列表。
    if (sequence !== state.requestSequence) return;

    const newItems = data?.items || [];
    state.page = requestedPage;
    state.items = reset ? newItems : [...state.items, ...newItems];
    state.total = Number(data?.count) || state.items.length;
    renderBookmarks();
  } catch (error) {
    if (sequence !== state.requestSequence) return;
    console.error(error);
    showToast(error.status === 401 ? 'Token 无效或已失效，请重新设置' : error.message, 'error');
    if (error.status === 401) setConnected(false);
  } finally {
    if (sequence === state.requestSequence) {
      state.loading = false;
      els.loadingLabel.textContent = '';
      renderBookmarks();
    }
  }
}

async function loadCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    state.currentTab = tab || null;
    els.currentPageTitle.textContent = tab?.title || '当前网页';
  } catch (_) {
    state.currentTab = null;
    els.currentPageTitle.textContent = '当前网页';
  }
}

async function saveCurrentPage() {
  await loadCurrentTab();
  const tab = state.currentTab;
  if (!tab?.url || !/^https?:/i.test(tab.url)) {
    showToast('当前页面不是可保存的 HTTP/HTTPS 网页', 'error');
    return;
  }

  els.saveCurrentButton.disabled = true;
  els.saveCurrentButton.textContent = '保存中…';
  try {
    await createRaindrop({
      link: tab.url,
      title: tab.title || '',
      collectionId: saveTargetId()
    });
    showToast(`已保存到「${collectionName(saveTargetId())}」`);
    await loadBookmarks({ reset: true });
  } catch (error) {
    showToast(error.message || '保存失败', 'error');
  } finally {
    els.saveCurrentButton.disabled = false;
    els.saveCurrentButton.textContent = '＋ 保存当前页';
  }
}

async function bootstrap() {
  const token = await getStoredToken();
  if (!token) {
    setConnected(false);
    return;
  }

  setConnected(true);
  try {
    const { lastCollectionId = 0 } = await chrome.storage.local.get('lastCollectionId');
    state.selectedCollectionId = Number(lastCollectionId) || 0;
    const collectionData = await getCollectionData();
    populateCollections(collectionData);
    await loadCurrentTab();
    els.listTitle.textContent = collectionName(state.selectedCollectionId);
    await loadBookmarks({ reset: true });
  } catch (error) {
    console.error(error);
    if (error.status === 401) setConnected(false);
    showToast(error.message || '初始化失败', 'error');
  }
}

els.settingsButton.addEventListener('click', () => chrome.runtime.openOptionsPage());
els.openSettingsButton.addEventListener('click', () => chrome.runtime.openOptionsPage());
els.refreshButton.addEventListener('click', async () => {
  try {
    const data = await getCollectionData();
    populateCollections(data);
  } catch (error) {
    showToast(error.message || '刷新收藏夹失败', 'error');
  }
  await loadCurrentTab();
  await loadBookmarks({ reset: true });
});
els.saveCurrentButton.addEventListener('click', saveCurrentPage);
els.loadMoreButton.addEventListener('click', async () => {
  await loadBookmarks({ reset: false });
});

els.collectionSelect.addEventListener('change', async () => {
  state.selectedCollectionId = Number(els.collectionSelect.value);
  await chrome.storage.local.set({ lastCollectionId: state.selectedCollectionId });
  els.listTitle.textContent = collectionName(state.selectedCollectionId);
  updateSaveDestination();
  await loadBookmarks({ reset: true });
});

els.searchInput.addEventListener('input', () => {
  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(async () => {
    state.search = els.searchInput.value.trim();
    await loadBookmarks({ reset: true });
  }, 320);
});

chrome.tabs.onActivated.addListener(() => {
  loadCurrentTab();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.active) return;
  if (changeInfo.url || changeInfo.title || changeInfo.status === 'complete') {
    loadCurrentTab();
  }
});

chrome.runtime.onMessage.addListener(message => {
  if (message?.type === 'RAINDROP_SAVED') {
    showToast('右键保存成功');
    loadBookmarks({ reset: true });
  } else if (message?.type === 'RAINDROP_SAVE_FAILED') {
    showToast(message.message || '右键保存失败', 'error');
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.raindropToken) bootstrap();
});

bootstrap();
