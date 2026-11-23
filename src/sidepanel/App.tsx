import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import {
  buildCollectionTree,
  clearUserCache,
  collectionTitleById,
  type CollectionTreeGroup,
  createRaindrop,
  DEFAULT_SORT,
  deleteRaindrop,
  deleteRaindrops,
  flattenCollectionOptions,
  getCollectionData,
  getCollections,
  getRaindrop,
  getRaindrops,
  getStoredToken,
  getUser,
  groupItemsByCollection,
  isValidHttpUrl,
  normalizeSort,
  optimizeFields,
  type PendingSaveDraft,
  type RaindropCollection,
  type RaindropItem,
  updateRaindrop,
} from '@/lib/raindrop'
import { type EffectiveTheme, initTheme, saveThemeSettings } from '@/lib/theme'
import { BookmarkEditorDialog } from './components/BookmarkEditorDialog'
import { BookmarkList } from './components/BookmarkList'
import { BulkAddDialog } from './components/BulkAddDialog'
import { BulkEditDialog } from './components/BulkEditDialog'
import { CollectionsNav } from './components/CollectionsNav'
import { ConfirmDeleteDialog } from './components/ConfirmDeleteDialog'
import { QuickClipCard } from './components/QuickClipCard'
import { SearchToolbar } from './components/SearchToolbar'
import { SelectionDock } from './components/SelectionDock'
import { SetupGate } from './components/SetupGate'
import { TopBar } from './components/TopBar'

const WIDE_BREAKPOINT = '(min-width: 720px)'

