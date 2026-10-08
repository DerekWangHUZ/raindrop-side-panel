import {
  createRaindrop,
  createRaindrops,
  deleteRaindrop,
  deleteRaindrops,
  getCollectionData,
  getRaindrop,
  getRaindrops,
  getStoredToken,
  updateRaindrop,
  updateRaindrops
} from './api.js';
import {
  chunkItems,
  getItemCollectionId,
  groupItemsByCollection,
  normalizeTags,
  parseBulkLines,
  DEFAULT_SORT,
  SORT_OPTIONS,
  normalizeSort
} from './utils.mjs';
import { optimizeFields } from './optimizer.js';
import { readActivePageMeta, requestPageAccess } from './page-meta.js';
import { initTheme } from './theme.js';

const els = {
  setupCard: document.querySelector('#setupCard'),
  mainContent: document.querySelector('#mainContent'),
  settingsButton: document.querySelector('#settingsButton'),
  openSettingsButton: document.querySelector('#openSettingsButton'),
  searchInput: document.querySelector('#searchInput'),
  sortSelect: document.querySelector('#sortSelect'),
  refreshButton: document.querySelector('#refreshButton'),
  currentPageTitle: document.querySelector('#currentPageTitle'),
  saveDestination: document.querySelector('#saveDestination'),
  saveCurrentButton: document.querySelector('#saveCurrentButton'),
  bulkAddButton: document.querySelector('#bulkAddButton'),
  selectionActions: document.querySelector('#selectionActions'),
  selectionCount: document.querySelector('#selectionCount'),
  bulkEditButton: document.querySelector('#bulkEditButton'),
  bulkDeleteButton: document.querySelector('#bulkDeleteButton'),
  collapseAllButton: document.querySelector('#collapseAllButton'),
  collectionTree: document.querySelector('#collectionTree'),
  selectAllCheckbox: document.querySelector('#selectAllCheckbox'),
  listTitle: document.querySelector('#listTitle'),
  resultCount: document.querySelector('#resultCount'),
  loadingLabel: document.querySelector('#loadingLabel'),
  bookmarkList: document.querySelector('#bookmarkList'),
  loadMoreButton: document.querySelector('#loadMoreButton'),
  emptyState: document.querySelector('#emptyState'),
  editorDialog: document.querySelector('#editorDialog'),
  editorForm: document.querySelector('#editorForm'),
  editorHeading: document.querySelector('#editorHeading'),
  editorCloseButton: document.querySelector('#editorCloseButton'),
  editorLinkInput: document.querySelector('#editorLinkInput'),
  editorTitleInput: document.querySelector('#editorTitleInput'),
  editorCollectionSelect: document.querySelector('#editorCollectionSelect'),
  editorTagsInput: document.querySelector('#editorTagsInput'),
  editorNoteInput: document.querySelector('#editorNoteInput'),
  editorExcerptInput: document.querySelector('#editorExcerptInput'),
  editorAdvancedFields: document.querySelector('#editorAdvancedFields'),
  optimizeEditorButton: document.querySelector('#optimizeEditorButton'),
  editorError: document.querySelector('#editorError'),
  editorCancelButton: document.querySelector('#editorCancelButton'),
  editorSubmitButton: document.querySelector('#editorSubmitButton'),
  bulkAddDialog: document.querySelector('#bulkAddDialog'),
  bulkAddForm: document.querySelector('#bulkAddForm'),
  bulkAddCloseButton: document.querySelector('#bulkAddCloseButton'),
  bulkAddInput: document.querySelector('#bulkAddInput'),
  bulkAddCollectionSelect: document.querySelector('#bulkAddCollectionSelect'),
  bulkAddTagsInput: document.querySelector('#bulkAddTagsInput'),
  bulkAddNoteInput: document.querySelector('#bulkAddNoteInput'),
  bulkAddErrors: document.querySelector('#bulkAddErrors'),
  bulkAddCancelButton: document.querySelector('#bulkAddCancelButton'),
  bulkAddSubmitButton: document.querySelector('#bulkAddSubmitButton'),
  bulkEditDialog: document.querySelector('#bulkEditDialog'),
  bulkEditForm: document.querySelector('#bulkEditForm'),
  bulkEditCloseButton: document.querySelector('#bulkEditCloseButton'),
  bulkApplyCollection: document.querySelector('#bulkApplyCollection'),
  bulkEditCollectionSelect: document.querySelector('#bulkEditCollectionSelect'),
  bulkApplyTags: document.querySelector('#bulkApplyTags'),
  bulkEditTagsInput: document.querySelector('#bulkEditTagsInput'),
  bulkApplyNote: document.querySelector('#bulkApplyNote'),
  bulkEditNoteInput: document.querySelector('#bulkEditNoteInput'),
  bulkApplyExcerpt: document.querySelector('#bulkApplyExcerpt'),
  bulkEditExcerptInput: document.querySelector('#bulkEditExcerptInput'),
  bulkEditError: document.querySelector('#bulkEditError'),
  bulkEditCancelButton: document.querySelector('#bulkEditCancelButton'),
  bulkEditSubmitButton: document.querySelector('#bulkEditSubmitButton'),
  confirmDialog: document.querySelector('#confirmDialog'),
  confirmForm: document.querySelector('#confirmForm'),
  confirmMessage: document.querySelector('#confirmMessage'),
  confirmCancelButton: document.querySelector('#confirmCancelButton'),
  toast: document.querySelector('#toast')
};

