import {
  clearUserCache,
  createRaindrop,
  createRaindrops,
  deleteRaindrop,
  deleteRaindrops,
  getCollections,
  getCollectionData,
  getRaindrop,
  getRaindrops,
  getStoredToken,
  getUser,
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
  topbarActions: document.querySelector('#topbarActions'),
  settingsButton: document.querySelector('#settingsButton'),
  openSettingsButton: document.querySelector('#openSettingsButton'),
  searchInput: document.querySelector('#searchInput'),
  sortSelect: document.querySelector('#sortSelect'),
  panelScroll: document.querySelector('.panel__scroll'),
  refreshButton: document.querySelector('#refreshButton'),
  currentPageTitle: document.querySelector('#currentPageTitle'),
  saveArt: document.querySelector('#saveArt'),
  saveDestination: document.querySelector('#saveDestination'),
  saveCurrentButton: document.querySelector('#saveCurrentButton'),
  bulkAddButton: document.querySelector('#bulkAddButton'),
  selectionActions: document.querySelector('#selectionActions'),
  selectionCount: document.querySelector('#selectionCount'),
  bulkEditButton: document.querySelector('#bulkEditButton'),
  bulkDeleteButton: document.querySelector('#bulkDeleteButton'),
  selectionClearButton: document.querySelector('#selectionClearButton'),
  treeHeader: document.querySelector('#treeHeader'),
  treeCurrentName: document.querySelector('#treeCurrentName'),
  treeBody: document.querySelector('#treeBody'),
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
  bookmarkMenu: document.querySelector('#bookmarkMenu'),
  menuOpenButton: document.querySelector('#menuOpenButton'),
  menuOptimizeButton: document.querySelector('#menuOptimizeButton'),
  menuEditButton: document.querySelector('#menuEditButton'),
  menuDeleteButton: document.querySelector('#menuDeleteButton'),
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
  confirmResolver: null,
  treeOpen: false,
  menuItem: null,
  menuAnchor: null
};

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Build an icon from the inline sprite (copied from the reference project's
 * index.html). The old build mixed emoji with character glyphs, which is what
 * made the panel look unpolished and render differently per platform.
 */
function icon(name, className = 'icon') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.appendChild(use);
  return svg;
}

/** Toggle an icon button's busy state without touching its icon markup. */
function setBusy(element, busy) {
  element.classList.toggle('is-loading', busy);
  element.disabled = busy;
}

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
  // 「批量新增 / 刷新」只在已连接时有意义；设置按钮始终可用。
  els.topbarActions.classList.toggle('hidden', !connected);
  if (!connected) {
    closeBookmarkMenu();
    els.selectionActions.classList.add('hidden');
  }
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
  const name = collectionName(saveTargetId());
  els.saveDestination.textContent = `保存到：${name}`;
  // 收藏夹分组默认收起，标题行必须能说明当前身处哪个收藏夹。
  const current = collectionName(state.selectedCollectionId);
  els.treeCurrentName.textContent = current;
  els.treeCurrentName.title = current;
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

/**
 * Render one collection as a flat list of `li` rows.
 *
 * Rows carry the reference project's `.nav-item` / `.nav-link` classes, so
 * hover and the selected tint come straight from apple-music.css. Children are
 * flattened with an incremented `--depth` instead of nested `<ul>`s: the
 * indentation is purely visual, and flattening keeps the markup valid.
 */