export function App() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>('dark')
  const [isWide, setIsWide] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(WIDE_BREAKPOINT).matches : false
  )
  const [navOpen, setNavOpen] = useState(false)

  const [selectedCollectionId, setSelectedCollectionId] = useState(0)
  const [collectionTree, setCollectionTree] = useState<CollectionTreeGroup[]>([])
  const [collectionsById, setCollectionsById] = useState<Map<number, RaindropCollection>>(
    () => new Map()
  )
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set())

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [selectMode, setSelectMode] = useState(false)
  const [showExcerpt, setShowExcerpt] = useState(false)
  const [quickClipCollapsed, setQuickClipCollapsed] = useState(false)

  const [items, setItems] = useState<RaindropItem[]>([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set())
  const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null)

  const [editorState, setEditorState] = useState<{
    open: boolean
    mode: 'create' | 'edit'
    item: Partial<RaindropItem> | null
  }>({ open: false, mode: 'create', item: null })
  const [bulkAddOpen, setBulkAddOpen] = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    message: string
    busy: boolean
    target: { kind: 'single'; item: RaindropItem } | { kind: 'bulk'; items: RaindropItem[] } | null
  }>({ open: false, message: '', busy: false, target: null })

  const requestSeqRef = useRef(0)
  const readyRef = useRef(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const selectedCollectionRef = useRef(selectedCollectionId)
  selectedCollectionRef.current = selectedCollectionId

  const collectionOptions = useMemo(
    () => flattenCollectionOptions(collectionTree),
    [collectionTree]
  )

  const currentCollectionTitle = useMemo(
    () => collectionTitleById(selectedCollectionId, collectionsById),
    [selectedCollectionId, collectionsById]
  )

  const saveTargetId = selectedCollectionId === 0 ? -1 : selectedCollectionId
  const saveDestinationName = useMemo(
    () => collectionTitleById(saveTargetId, collectionsById),
    [saveTargetId, collectionsById]
  )

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(Number(item._id))),
    [items, selectedIds]
  )

  const loadCurrentTab = useCallback(async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      setCurrentTab(tab || null)
      return tab || null
    } catch {
      setCurrentTab(null)
      return null
    }
  }, [])

  const syncCollections = useCallback(
    (
      data: { user: any; roots: RaindropCollection[]; children: RaindropCollection[] },
      storedExpanded: number[] | null
    ) => {
      const { tree, collectionsById: byId } = buildCollectionTree(
        data.user,
        data.roots,
        data.children
      )
      setCollectionTree(tree)
      setCollectionsById(byId)

      if (Array.isArray(storedExpanded)) {
        setExpandedIds(new Set(storedExpanded.map(Number).filter(Number.isFinite)))
      } else {
        setExpandedIds(
          new Set(
            [...byId.values()]
              .filter((item) => item.expanded)
              .map((item) => Number(item._id))
          )
        )
      }

      const currentId = selectedCollectionRef.current
      const exists = currentId === 0 || currentId === -1 || byId.has(currentId)
      if (!exists) {
        setSelectedCollectionId(0)
        chrome.storage.local.set({ lastCollectionId: 0 }).catch(() => {})
      }
    },
    []
  )

  const loadBookmarks = useCallback(
    async ({
      collectionId = selectedCollectionRef.current,
      search = debouncedSearch,
      sortMode = sort,
      reset = true,
      targetPage = 0,
    }: {
      collectionId?: number
      search?: string
      sortMode?: string
      reset?: boolean
      targetPage?: number
    } = {}) => {
      const seq = ++requestSeqRef.current
      const effectiveCollection = search ? 0 : collectionId
      const nextPage = reset ? 0 : targetPage

      if (reset) {
        setLoading(true)
        setSelectedIds(new Set())
      } else {
        setLoadingMore(true)
      }

      try {
        const data = await getRaindrops(effectiveCollection, {
          search,
          page: nextPage,
          perpage: 30,
          nested: Boolean(search),
          sort: sortMode,
        })
        if (seq !== requestSeqRef.current) return
        const fetched = (data?.items || []) as RaindropItem[]
        setPage(nextPage)
        setItems((prev) => (reset ? fetched : [...prev, ...fetched]))
        setTotal(Number(data?.count) || (reset ? fetched.length : 0))
      } catch (error: any) {
        if (seq !== requestSeqRef.current) return
        const message =
          error?.status === 401
            ? 'Token 无效或已失效，请重新设置'
            : error?.message || '加载书签失败'
        toast.error(message)
        if (error?.status === 401) setConnected(false)
      } finally {
        if (seq === requestSeqRef.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [debouncedSearch, sort]
  )

  const refreshAfterMutation = useCallback(
    async ({ refreshUser = false }: { refreshUser?: boolean } = {}) => {
      const [user, collections, stored] = await Promise.all([
        refreshUser ? getUser({ force: true }) : getUser(),
        getCollections(),
        chrome.storage.local.get('expandedCollectionIds'),
      ])
      syncCollections(
        { user, ...collections },
        Array.isArray(stored.expandedCollectionIds) ? stored.expandedCollectionIds : null
      )
      await loadBookmarks({ reset: true })
    },
    [loadBookmarks, syncCollections]
  )

  const openSaveDialog = useCallback(
    async (draft: PendingSaveDraft | null = null) => {
      let item: Partial<RaindropItem>
      if (draft) {
        item = {
          link: draft.link,
          title: draft.title || '',
          collectionId: draft.collectionId ?? saveTargetId,
        }
      } else {
        const tab = await loadCurrentTab()
        item = {
          link: tab?.url || '',
          title: tab?.title || '',
          collectionId: saveTargetId,
        }
      }

      if (!isValidHttpUrl(item.link || '')) {
        toast.error('当前页面不是可保存的 HTTP/HTTPS 网页')
        return
      }
      setEditorState({ open: true, mode: 'create', item })
    },
    [loadCurrentTab, saveTargetId]
  )

  const consumePendingSave = useCallback(async () => {
    const { pendingSaveDraft } = await chrome.storage.local.get('pendingSaveDraft')
    const draft = pendingSaveDraft as PendingSaveDraft | undefined
    if (!draft) return
    await chrome.storage.local.remove('pendingSaveDraft')
    if (Date.now() - Number(draft.createdAt || 0) > 10 * 60 * 1000) return
    await openSaveDialog(draft)
  }, [openSaveDialog])

  const bootstrap = useCallback(async () => {
    readyRef.current = false
    const token = await getStoredToken()
    if (!token) {
      setConnected(false)
      return
    }
    setConnected(true)

    try {
      const stored = await chrome.storage.local.get([
        'lastCollectionId',
        'expandedCollectionIds',
        'sortMode',
        'quickClipCollapsed',
      ])
      const savedCollectionId = Number(stored.lastCollectionId)
      const initialCollection = Number.isFinite(savedCollectionId) ? savedCollectionId : 0
      const initialSort = normalizeSort(stored.sortMode)

      setSelectedCollectionId(initialCollection)
      selectedCollectionRef.current = initialCollection
      setSort(initialSort)
      setQuickClipCollapsed(Boolean(stored.quickClipCollapsed))

      const data = await getCollectionData()
      syncCollections(
        data,
        Array.isArray(stored.expandedCollectionIds) ? stored.expandedCollectionIds : null
      )
      await loadCurrentTab()
      await loadBookmarks({
        collectionId: initialCollection,
        search: '',
        sortMode: initialSort,
        reset: true,
      })
      readyRef.current = true
      await consumePendingSave()
    } catch (error: any) {
      if (error?.status === 401) setConnected(false)
      toast.error(error?.message || '初始化失败')
    }
  }, [consumePendingSave, loadBookmarks, loadCurrentTab, syncCollections])

  // Initial boot + theme + responsive listener
  useEffect(() => {
    void initTheme((next) => setEffectiveTheme(next.effectiveTheme))
    void bootstrap()

    const mq = window.matchMedia(WIDE_BREAKPOINT)
    const onMqChange = () => {
      setIsWide(mq.matches)
      setNavOpen(mq.matches)
    }
    setNavOpen(mq.matches)
    mq.addEventListener?.('change', onMqChange)

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      } else if (
        event.key === '/' &&
        !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
      ) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      mq.removeEventListener?.('change', onMqChange)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [bootstrap])

  // Debounced search effect
  const searchMountedRef = useRef(false)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    if (!searchMountedRef.current) {
      searchMountedRef.current = true
      return
    }
    if (!connected) return
    void loadBookmarks({ search: debouncedSearch, reset: true })
  }, [debouncedSearch, connected, loadBookmarks])

  // Chrome tabs, runtime & storage listeners
  useEffect(() => {
    if (typeof chrome === 'undefined') return
    const onTabActivated = () => void loadCurrentTab()
    const onTabUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (tab.active && (changeInfo.url || changeInfo.title || changeInfo.status === 'complete')) {
        void loadCurrentTab()
      }
    }
    const onMessage = (message: any) => {
      if (message?.type === 'OPEN_SAVE_EDITOR' && readyRef.current) {
        void consumePendingSave()
      }
    }
    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== 'local') return
      if (changes.raindropToken) {
        clearUserCache()
        void bootstrap()
      }
      if (changes.pendingSaveDraft && readyRef.current) {
        void consumePendingSave()
      }
    }

    chrome.tabs?.onActivated?.addListener(onTabActivated)
    chrome.tabs?.onUpdated?.addListener(onTabUpdated)
    chrome.runtime?.onMessage?.addListener(onMessage)
    chrome.storage?.onChanged?.addListener(onStorageChanged)

    return () => {
      chrome.tabs?.onActivated?.removeListener(onTabActivated)
      chrome.tabs?.onUpdated?.removeListener(onTabUpdated)
      chrome.runtime?.onMessage?.removeListener(onMessage)
      chrome.storage?.onChanged?.removeListener(onStorageChanged)
    }
  }, [bootstrap, consumePendingSave, loadCurrentTab])

  const handleSelectCollection = async (id: number) => {
    setSelectedCollectionId(id)
    selectedCollectionRef.current = id
    await chrome.storage.local.set({ lastCollectionId: id })
    await loadBookmarks({ collectionId: id, reset: true })
  }

  const handleToggleExpand = async (id: number) => {
    const next = new Set(expandedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedIds(next)
    await chrome.storage.local.set({ expandedCollectionIds: [...next] })
  }

  const handleCollapseAll = async () => {
    setExpandedIds(new Set())
    await chrome.storage.local.set({ expandedCollectionIds: [] })
  }

  const handleSortChange = async (nextSort: string) => {
    const normalized = normalizeSort(nextSort)
    setSort(normalized)
    await chrome.storage.local.set({ sortMode: normalized })
    await loadBookmarks({ sortMode: normalized, reset: true })
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshAfterMutation({ refreshUser: true })
      await loadCurrentTab()
    } catch (error: any) {
      toast.error(error?.message || '刷新失败')
    } finally {
      setRefreshing(false)
    }
  }

  const handleOpenBookmark = (item: RaindropItem) => {
    if (item?.link) chrome.tabs.create({ url: item.link })
  }

  const handleCopyLink = async (item: RaindropItem) => {
    if (!item?.link) return
    try {
      await navigator.clipboard.writeText(item.link)
      toast.success('链接已复制到剪贴板')
    } catch {
      toast.error('复制失败')
    }
  }

  const handleOptimizeFromRow = async (item: RaindropItem) => {
    try {
      const result = await optimizeFields({
        link: item.link,
        title: item.title,
        excerpt: item.excerpt,
      })
      if (!result.changed) {
        toast('没有需要优化的地方')
        return
      }
      await updateRaindrop(item._id, { title: result.title, excerpt: result.excerpt })
      toast.success('已优化书签名和摘要')
      await refreshAfterMutation().catch(() => {})
    } catch (error: any) {
      toast.error(error?.message || '优化失败')
    }
  }

  const handleOpenEdit = async (item: RaindropItem) => {
    try {
      const fresh = await getRaindrop(item._id)
      setEditorState({ open: true, mode: 'edit', item: fresh || item })
    } catch {
      setEditorState({ open: true, mode: 'edit', item })
    }
  }

  const handleSubmitEditor = async (payload: {
    mode: 'create' | 'edit'
    id?: number
    link: string
    title: string
    collectionId: number
    tags: string[]
    note: string
    excerpt: string
  }) => {
    if (payload.mode === 'edit' && payload.id) {
      await updateRaindrop(payload.id, payload)
      toast.success('书签已更新')
    } else {
      await createRaindrop(payload)
      await chrome.storage.local.set({ lastCollectionId: payload.collectionId })
      setSelectedCollectionId(payload.collectionId)
      selectedCollectionRef.current = payload.collectionId
      toast.success(`已保存到「${collectionTitleById(payload.collectionId, collectionsById)}」`)
    }
    await refreshAfterMutation()
  }

  const handleConfirmDelete = async () => {
    const target = deleteDialog.target
    if (!target) return
    setDeleteDialog((prev) => ({ ...prev, busy: true }))

    try {
      if (target.kind === 'single') {
        await deleteRaindrop(target.item._id)
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(Number(target.item._id))
          return next
        })
        toast.success('书签已移入 Trash')
        setDeleteDialog({ open: false, message: '', busy: false, target: null })
        await refreshAfterMutation()
      } else {
        let deletedCount = 0
        try {
          for (const [sourceId, group] of groupItemsByCollection(target.items)) {
            await deleteRaindrops(
              sourceId,
              group.map((item: RaindropItem) => item._id)
            )
            deletedCount += group.length
          }
          setSelectedIds(new Set())
          setSelectMode(false)
          toast.success(`已删除 ${deletedCount} 条书签`)
          setDeleteDialog({ open: false, message: '', busy: false, target: null })
          await refreshAfterMutation()
        } catch (error: any) {
          toast.error(`已删除 ${deletedCount}/${target.items.length} 条：${error?.message || '批量删除失败'}`)
          if (deletedCount > 0) {
            setSelectedIds(new Set())
            await refreshAfterMutation().catch(() => {})
          }
          setDeleteDialog({ open: false, message: '', busy: false, target: null })
        }
      }
    } catch (error: any) {
      toast.error(error?.message || '删除失败')
      setDeleteDialog((prev) => ({ ...prev, busy: false }))
    }
  }

  const openOptions = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage()
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      <TopBar
        connected={Boolean(connected)}
        collectionTitle={currentCollectionTitle}
        totalCount={connected ? total : null}
        navOpen={navOpen}
        selectMode={selectMode}
        refreshing={refreshing}
        effectiveTheme={effectiveTheme}
        onToggleNav={() => setNavOpen((prev) => !prev)}
        onOpenBulkAdd={() => setBulkAddOpen(true)}
        onToggleSelectMode={() => {
          setSelectMode((prev) => {
            if (prev) setSelectedIds(new Set())
            return !prev
          })
        }}
        onRefresh={() => void handleRefresh()}
        onToggleTheme={() =>
          void saveThemeSettings({ themeMode: effectiveTheme === 'dark' ? 'light' : 'dark' })
        }
        onOpenSettings={openOptions}
      />

      {connected === false && <SetupGate onOpenSettings={openOptions} />}

      {connected === true && (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <CollectionsNav
            open={navOpen}
            isWide={isWide}
            tree={collectionTree}
            selectedId={selectedCollectionId}
            expandedIds={expandedIds}
            onOpenChange={setNavOpen}
            onSelectCollection={(id) => void handleSelectCollection(id)}
            onToggleExpand={(id) => void handleToggleExpand(id)}
            onCollapseAll={() => void handleCollapseAll()}
          />

          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <SearchToolbar
              searchInputRef={searchInputRef}
              search={searchInput}
              sort={sort}
              total={total}
              itemCount={items.length}
              selectedCount={selectedItems.length}
              selectMode={selectMode}
              showExcerpt={showExcerpt}
              loading={loading}
              onSearchChange={setSearchInput}
              onSortChange={(nextSort) => void handleSortChange(nextSort)}
              onToggleSelectAll={(checked) => {
                if (checked) {
                  setSelectedIds(new Set(items.map((item) => Number(item._id))))
                } else {
                  setSelectedIds(new Set())
                }
              }}
              onToggleExcerpt={() => setShowExcerpt((prev) => !prev)}
            />

            <QuickClipCard
              tab={currentTab}
              destinationName={saveDestinationName}
              collapsed={quickClipCollapsed}
              onToggleCollapse={() => {
                setQuickClipCollapsed((prev) => {
                  const next = !prev
                  chrome.storage.local.set({ quickClipCollapsed: next }).catch(() => {})
                  return next
                })
              }}
              onSaveCurrent={() => void openSaveDialog()}
            />

            <BookmarkList
              items={items}
              total={total}
              loading={loading}
              loadingMore={loadingMore}
              hasSearch={Boolean(debouncedSearch)}
              selectedIds={selectedIds}
              selectMode={selectMode}
              showCollectionBadge={Boolean(debouncedSearch) || selectedCollectionId === 0}
              showExcerpt={showExcerpt}
              collectionsById={collectionsById}
              onToggleSelect={(id, checked) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev)
                  if (checked) next.add(id)
                  else next.delete(id)
                  return next
                })
              }}
              onOpen={handleOpenBookmark}
              onCopyLink={(item) => void handleCopyLink(item)}
              onOptimize={(item) => void handleOptimizeFromRow(item)}
              onEdit={(item) => void handleOpenEdit(item)}
              onDelete={(item) =>
                setDeleteDialog({
                  open: true,
                  busy: false,
                  target: { kind: 'single', item },
                  message: `确定删除“${item.title || item.link || '这条书签'}”吗？删除后会移入 Raindrop Trash。`,
                })
              }
              onTagClick={(tag) => setSearchInput(`#${tag}`)}
              onLoadMore={() => void loadBookmarks({ reset: false, targetPage: page + 1 })}
              onClearSearch={() => setSearchInput('')}
            />
          </main>
        </div>
      )}

      <SelectionDock
        selectedCount={selectedItems.length}
        onBulkEdit={() => setBulkEditOpen(true)}
        onBulkDelete={() =>
          setDeleteDialog({
            open: true,
            busy: false,
            target: { kind: 'bulk', items: selectedItems },
            message: `确定删除已选的 ${selectedItems.length} 条书签吗？它们会移入 Raindrop Trash。`,
          })
        }
        onClearSelection={() => {
          setSelectedIds(new Set())
          setSelectMode(false)
        }}
      />

      <BookmarkEditorDialog
        open={editorState.open}
        mode={editorState.mode}
        initialItem={editorState.item}
        defaultCollectionId={saveTargetId}
        collectionOptions={collectionOptions}
        onOpenChange={(open) => setEditorState((prev) => ({ ...prev, open }))}
        onSubmit={handleSubmitEditor}
      />

      <BulkAddDialog
        open={bulkAddOpen}
        defaultCollectionId={saveTargetId}
        collectionOptions={collectionOptions}
        onOpenChange={setBulkAddOpen}
        onCompleted={async (count) => {
          toast.success(`已新增 ${count} 条书签`)
          await refreshAfterMutation()
        }}
      />

      <BulkEditDialog
        open={bulkEditOpen}
        items={selectedItems}
        defaultCollectionId={saveTargetId}
        collectionOptions={collectionOptions}
        onOpenChange={setBulkEditOpen}
        onCompleted={async (count) => {
          setSelectedIds(new Set())
          setSelectMode(false)
          toast.success(`已更新 ${count} 条书签`)
          await refreshAfterMutation()
        }}
      />

      <ConfirmDeleteDialog
        open={deleteDialog.open}
        message={deleteDialog.message}
        busy={deleteDialog.busy}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
        onConfirm={handleConfirmDelete}
      />

      <Toaster position="bottom-center" theme={effectiveTheme} />
    </div>
  )
}