const state = {
  selectedCollectionId: 0,
  page: 0,
  total: 0,
  items: [],
  selectedIds: new Set(),
  search: '',
  sort: DEFAULT_SORT,
  loading: false,
  collectionsById: new Map(),
  collectionTree: [],
  expandedCollectionIds: new Set(),
  currentTab: null,
  searchTimer: null,
  requestSequence: 0,
  ready: false,
  pendingSaveWaiting: false,
  confirmResolver: null
};

function showToast(message, type = 'normal') {
  els.toast.textContent = message;
  els.toast.classList.toggle('error', type === 'error');
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2600);
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

function nodeLabel(item) {
  return `${item.title || '未命名收藏夹'}${Number.isFinite(item.count) ? ` (${item.count})` : ''}`;
}

function buildNode(item, childMap) {
  return {
    item,
    children: (childMap.get(Number(item._id)) || []).map(child => buildNode(child, childMap))
  };
}

function populateCollections({ user, roots, children }, expandedIds = null) {
  const rootItems = Array.isArray(roots) ? roots : [];
  const childItems = Array.isArray(children) ? children : [];
  state.collectionsById.clear();
  [...rootItems, ...childItems].forEach(item => state.collectionsById.set(Number(item._id), item));

  const childMap = new Map();
  childItems.forEach(child => {
    const parentId = Number(child.parent?.$id);
    if (!childMap.has(parentId)) childMap.set(parentId, []);
    childMap.get(parentId).push(child);
  });
  for (const list of childMap.values()) list.sort((a, b) => (b.sort || 0) - (a.sort || 0));

  const rootsById = new Map(rootItems.map(root => [Number(root._id), root]));
  const seen = new Set();
  const groups = Array.isArray(user?.groups)
    ? [...user.groups].filter(group => !group.hidden).sort((a, b) => (a.sort || 0) - (b.sort || 0))
    : [];
  const tree = [];

  for (const group of groups) {
    const nodes = [];
    for (const id of group.collections || []) {
      const root = rootsById.get(Number(id));
      if (!root || seen.has(Number(root._id))) continue;
      seen.add(Number(root._id));
      nodes.push(buildNode(root, childMap));
    }
    if (nodes.length) tree.push({ title: group.title || '收藏夹', nodes });
  }
  const remaining = [];
  for (const root of rootItems) {
    if (seen.has(Number(root._id))) continue;
    seen.add(Number(root._id));
    remaining.push(buildNode(root, childMap));
  }
  if (remaining.length) tree.push({ title: '', nodes: remaining });
  state.collectionTree = tree;

  if (Array.isArray(expandedIds)) {
    state.expandedCollectionIds = new Set(expandedIds.map(Number).filter(Number.isFinite));
  } else {
    state.expandedCollectionIds = new Set(
      [...state.collectionsById.values()].filter(item => item.expanded).map(item => Number(item._id))
    );
  }

  const selectedExists = state.selectedCollectionId === 0 || state.selectedCollectionId === -1 || state.collectionsById.has(state.selectedCollectionId);
  if (!selectedExists) {
    state.selectedCollectionId = 0;
    chrome.storage.local.set({ lastCollectionId: 0 }).catch(() => {});
  }
  renderCollectionTree();
  populateDialogCollections();
  updateSaveDestination();
}