function renderCollectionNode(node, depth) {
  const id = Number(node.item._id);
  const rows = [];
  const row = document.createElement('li');
  row.className = `nav-item collection-item${id === state.selectedCollectionId ? ' nav-item--selected' : ''}`;
  row.style.setProperty('--depth', depth);

  let toggle;
  if (node.children.length) {
    const expanded = state.expandedCollectionIds.has(id);
    toggle = document.createElement('button');
    toggle.className = 'collection-toggle';
    toggle.type = 'button';
    toggle.dataset.expanded = String(expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', '展开或收起子收藏夹');
    toggle.appendChild(icon('chevron-down'));
    toggle.addEventListener('click', async event => {
      event.stopPropagation();
      if (state.expandedCollectionIds.has(id)) state.expandedCollectionIds.delete(id);
      else state.expandedCollectionIds.add(id);
      await chrome.storage.local.set({ expandedCollectionIds: [...state.expandedCollectionIds] });
      renderCollectionTree();
    });
  } else {
    // 叶子节点用一个小圆点占住折叠位，行高与父节点保持一致。
    toggle = document.createElement('span');
    toggle.className = 'collection-dot';
    toggle.setAttribute('aria-hidden', 'true');
  }

  const select = document.createElement('button');
  select.className = 'nav-link collection-label';
  select.type = 'button';
  select.textContent = nodeLabel(node.item);
  select.title = nodeLabel(node.item);
  select.addEventListener('click', () => selectCollection(id));
  row.append(toggle, select);
  rows.push(row);

  if (state.expandedCollectionIds.has(id)) {
    node.children.forEach(child => rows.push(...renderCollectionNode(child, depth + 1)));
  }
  return rows;
}

function renderCollectionTree() {
  els.collectionTree.replaceChildren();
  const special = [
    [0, '全部书签'],
    [-1, '未分类']
  ];
  special.forEach(([id, label]) => {
    const row = document.createElement('li');
    row.className = `nav-item collection-item${state.selectedCollectionId === id ? ' nav-item--selected' : ''}`;
    row.style.setProperty('--depth', 0);
    const glyph = document.createElement('span');
    glyph.className = 'nav-icon collection-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.appendChild(icon(id === 0 ? 'list' : 'grid'));
    const button = document.createElement('button');
    button.className = 'nav-link collection-label';
    button.type = 'button';
    button.textContent = label;
    button.title = label;
    button.addEventListener('click', () => selectCollection(id));
    row.append(glyph, button);
    els.collectionTree.appendChild(row);
  });

  state.collectionTree.forEach(group => {
    if (group.title) {
      const heading = document.createElement('li');
      heading.className = 'collection-group-title';
      heading.textContent = group.title;
      els.collectionTree.appendChild(heading);
    }
    group.nodes.forEach(node => els.collectionTree.append(...renderCollectionNode(node, 0)));
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

/**
 * Cover box content: the photo, or the title's first letter — never both.
 *
 * A layered design (letter underneath, photo on top) looks fine in theory but
 * breaks on real favicons: they are usually a small glyph on a TRANSPARENT
 * background, so `object-fit: cover` scales the glyph up while the transparent
 * margin stays transparent — and the letter underneath shows through. One tile
 * then displays two glyphs. So exactly one element is ever inserted.
 */
function coverContent({ title = '', cover = '', lazy = true } = {}) {
  const initial = document.createElement('span');
  initial.className = 'cover-initial';
  initial.setAttribute('aria-hidden', 'true');
  const seed = String(title || '').trim();
  initial.textContent = seed.charAt(0).toUpperCase() || '·';
  if (!cover) return initial;

  const photo = document.createElement('img');
  photo.className = 'cover-photo';
  photo.src = cover;
  photo.alt = '';
  if (lazy) photo.loading = 'lazy';
  photo.referrerPolicy = 'no-referrer';
  // 取不到图就换成首字。有的服务端返回 200 却给出空 body，那种情况不触发
  // error，只会得到 naturalWidth 为 0 的图片，所以两种都要处理。
  const fallback = () => photo.replaceWith(initial);
  photo.addEventListener('error', fallback, { once: true });
  photo.addEventListener('load', () => { if (!photo.naturalWidth) fallback(); }, { once: true });
  return photo;
}

function openBookmark(item) {
  if (item?.link) chrome.tabs.create({ url: item.link });
}

/**
 * One bookmark row, built from the reference project's `.song-row` markup:
 * `.song-row__img` for the cover square, `.song-row__t` plus its `.sub` line for
 * the two-line label. The old build used a four-column card grid with an excerpt
 * and three always-visible buttons, which read as a spreadsheet.
 *
 * The cover square always renders the title's first letter underneath the photo.
 * A favicon that loads but is blank or transparent would otherwise leave an
 * empty tile, and a broken one would leave nothing at all.
 */
function createBookmarkCard(item) {
  const row = document.createElement('article');
  row.className = 'song-row';
  row.tabIndex = 0;
  row.setAttribute('role', 'link');

  const pick = document.createElement('input');
  pick.type = 'checkbox';
  pick.className = 'pick song-row__pick';
  pick.checked = state.selectedIds.has(Number(item._id));
  pick.setAttribute('aria-label', `选择${item.title || item.link || '书签'}`);
  pick.addEventListener('click', event => event.stopPropagation());
  pick.addEventListener('change', () => {
    const id = Number(item._id);
    if (pick.checked) state.selectedIds.add(id);
    else state.selectedIds.delete(id);
    renderSelectionState();
  });

  const cover = document.createElement('span');
  cover.className = 'song-row__img song-row__cover';
  cover.appendChild(coverContent({ title: item.title || item.domain || '', cover: item.cover }));

  const label = document.createElement('div');
  label.className = 'song-row__t';
  label.appendChild(document.createTextNode(item.title || item.link || '无标题'));
  label.title = item.title || item.link || '';
  const sub = document.createElement('span');
  sub.className = 'sub';
  sub.textContent = item.domain || safeHostname(item.link);
  if (Array.isArray(item.tags) && item.tags.length) {
    item.tags.slice(0, 2).forEach(tagText => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = tagText;
      tag.title = tagText;
      sub.appendChild(tag);
    });
  }
  label.appendChild(sub);

  const more = document.createElement('button');
  more.className = 'pbtn song-row__more';
  more.type = 'button';
  more.title = '更多操作';
  more.setAttribute('aria-label', `更多操作：${item.title || item.link || '书签'}`);
  more.setAttribute('aria-haspopup', 'true');
  more.appendChild(icon('ellipsis'));
  more.addEventListener('click', event => {
    event.stopPropagation();
    // `detail === 0` marks a keyboard-activated click (Enter / Space).
    openBookmarkMenu(item, more, { focusFirst: event.detail === 0 });
  });

  row.append(pick, cover, label, more);

  const open = () => openBookmark(item);
  row.addEventListener('click', event => {
    if (event.target.closest('button,input')) return;
    open();
  });
  row.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button,input')) {
      event.preventDefault();
      open();
    }
  });
  return row;
}

