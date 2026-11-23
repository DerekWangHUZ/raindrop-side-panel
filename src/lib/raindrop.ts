import {
  clearUserCache,
  createRaindrop,
  createRaindrops,
  deleteRaindrop,
  deleteRaindrops,
  getCollectionData,
  getCollections,
  getRaindrop,
  getRaindrops,
  getStoredToken,
  getUser,
  updateRaindrop,
  updateRaindrops,
  validateToken,
} from '../../api.js'
import { loadOptimizeSettings, optimizeFields, saveOptimizeSettings } from '../../optimizer.js'
import { readActivePageMeta, requestPageAccess } from '../../page-meta.js'
import {
  chunkItems,
  DEFAULT_OPTIMIZE_SETTINGS,
  DEFAULT_SORT,
  getItemCollectionId,
  groupItemsByCollection,
  normalizeOptimizeSettings,
  normalizeSort,
  normalizeTags,
  OPTIMIZE_LANGUAGES,
  OPTIMIZE_MODES,
  parseBulkLines,
  SORT_OPTIONS,
  THEME_MODES,
} from '../../utils.mjs'

export interface RaindropCollection {
  _id: number
  title: string
  count?: number
  sort?: number
  expanded?: boolean
  parent?: { $id?: number } | null
}

export interface RaindropGroup {
  title?: string
  hidden?: boolean
  sort?: number
  collections?: number[]
}

export interface RaindropUser {
  _id?: number
  fullName?: string
  email?: string
  groups?: RaindropGroup[]
}

export interface RaindropItem {
  _id: number
  link: string
  title?: string
  excerpt?: string
  note?: string
  domain?: string
  cover?: string
  tags?: string[]
  created?: string
  lastUpdate?: string
  collection?: { $id?: number } | null
  collectionId?: number
}

export interface CollectionTreeNode {
  item: RaindropCollection
  children: CollectionTreeNode[]
}

export interface CollectionTreeGroup {
  title: string
  nodes: CollectionTreeNode[]
}

export interface OptimizeSettings {
  optimizeMode: 'local' | 'ai'
  optimizeApiKey: string
  optimizeApiModel: string
  optimizeApiBase: string
  optimizeApiLanguage: 'auto' | 'zh' | 'en'
}

export interface PendingSaveDraft {
  link: string
  title?: string
  collectionId?: number
  tabId?: number
  windowId?: number
  createdAt?: number
}

export {
  chunkItems,
  clearUserCache,
  createRaindrop,
  createRaindrops,
  DEFAULT_OPTIMIZE_SETTINGS,
  DEFAULT_SORT,
  deleteRaindrop,
  deleteRaindrops,
  getCollectionData,
  getCollections,
  getItemCollectionId,
  getRaindrop,
  getRaindrops,
  getStoredToken,
  getUser,
  groupItemsByCollection,
  loadOptimizeSettings,
  normalizeOptimizeSettings,
  normalizeSort,
  normalizeTags,
  OPTIMIZE_LANGUAGES,
  OPTIMIZE_MODES,
  optimizeFields,
  parseBulkLines,
  readActivePageMeta,
  requestPageAccess,
  saveOptimizeSettings,
  SORT_OPTIONS,
  THEME_MODES,
  updateRaindrop,
  updateRaindrops,
  validateToken,
}

export function buildCollectionTree(
  user: RaindropUser | null,
  roots: RaindropCollection[] = [],
  children: RaindropCollection[] = []
): {
  tree: CollectionTreeGroup[]
  collectionsById: Map<number, RaindropCollection>
} {
  const collectionsById = new Map<number, RaindropCollection>()
  for (const item of [...roots, ...children]) {
    collectionsById.set(Number(item._id), item)
  }

  const childMap = new Map<number, RaindropCollection[]>()
  for (const child of children) {
    const parentId = Number(child.parent?.$id)
    if (!childMap.has(parentId)) childMap.set(parentId, [])
    childMap.get(parentId)!.push(child)
  }
  for (const list of childMap.values()) {
    list.sort((a, b) => (b.sort || 0) - (a.sort || 0))
  }

  const buildNode = (item: RaindropCollection): CollectionTreeNode => ({
    item,
    children: (childMap.get(Number(item._id)) || []).map(buildNode),
  })

  const rootsById = new Map(roots.map((root) => [Number(root._id), root]))
  const seen = new Set<number>()
  const groups = Array.isArray(user?.groups)
    ? [...user.groups]
        .filter((group) => !group.hidden)
        .sort((a, b) => (a.sort || 0) - (b.sort || 0))
    : []

  const tree: CollectionTreeGroup[] = []

  for (const group of groups) {
    const nodes: CollectionTreeNode[] = []
    for (const id of group.collections || []) {
      const root = rootsById.get(Number(id))
      const numericId = Number(root?._id)
      if (!root || seen.has(numericId)) continue
      seen.add(numericId)
      nodes.push(buildNode(root))
    }
    if (nodes.length > 0) {
      tree.push({ title: group.title || '收藏夹', nodes })
    }
  }

  const remaining: CollectionTreeNode[] = []
  for (const root of roots) {
    const numericId = Number(root._id)
    if (seen.has(numericId)) continue
    seen.add(numericId)
    remaining.push(buildNode(root))
  }
  if (remaining.length > 0) {
    tree.push({ title: '', nodes: remaining })
  }

  return { tree, collectionsById }
}

export interface FlatCollectionOption {
  id: number
  label: string
  depth: number
}

export function flattenCollectionOptions(tree: CollectionTreeGroup[]): FlatCollectionOption[] {
  const result: FlatCollectionOption[] = [{ id: -1, label: '未分类', depth: 0 }]
  const seen = new Set<number>()

  const walk = (nodes: CollectionTreeNode[], depth: number) => {
    for (const node of nodes) {
      const id = Number(node.item._id)
      if (seen.has(id)) continue
      seen.add(id)
      const countText = Number.isFinite(node.item.count) ? ` (${node.item.count})` : ''
      result.push({
        id,
        label: `${'\u3000'.repeat(depth)}${node.item.title || '未命名收藏夹'}${countText}`,
        depth,
      })
      walk(node.children, depth + 1)
    }
  }

  for (const group of tree) {
    walk(group.nodes, 0)
  }

  return result
}

export function collectionTitleById(
  id: number,
  collectionsById: Map<number, RaindropCollection>
): string {
  const numericId = Number(id)
  if (numericId === 0) return '全部书签'
  if (numericId === -1) return '未分类'
  return collectionsById.get(numericId)?.title || '收藏夹'
}

export function safeHostname(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(String(value).trim())
    return /^https?:$/i.test(url.protocol)
  } catch {
    return false
  }
}