function renderCollectionNode(node, depth) {
  const wrapper = document.createElement('div');
  wrapper.className = 'collection-node';
  const row = document.createElement('div');
  row.className = `collection-item${Number(node.item._id) === state.selectedCollectionId ? ' selected' : ''}`;
  row.style.setProperty('--depth', depth);

  const toggle = document.createElement('button');
  toggle.className = 'collection-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', node.children.length ? '展开或收起子收藏夹' : '没有子收藏夹');
  if (node.children.length) {
    const expanded = state.expandedCollectionIds.has(Number(node.item._id));
    toggle.textContent = expanded ? '⌄' : '›';
    toggle.addEventListener('click', async event => {
      event.stopPropagation();
      const id = Number(node.item._id);
      if (state.expandedCollectionIds.has(id)) state.expandedCollectionIds.delete(id);
      else state.expandedCollectionIds.add(id);
      await chrome.storage.local.set({ expandedCollectionIds: [...state.expandedCollectionIds] });
      renderCollectionTree();
    });
  } else {
    toggle.textContent = '·';
    toggle.disabled = true;
  }

  const select = document.createElement('button');
  select.className = 'collection-label';
  select.type = 'button';
  select.textContent = nodeLabel(node.item);
  select.addEventListener('click', () => selectCollection(Number(node.item._id)));
  row.append(toggle, select);
  wrapper.appendChild(row);

  if (state.expandedCollectionIds.has(Number(node.item._id))) {
    node.children.forEach(child => wrapper.appendChild(renderCollectionNode(child, depth + 1)));
  }
  return wrapper;
}

function renderCollectionTree() {
  els.collectionTree.replaceChildren();
  const special = [
    [0, '全部书签'],
    [-1, '未分类']
  ];
  special.forEach(([id, label]) => {
    const row = document.createElement('div');
    row.className = `collection-item special${state.selectedCollectionId === id ? ' selected' : ''}`;
    const spacer = document.createElement('span');
    spacer.className = 'collection-toggle spacer';
    const button = document.createElement('button');
    button.className = 'collection-label';
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => selectCollection(id));
    row.append(spacer, button);
    els.collectionTree.appendChild(row);
  });

  state.collectionTree.forEach(group => {
    if (group.title) {
      const heading = document.createElement('div');
      heading.className = 'collection-group-title';
      heading.textContent = group.title;
      els.collectionTree.appendChild(heading);
    }
    group.nodes.forEach(node => els.collectionTree.appendChild(renderCollectionNode(node, 0)));
  });
}

function appendCollectionOptions(select, nodes, depth = 0, seen = new Set()) {
  nodes.forEach(node => {
    const id = Number(node.item._id);
    if (seen.has(id)) return;
    seen.add(id);
    const option = document.createElement('option');
    option.value = String(id);
    option.textContent = `${'　'.repeat(depth)}${nodeLabel(node.item)}`;
    select.appendChild(option);
    appendCollectionOptions(select, node.children, depth + 1, seen);
  });
}

function populateDialogCollections() {
  const selects = [els.editorCollectionSelect, els.bulkAddCollectionSelect, els.bulkEditCollectionSelect];
  selects.forEach(select => {
    const selected = select.value;
    select.replaceChildren();
    select.add(new Option('未分类', '-1'));
    const seen = new Set();
    state.collectionTree.forEach(group => appendCollectionOptions(select, group.nodes, 0, seen));
    if ([...select.options].some(option => option.value === selected)) select.value = selected;
  });
}

async function selectCollection(id) {
  state.selectedCollectionId = Number(id);
  await chrome.storage.local.set({ lastCollectionId: state.selectedCollectionId });
  renderCollectionTree();
  updateSaveDestination();
  await loadBookmarks({ reset: true });
}

function selectedItems() {
  return state.items.filter(item => state.selectedIds.has(Number(item._id)));
}

function renderSelectionState() {
  const count = state.selectedIds.size;
  els.selectionActions.classList.toggle('hidden', count === 0);
  els.selectionCount.textContent = `${count} 项已选`;
  const visibleSelected = state.items.filter(item => state.selectedIds.has(Number(item._id))).length;
  els.selectAllCheckbox.checked = state.items.length > 0 && visibleSelected === state.items.length;
  els.selectAllCheckbox.indeterminate = visibleSelected > 0 && visibleSelected < state.items.length;
}