/* ================= 行内操作菜单 ================= */

function closeBookmarkMenu({ restoreFocus = false } = {}) {
  if (els.bookmarkMenu.classList.contains('hidden')) return;
  els.bookmarkMenu.classList.add('hidden');
  const anchor = state.menuAnchor;
  state.menuItem = null;
  state.menuAnchor = null;
  if (restoreFocus && anchor?.isConnected) anchor.focus();
}

function openBookmarkMenu(item, anchor, { focusFirst = false } = {}) {
  if (state.menuAnchor === anchor) {
    closeBookmarkMenu();
    return;
  }
  closeBookmarkMenu();
  state.menuItem = item;
  state.menuAnchor = anchor;

  const menu = els.bookmarkMenu;
  menu.classList.remove('hidden');

  // Measure after showing, then clamp: the side panel can be as narrow as
  // ~300px and a menu anchored to a right-edge button would overflow.
  const rect = anchor.getBoundingClientRect();
  const size = menu.getBoundingClientRect();
  const margin = 8;
  const maxLeft = Math.max(margin, window.innerWidth - size.width - margin);
  menu.style.left = `${Math.round(Math.min(Math.max(margin, rect.right - size.width), maxLeft))}px`;
  const below = rect.bottom + 6;
  menu.style.top = `${Math.round(
    below + size.height + margin <= window.innerHeight
      ? below
      : Math.max(margin, rect.top - size.height - 6)
  )}px`;

  // Only pull focus into the menu for keyboard users: a mouse click already
  // focused the trigger, and moving focus would paint a focus ring there.
  if (focusFirst) menu.querySelector('.nav-link')?.focus();
}

async function runMenuAction(action) {
  const item = state.menuItem;
  const anchor = state.menuAnchor;
  closeBookmarkMenu();
  if (!item) return;

  if (action === 'open') openBookmark(item);
  else if (action === 'optimize') await optimizeBookmarkFromCard(item);
  else if (action === 'edit') await openEditDialog(item);
  else if (action === 'delete') await removeSingleBookmark(item);

  // A mutation rebuilds the row, so the anchor only survives read-only actions.
  if (anchor?.isConnected) anchor.focus();
}

function applyTreeOpen(open, { persist = true } = {}) {
  state.treeOpen = Boolean(open);
  els.treeHeader.setAttribute('aria-expanded', String(state.treeOpen));
  els.treeBody.classList.toggle('hidden', !state.treeOpen);
  if (persist) chrome.storage.local.set({ collectionTreeOpen: state.treeOpen }).catch(() => {});
}

function renderBookmarks({ append = false } = {}) {
  const renderedCount = els.bookmarkList.childElementCount;
  if (append && renderedCount > 0 && renderedCount <= state.items.length) {
    // "Load more" only appends the newly fetched page; rebuilding every card
    // re-decodes cover images and can jump the scroll position.
    els.bookmarkList.append(...state.items.slice(renderedCount).map(createBookmarkCard));
  } else {
    els.bookmarkList.replaceChildren(...state.items.map(createBookmarkCard));
  }
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
  els.bookmarkList.setAttribute('aria-busy', 'true');
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
    renderBookmarks({ append: !reset });
  } catch (error) {
    if (sequence !== state.requestSequence) return;
    console.error(error);
    showToast(error.status === 401 ? 'Token 无效或已失效，请重新设置' : error.message, 'error');
    if (error.status === 401) setConnected(false);
  } finally {
    if (sequence === state.requestSequence) {
      state.loading = false;
      els.loadingLabel.textContent = '';
      els.bookmarkList.removeAttribute('aria-busy');
      renderBookmarks({ append: !reset });
    }
  }
}

function setCurrentPageTitle(title) {
  const text = title || '当前网页';
  els.currentPageTitle.textContent = text;
  els.currentPageTitle.title = text;
}

/** 保存胶囊左侧的封面方框：有 favicon 就只放 favicon，没有就只放标题首字。 */
function renderSaveArt(tab) {
  els.saveArt.replaceChildren(coverContent({
    title: tab?.title || els.currentPageTitle.textContent,
    cover: tab?.favIconUrl || '',
    lazy: false
  }));
}

async function loadCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    state.currentTab = tab || null;
    setCurrentPageTitle(tab?.title);
    renderSaveArt(tab);
  } catch (_) {
    state.currentTab = null;
    setCurrentPageTitle('');
    renderSaveArt(null);
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
  setBusy(els.optimizeEditorButton, false);
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
 * the rules below strip that suffix, which would make a description that
 * repeats the bare title look like a duplicate and get cleared.
 */
async function runEditorOptimization() {
  const link = els.editorLinkInput.value.trim();
  if (!validHttpUrl(link)) return setEditorError('请先填写有效的链接，再进行优化。');

  const button = els.optimizeEditorButton;
  setBusy(button, true);
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
    setBusy(button, false);
  }
}