function safeHostname(link) {
  try { return new URL(link).hostname; } catch (_) { return ''; }
}

function createFallback(item) {
  const fallback = document.createElement('div');
  fallback.className = 'bookmark-cover bookmark-fallback';
  const text = (item.title || item.domain || '?').trim();
  fallback.textContent = text.charAt(0).toUpperCase() || '?';
  return fallback;
}

function createBookmarkCard(item) {
  const card = document.createElement('article');
  card.className = 'bookmark-card';
  card.tabIndex = 0;
  card.setAttribute('role', 'link');

  const select = document.createElement('input');
  select.type = 'checkbox';
  select.className = 'bookmark-select';
  select.checked = state.selectedIds.has(Number(item._id));
  select.setAttribute('aria-label', `选择${item.title || item.link || '书签'}`);
  select.addEventListener('click', event => event.stopPropagation());
  select.addEventListener('change', () => {
    const id = Number(item._id);
    if (select.checked) state.selectedIds.add(id);
    else state.selectedIds.delete(id);
    renderSelectionState();
  });

  let visual;
  if (item.cover) {
    visual = document.createElement('img');
    visual.className = 'bookmark-cover';
    visual.src = item.cover;
    visual.alt = '';
    visual.loading = 'lazy';
    visual.referrerPolicy = 'no-referrer';
    visual.addEventListener('error', () => visual.replaceWith(createFallback(item)), { once: true });
  } else visual = createFallback(item);

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

  const actions = document.createElement('div');
  actions.className = 'bookmark-actions';
  const editButton = document.createElement('button');
  editButton.className = 'card-action';
  editButton.type = 'button';
  editButton.title = '编辑';
  editButton.textContent = '✎';
  editButton.addEventListener('click', event => { event.stopPropagation(); openEditDialog(item); });
  const optimizeButton = document.createElement('button');
  optimizeButton.className = 'card-action';
  optimizeButton.type = 'button';
  optimizeButton.title = '优化书签名和摘要';
  optimizeButton.setAttribute('aria-label', '优化书签名和摘要');
  optimizeButton.textContent = '✨';
  optimizeButton.addEventListener('click', async event => {
    event.stopPropagation();
    await optimizeBookmarkFromCard(item, optimizeButton);
  });
  const deleteButton = document.createElement('button');
  deleteButton.className = 'card-action danger-text';
  deleteButton.type = 'button';
  deleteButton.title = '删除';
  deleteButton.textContent = '×';
  deleteButton.addEventListener('click', async event => { event.stopPropagation(); await removeSingleBookmark(item); });
  actions.append(editButton, optimizeButton, deleteButton);
  card.append(select, visual, main, actions);

  const open = () => { if (item.link) chrome.tabs.create({ url: item.link }); };
  card.addEventListener('click', event => {
    if (event.target.closest('button,input')) return;
    open();
  });
  card.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button,input')) {
      event.preventDefault();
      open();
    }
  });
  return card;
}

function renderBookmarks() {
  els.bookmarkList.replaceChildren(...state.items.map(createBookmarkCard));
  els.emptyState.classList.toggle('hidden', state.loading || state.items.length > 0);
  els.resultCount.textContent = state.total ? `${state.total} 项` : '';
  els.loadMoreButton.classList.toggle('hidden', state.items.length >= state.total || state.items.length === 0 || state.loading);
  renderSelectionState();
}