/** Optimize a bookmark straight from its row, then refresh the list. */
async function optimizeBookmarkFromCard(item) {
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
      // Follow the bookmark into its collection so the new item shows up
      // right away.
      state.selectedCollectionId = collectionId;
      renderCollectionTree();
      updateSaveDestination();
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
    let createdCount = 0;
    try {
      for (let index = 0; index < chunks.length; index += 1) {
        els.bulkAddSubmitButton.textContent = `新增中 ${index + 1}/${chunks.length}…`;
        await createRaindrops(chunks[index], common);
        createdCount += chunks[index].length;
      }
    } catch (error) {
      // Batches already submitted cannot be rolled back, so say how far the
      // run got instead of implying nothing was saved.
      els.bulkAddErrors.textContent = `已完成 ${createdCount}/${parsed.items.length} 条：${error.message || '批量新增失败'}`;
      if (createdCount > 0) await refreshAfterMutation().catch(() => {});
      return;
    }
    closeDialog(els.bulkAddDialog);
    showToast(`已新增 ${parsed.items.length} 条书签`);
    await refreshAfterMutation();
  } catch (error) {
    // Reached only when the batches themselves succeeded and the follow-up
    // refresh failed; the bookmarks are on Raindrop either way.
    els.bulkAddErrors.textContent = `书签已提交，但刷新列表失败：${error.message || '请手动刷新'}`;
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
    let updatedCount = 0;
    try {
      for (const [sourceId, group] of groupItemsByCollection(items)) {
        await updateRaindrops(sourceId, {
          ids: group.map(item => item._id),
          ...updates
        });
        updatedCount += group.length;
      }
    } catch (error) {
      // Groups already submitted cannot be rolled back; report progress so
      // the user knows which part of the selection actually changed.
      els.bulkEditError.textContent = `已更新 ${updatedCount}/${items.length} 条：${error.message || '批量编辑失败'}`;
      if (updatedCount > 0) await refreshAfterMutation().catch(() => {});
      return;
    }
    closeDialog(els.bulkEditDialog);
    state.selectedIds.clear();
    showToast(`已更新 ${updatedCount} 条书签`);
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
    let deletedCount = 0;
    try {
      for (const [sourceId, group] of groupItemsByCollection(items)) {
        await deleteRaindrops(sourceId, group.map(item => item._id));
        deletedCount += group.length;
      }
    } catch (error) {
      // Groups already deleted cannot be rolled back; say how far the run
      // got so the toast does not read as a total failure.
      showToast(`已删除 ${deletedCount}/${items.length} 条：${error.message || '批量删除失败'}`, 'error');
      if (deletedCount > 0) {
        state.selectedIds.clear();
        await refreshAfterMutation().catch(() => {});
      }
      return;
    }
    state.selectedIds.clear();
    showToast(`已删除 ${deletedCount} 条书签`);
    await refreshAfterMutation();
  } catch (error) {
    showToast(error.message || '批量删除失败。', 'error');
  }
}

/**
 * Refresh the panel after data changed on Raindrop.
 *
 * `refreshUser` re-fetches /user (groups, account name); it is off by default
 * because this extension never mutates groups, so the cached user record
 * stays valid and one of the three requests is skipped.
 */
async function refreshAfterMutation({ refreshUser = false } = {}) {
  const [user, collections] = await Promise.all([
    refreshUser ? getUser({ force: true }) : getUser(),
    getCollections()
  ]);
  const stored = await chrome.storage.local.get('expandedCollectionIds');
  populateCollections({ user, ...collections }, Array.isArray(stored.expandedCollectionIds) ? stored.expandedCollectionIds : null);
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
    // 未连接时主内容整块隐藏，收藏夹分组也回到收起态，避免留下半开的 DOM 状态。
    applyTreeOpen(false, { persist: false });
    setConnected(false);
    return;
  }
  setConnected(true);
  try {
    const stored = await chrome.storage.local.get([
      'lastCollectionId',
      'expandedCollectionIds',
      'sortMode',
      'collectionTreeOpen'
    ]);
    const savedCollectionId = Number(stored.lastCollectionId);
    state.selectedCollectionId = Number.isFinite(savedCollectionId) ? savedCollectionId : 0;
    state.sort = normalizeSort(stored.sortMode);
    els.sortSelect.value = state.sort;
    // 收藏夹分组默认收起：打开侧边栏第一眼要看到书签，而不是一屏导航。
    applyTreeOpen(Boolean(stored.collectionTreeOpen), { persist: false });
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
  setBusy(els.refreshButton, true);
  try {
    // Manual refresh is the one action that legitimately suspects the user
    // record (account renamed, groups reordered on another device).
    await refreshAfterMutation({ refreshUser: true });
    await loadCurrentTab();
  } catch (error) {
    showToast(error.message || '刷新失败', 'error');
  } finally {
    setBusy(els.refreshButton, false);
  }
});
els.saveCurrentButton.addEventListener('click', () => openSaveDialog());
els.bulkAddButton.addEventListener('click', openBulkAddDialog);
els.bulkEditButton.addEventListener('click', openBulkEditDialog);
els.bulkDeleteButton.addEventListener('click', removeSelectedBookmarks);
els.selectionClearButton.addEventListener('click', () => {
  state.selectedIds.clear();
  renderBookmarks();
});
els.treeHeader.addEventListener('click', () => applyTreeOpen(!state.treeOpen));
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