async function loadBookmarks({ reset = true } = {}) {
  const sequence = ++state.requestSequence;
  const search = state.search;
  const collectionId = search ? 0 : state.selectedCollectionId;
  const requestedPage = reset ? 0 : state.page + 1;
  state.loading = true;
  if (reset) {
    state.page = 0;
    state.items = [];
    state.total = 0;
    state.selectedIds.clear();
    els.bookmarkList.replaceChildren();
  }
  els.listTitle.textContent = search ? '全局搜索' : collectionName(state.selectedCollectionId);
  els.loadingLabel.textContent = '加载中…';
  els.emptyState.classList.add('hidden');
  try {
    const data = await getRaindrops(collectionId, {
      search,
      page: requestedPage,
      perpage: 30,
      nested: Boolean(search),
      sort: state.sort
    });
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

function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
}

function setEditorError(message = '') {
  els.editorError.textContent = message;
}

function validHttpUrl(value) {
  try {
    const url = new URL(String(value).trim());
    return /^https?:$/i.test(url.protocol);
  } catch (_) {
    return false;
  }
}

function openEditor({ mode, item = {} }) {
  els.editorForm.dataset.mode = mode;
  els.editorForm.dataset.id = item._id ? String(item._id) : '';
  els.editorHeading.textContent = mode === 'edit' ? '编辑书签' : '保存书签';
  els.editorSubmitButton.textContent = mode === 'edit' ? '保存修改' : '保存';
  els.editorLinkInput.value = item.link || '';
  els.editorTitleInput.value = item.title || '';
  els.editorTagsInput.value = Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags || '');
  els.editorNoteInput.value = item.note || '';
  els.editorExcerptInput.value = item.excerpt || '';
  populateDialogCollections();
  const desired = Number(item.collection?.$id ?? item.collectionId ?? saveTargetId());
  els.editorCollectionSelect.value = [...els.editorCollectionSelect.options].some(option => Number(option.value) === desired)
    ? String(desired)
    : '-1';
  els.editorError.textContent = '';
  els.optimizeEditorButton.disabled = false;
  els.optimizeEditorButton.textContent = '✨';
  els.editorDialog.showModal();
  els.editorLinkInput.focus();
}

async function openSaveDialog(draft = null) {
  if (!draft) {
    await loadCurrentTab();
    draft = { link: state.currentTab?.url || '', title: state.currentTab?.title || '', collectionId: saveTargetId() };
  }
  if (!validHttpUrl(draft.link)) {
    showToast('当前页面不是可保存的 HTTP/HTTPS 网页', 'error');
    return;
  }
  openEditor({ mode: 'create', item: draft });
}

async function openEditDialog(item) {
  try {
    const fresh = await getRaindrop(item._id);
    openEditor({ mode: 'edit', item: fresh || item });
  } catch (_) {
    openEditor({ mode: 'edit', item });
  }
}

/**
 * Optimize the title and excerpt currently in the editor and write the result
 * back into the form. Nothing is sent to Raindrop until the user saves.
 *
 * Page metadata is only used as input, never written into the title field.
 * Writing the tab title back would leave the field holding "Page - Site" while
 * the rules below strip that suffix, which made a description that repeats the
 * bare title look like a duplicate and get cleared.
 */
async function runEditorOptimization() {
  const link = els.editorLinkInput.value.trim();
  if (!validHttpUrl(link)) return setEditorError('请先填写有效的链接，再进行优化。');

  const button = els.optimizeEditorButton;
  button.disabled = true;
  button.textContent = '…';
  setEditorError('');

  try {
    // The editor usually already holds the tab title, so only borrow one when
    // the field is empty (a context-menu save on a link, for example).
    let title = els.editorTitleInput.value.trim();
    let excerpt = els.editorExcerptInput.value;
    let accessDenied = false;

    // A new bookmark has no metadata yet, so borrow it from the open tab.
    if (els.editorForm.dataset.mode !== 'edit' && (!title || !excerpt)) {
      // Must be requested straight from the click handler: the permission
      // prompt only opens while the user gesture is still active.
      const granted = await requestPageAccess(link);
      const meta = granted
        ? await readActivePageMeta(link)
        : { title: '', description: '', denied: true };

      if (!title) title = meta.title;
      if (!excerpt) excerpt = meta.description;
      accessDenied = Boolean(meta.denied);
    }

    const result = await optimizeFields({ link, title, excerpt });
    if (result.title) els.editorTitleInput.value = result.title;
    // Make the optimized excerpt visible instead of leaving it folded away.
    if (result.excerpt !== excerpt) els.editorAdvancedFields.open = true;
    els.editorExcerptInput.value = result.excerpt;

    if (accessDenied) showToast('未授权访问该网页，已仅优化书签名', 'error');
    else showToast(result.changed ? '已优化书签名和摘要' : '没有需要优化的地方');
  } catch (error) {
    setEditorError(error.message || '优化失败');
  } finally {
    button.disabled = false;
    button.textContent = '✨';
  }
}

/** Optimize a bookmark straight from its card, then refresh the list. */
async function optimizeBookmarkFromCard(item, button) {
  button.disabled = true;
  try {
    const result = await optimizeFields({
      link: item.link,
      title: item.title,
      excerpt: item.excerpt
    });
    if (!result.changed) {
      showToast('没有需要优化的地方');
      return;
    }
    await updateRaindrop(item._id, { title: result.title, excerpt: result.excerpt });
    showToast('已优化书签名和摘要');
    await refreshAfterMutation().catch(() => {});
  } catch (error) {
    showToast(error.message || '优化失败', 'error');
  } finally {
    button.disabled = false;
  }
}

async function submitEditor(event) {
  event.preventDefault();
  const mode = els.editorForm.dataset.mode;
  const link = els.editorLinkInput.value.trim();
  const collectionId = Number(els.editorCollectionSelect.value);
  if (!validHttpUrl(link)) return setEditorError('请输入有效的 HTTP/HTTPS 链接。');
  if (!Number.isFinite(collectionId) || collectionId === 0) return setEditorError('请选择实际收藏夹。');

  els.editorSubmitButton.disabled = true;
  setEditorError('');
  try {
    const fields = {
      link,
      title: els.editorTitleInput.value.trim(),
      collectionId,
      tags: normalizeTags(els.editorTagsInput.value),
      note: els.editorNoteInput.value,
      excerpt: els.editorExcerptInput.value
    };

    if (mode === 'edit') {
      await updateRaindrop(els.editorForm.dataset.id, fields);
    } else {
      await createRaindrop(fields);
      await chrome.storage.local.set({ lastCollectionId: collectionId });
    }

    closeDialog(els.editorDialog);
    showToast(mode === 'edit' ? '书签已更新' : `已保存到「${collectionName(collectionId)}」`);
    await refreshAfterMutation();
  } catch (error) {
    setEditorError(error.message || '保存失败');
  } finally {
    els.editorSubmitButton.disabled = false;
  }
}

function openBulkAddDialog() {
  els.bulkAddForm.reset();
  populateDialogCollections();
  els.bulkAddCollectionSelect.value = String(saveTargetId());
  if (!els.bulkAddCollectionSelect.value) els.bulkAddCollectionSelect.value = '-1';
  els.bulkAddErrors.textContent = '';
  els.bulkAddDialog.showModal();
  els.bulkAddInput.focus();
}

async function submitBulkAdd(event) {
  event.preventDefault();
  const parsed = parseBulkLines(els.bulkAddInput.value);
  if (parsed.errors.length) {
    els.bulkAddErrors.textContent = parsed.errors.map(error => `第 ${error.line} 行：${error.message}`).join('\n');
    return;
  }
  if (!parsed.items.length) {
    els.bulkAddErrors.textContent = '请至少输入一条书签。';
    return;
  }

  els.bulkAddSubmitButton.disabled = true;
  els.bulkAddErrors.textContent = '';
  try {
    const common = {
      collectionId: Number(els.bulkAddCollectionSelect.value),
      tags: normalizeTags(els.bulkAddTagsInput.value),
      note: els.bulkAddNoteInput.value
    };
    const chunks = chunkItems(parsed.items, 100);
    for (let index = 0; index < chunks.length; index += 1) {
      els.bulkAddSubmitButton.textContent = `新增中 ${index + 1}/${chunks.length}…`;
      await createRaindrops(chunks[index], common);
    }
    closeDialog(els.bulkAddDialog);
    showToast(`已新增 ${parsed.items.length} 条书签`);
    await refreshAfterMutation();
  } catch (error) {
    els.bulkAddErrors.textContent = error.message || '批量新增失败，可能已有部分书签完成保存。';
  } finally {
    els.bulkAddSubmitButton.disabled = false;
    els.bulkAddSubmitButton.textContent = '开始新增';
  }
}

function toggleBulkField(checkbox, input) {
  input.disabled = !checkbox.checked;
}

function openBulkEditDialog() {
  if (!state.selectedIds.size) return;
  els.bulkEditForm.reset();
  populateDialogCollections();
  els.bulkEditCollectionSelect.value = String(saveTargetId());
  els.bulkEditError.textContent = '';
  [
    [els.bulkApplyCollection, els.bulkEditCollectionSelect],
    [els.bulkApplyTags, els.bulkEditTagsInput],
    [els.bulkApplyNote, els.bulkEditNoteInput],
    [els.bulkApplyExcerpt, els.bulkEditExcerptInput]
  ].forEach(([checkbox, input]) => toggleBulkField(checkbox, input));
  els.bulkEditDialog.showModal();
}