/**
 * Let a click on the backdrop dismiss a sheet.
 *
 * The dialog element covers the viewport while only the bottom sheet is
 * visible, so a click outside retargets to the dialog itself; clicks inside the
 * content keep their own target and must be ignored.
 */
function closeOnBackdrop(dialog, onClose) {
  dialog.addEventListener('click', event => {
    if (event.target === dialog) onClose();
  });
}
closeOnBackdrop(els.editorDialog, () => closeDialog(els.editorDialog));
closeOnBackdrop(els.bulkAddDialog, () => closeDialog(els.bulkAddDialog));
closeOnBackdrop(els.bulkEditDialog, () => closeDialog(els.bulkEditDialog));
// The confirm dialog holds a promise, so it must resolve instead of just closing.
closeOnBackdrop(els.confirmDialog, () => finishConfirm(false));

els.menuOpenButton.addEventListener('click', () => runMenuAction('open'));
els.menuOptimizeButton.addEventListener('click', () => runMenuAction('optimize'));
els.menuEditButton.addEventListener('click', () => runMenuAction('edit'));
els.menuDeleteButton.addEventListener('click', () => runMenuAction('delete'));

// The menu is one persistent element, so every dismissal path lives here.
// `pointerdown` in the capture phase runs before the trigger's own click, which
// is why clicks on a row's ••• button are excluded.
document.addEventListener('pointerdown', event => {
  if (els.bookmarkMenu.classList.contains('hidden')) return;
  if (event.target.closest('#bookmarkMenu') || event.target.closest('.song-row__more')) return;
  closeBookmarkMenu();
}, true);
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || els.bookmarkMenu.classList.contains('hidden')) return;
  event.stopPropagation();
  closeBookmarkMenu({ restoreFocus: true });
});
els.panelScroll.addEventListener('scroll', () => closeBookmarkMenu(), { passive: true });
window.addEventListener('resize', () => closeBookmarkMenu());

chrome.tabs.onActivated.addListener(() => loadCurrentTab());
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.title || changeInfo.status === 'complete')) loadCurrentTab();
});
// The background worker nudges the panel right after a context-menu save so a
// panel that finished bootstrapping earlier picks up the draft immediately.
// A panel that is still starting will find the draft at the end of bootstrap,
// and a running panel also hears about it through storage.onChanged below.
// The runtime message is therefore a latency optimization for one narrow
// window, not the main channel.
chrome.runtime.onMessage.addListener(message => {
  if (message?.type === 'OPEN_SAVE_EDITOR' && state.ready) consumePendingSave();
});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  // A different token means a different (or re-logged) account; the cached
  // user record must not leak across tokens.
  if (changes.raindropToken) {
    clearUserCache();
    bootstrap();
  }
  if (changes.pendingSaveDraft && state.ready) consumePendingSave();
});

initTheme().catch(error => console.error('主题初始化失败：', error));
els.sortSelect.replaceChildren(...SORT_OPTIONS.map(option => new Option(option.label, option.id)));
els.sortSelect.value = DEFAULT_SORT;
// Line breaks cannot be written into an HTML attribute without showing a
// literal "\n", so the multi-line placeholder is set from script.
els.bulkAddInput.placeholder = 'https://example.com\n示例页面 | https://example.com/article';
bootstrap();