async function submitBulkEdit(event) {
  event.preventDefault();
  const updates = {};
  if (els.bulkApplyCollection.checked) updates.collectionId = Number(els.bulkEditCollectionSelect.value);
  if (els.bulkApplyTags.checked) updates.tags = normalizeTags(els.bulkEditTagsInput.value);
  if (els.bulkApplyNote.checked) updates.note = els.bulkEditNoteInput.value;
  if (els.bulkApplyExcerpt.checked) updates.excerpt = els.bulkEditExcerptInput.value;
  if (!Object.keys(updates).length) {
    els.bulkEditError.textContent = '请至少勾选一个要修改的字段。';
    return;
  }

  const items = selectedItems();
  els.bulkEditSubmitButton.disabled = true;
  try {
    let modified = 0;
    for (const [sourceId, group] of groupItemsByCollection(items)) {
      modified += Number(await updateRaindrops(sourceId, {
        ids: group.map(item => item._id),
        ...updates
      })) || 0;
    }
    closeDialog(els.bulkEditDialog);
    state.selectedIds.clear();
    showToast(`已更新 ${modified || items.length} 条书签`);
    await refreshAfterMutation();
  } catch (error) {
    els.bulkEditError.textContent = error.message || '批量编辑失败。';
  } finally {
    els.bulkEditSubmitButton.disabled = false;
  }
}

function openConfirm(message) {
  return new Promise(resolve => {
    state.confirmResolver = resolve;
    els.confirmMessage.textContent = message;
    els.confirmDialog.showModal();
  });
}

function finishConfirm(result) {
  closeDialog(els.confirmDialog);
  const resolver = state.confirmResolver;
  state.confirmResolver = null;
  resolver?.(result);
}

async function removeSingleBookmark(item) {
  if (!await openConfirm(`确定删除“${item.title || item.link || '这条书签'}”吗？删除后会移入 Raindrop Trash。`)) return;
  try {
    await deleteRaindrop(item._id);
    state.selectedIds.delete(Number(item._id));
    showToast('书签已移入 Trash');
    await refreshAfterMutation();
  } catch (error) {
    showToast(error.message || '删除失败', 'error');
  }
}

async function removeSelectedBookmarks() {
  const items = selectedItems();
  if (!items.length) return;
  if (!await openConfirm(`确定删除已选的 ${items.length} 条书签吗？它们会移入 Raindrop Trash。`)) return;
  try {
    for (const [sourceId, group] of groupItemsByCollection(items)) {
      await deleteRaindrops(sourceId, group.map(item => item._id));
    }
    state.selectedIds.clear();
    showToast(`已删除 ${items.length} 条书签`);
    await refreshAfterMutation();
  } catch (error) {
    showToast(error.message || '批量删除失败，可能已有部分书签完成删除。', 'error');
  }
}

async function refreshAfterMutation() {
  const data = await getCollectionData();
  const stored = await chrome.storage.local.get('expandedCollectionIds');
  populateCollections(data, Array.isArray(stored.expandedCollectionIds) ? stored.expandedCollectionIds : null);
  await loadBookmarks({ reset: true });
}

async function consumePendingSave() {
  const { pendingSaveDraft } = await chrome.storage.local.get('pendingSaveDraft');
  if (!pendingSaveDraft) return;
  await chrome.storage.local.remove('pendingSaveDraft');
  if (Date.now() - Number(pendingSaveDraft.createdAt || 0) > 10 * 60 * 1000) return;
  await openSaveDialog(pendingSaveDraft);
}

async function bootstrap() {
  const token = await getStoredToken();
  if (!token) {
    setConnected(false);
    return;
  }
  setConnected(true);
  try {
    const stored = await chrome.storage.local.get(['lastCollectionId', 'expandedCollectionIds', 'sortMode']);
    const savedCollectionId = Number(stored.lastCollectionId);
    state.selectedCollectionId = Number.isFinite(savedCollectionId) ? savedCollectionId : 0;
    state.sort = normalizeSort(stored.sortMode);
    els.sortSelect.value = state.sort;
    const data = await getCollectionData();
    populateCollections(data, Array.isArray(stored.expandedCollectionIds) ? stored.expandedCollectionIds : null);
    await loadCurrentTab();
    await loadBookmarks({ reset: true });
    state.ready = true;
    await consumePendingSave();
  } catch (error) {
    console.error(error);
    if (error.status === 401) setConnected(false);
    showToast(error.message || '初始化失败', 'error');
  }
}

els.settingsButton.addEventListener('click', () => chrome.runtime.openOptionsPage());
els.openSettingsButton.addEventListener('click', () => chrome.runtime.openOptionsPage());
els.sortSelect.addEventListener('change', async () => {
  state.sort = normalizeSort(els.sortSelect.value);
  els.sortSelect.value = state.sort;
  await chrome.storage.local.set({ sortMode: state.sort });
  await loadBookmarks({ reset: true });
});
els.refreshButton.addEventListener('click', async () => {
  try {
    await refreshAfterMutation();
    await loadCurrentTab();
  } catch (error) {
    showToast(error.message || '刷新失败', 'error');
  }
});
els.saveCurrentButton.addEventListener('click', () => openSaveDialog());
els.bulkAddButton.addEventListener('click', openBulkAddDialog);
els.bulkEditButton.addEventListener('click', openBulkEditDialog);
els.bulkDeleteButton.addEventListener('click', removeSelectedBookmarks);
els.collapseAllButton.addEventListener('click', async () => {
  state.expandedCollectionIds.clear();
  await chrome.storage.local.set({ expandedCollectionIds: [] });
  renderCollectionTree();
});
els.selectAllCheckbox.addEventListener('change', () => {
  state.items.forEach(item => {
    if (els.selectAllCheckbox.checked) state.selectedIds.add(Number(item._id));
    else state.selectedIds.delete(Number(item._id));
  });
  renderBookmarks();
});
els.loadMoreButton.addEventListener('click', () => loadBookmarks({ reset: false }));
els.searchInput.addEventListener('input', () => {
  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(() => {
    state.search = els.searchInput.value.trim();
    loadBookmarks({ reset: true });
  }, 320);
});

els.editorForm.addEventListener('submit', submitEditor);
els.optimizeEditorButton.addEventListener('click', runEditorOptimization);
els.editorCloseButton.addEventListener('click', () => closeDialog(els.editorDialog));
els.editorCancelButton.addEventListener('click', () => closeDialog(els.editorDialog));
els.bulkAddForm.addEventListener('submit', submitBulkAdd);
els.bulkAddCloseButton.addEventListener('click', () => closeDialog(els.bulkAddDialog));
els.bulkAddCancelButton.addEventListener('click', () => closeDialog(els.bulkAddDialog));
els.bulkEditForm.addEventListener('submit', submitBulkEdit);
els.bulkEditCloseButton.addEventListener('click', () => closeDialog(els.bulkEditDialog));
els.bulkEditCancelButton.addEventListener('click', () => closeDialog(els.bulkEditDialog));
[
  [els.bulkApplyCollection, els.bulkEditCollectionSelect],
  [els.bulkApplyTags, els.bulkEditTagsInput],
  [els.bulkApplyNote, els.bulkEditNoteInput],
  [els.bulkApplyExcerpt, els.bulkEditExcerptInput]
].forEach(([checkbox, input]) => checkbox.addEventListener('change', () => toggleBulkField(checkbox, input)));
els.confirmForm.addEventListener('submit', event => { event.preventDefault(); finishConfirm(true); });
els.confirmCancelButton.addEventListener('click', () => finishConfirm(false));
els.confirmDialog.addEventListener('cancel', event => { event.preventDefault(); finishConfirm(false); });

chrome.tabs.onActivated.addListener(() => loadCurrentTab());
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.title || changeInfo.status === 'complete')) loadCurrentTab();
});
chrome.runtime.onMessage.addListener(message => {
  if (message?.type === 'OPEN_SAVE_EDITOR') {
    if (state.ready) consumePendingSave();
    else state.pendingSaveWaiting = true;
  }
});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes.raindropToken) bootstrap();
  if (changes.pendingSaveDraft && state.ready) consumePendingSave();
});

initTheme().catch(error => console.error('主题初始化失败：', error));
els.sortSelect.replaceChildren(...SORT_OPTIONS.map(option => new Option(option.label, option.id)));
els.sortSelect.value = DEFAULT_SORT;
bootstrap();
