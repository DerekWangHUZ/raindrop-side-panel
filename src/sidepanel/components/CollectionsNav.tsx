import { useMemo, useState } from 'react'
import { ChevronRight, Folder, Inbox, Layers, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { PanelRow } from '@/components/ui/panel'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { type CollectionTreeGroup, type CollectionTreeNode } from '@/lib/raindrop'
import { cn } from '@/lib/utils'

interface CollectionsNavProps {
  open: boolean
  isWide: boolean
  tree: CollectionTreeGroup[]
  selectedId: number
  expandedIds: Set<number>
  onOpenChange: (open: boolean) => void
  onSelectCollection: (id: number) => void
  onToggleExpand: (id: number) => void
  onCollapseAll: () => void
}

function matchesFilter(node: CollectionTreeNode, query: string): boolean {
  if (!query) return true
  if ((node.item.title || '').toLowerCase().includes(query)) return true
  return node.children.some((child) => matchesFilter(child, query))
}

function TreeBranch({
  nodes,
  selectedId,
  expandedIds,
  filterQuery,
  onSelectCollection,
  onToggleExpand,
}: {
  nodes: CollectionTreeNode[]
  selectedId: number
  expandedIds: Set<number>
  filterQuery: string
  onSelectCollection: (id: number) => void
  onToggleExpand: (id: number) => void
}) {
  const visible = nodes.filter((node) => matchesFilter(node, filterQuery))
  if (!visible.length) return null

  return (
    <ul className="flex flex-col gap-0.5">
      {visible.map((node) => {
        const id = Number(node.item._id)
        const hasChildren = node.children.length > 0
        const isExpanded = hasChildren && (Boolean(filterQuery) || expandedIds.has(id))
        const isSelected = selectedId === id

        return (
          <li key={id} className="flex flex-col">
            <div className="flex items-center gap-0.5">
              {hasChildren ? (
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-label={`展开或收起 ${node.item.title}`}
                  onClick={() => onToggleExpand(id)}
                  className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent"
                >
                  <ChevronRight
                    className={cn(
                      'size-3.5 transition-transform duration-150',
                      isExpanded && 'rotate-90'
                    )}
                  />
                </button>
              ) : (
                <span aria-hidden="true" className="size-6 shrink-0" />
              )}

              <PanelRow
                chosen={isSelected}
                onClick={() => onSelectCollection(id)}
                className="min-w-0 flex-1"
                title={node.item.title}
              >
                <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{node.item.title || '未命名收藏夹'}</span>
                {Number.isFinite(node.item.count) && (
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {node.item.count}
                  </span>
                )}
              </PanelRow>
            </div>

            {hasChildren && isExpanded && (
              <div className="ml-3 border-l border-border/70 pl-1.5">
                <TreeBranch
                  nodes={node.children}
                  selectedId={selectedId}
                  expandedIds={expandedIds}
                  filterQuery={filterQuery}
                  onSelectCollection={onSelectCollection}
                  onToggleExpand={onToggleExpand}
                />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function CollectionsContent({
  tree,
  selectedId,
  expandedIds,
  onSelectCollection,
  onToggleExpand,
  onCollapseAll,
}: Omit<CollectionsNavProps, 'open' | 'isWide' | 'onOpenChange'>) {
  const [filter, setFilter] = useState('')
  const query = useMemo(() => filter.trim().toLowerCase(), [filter])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-2">
        <InputGroup className="h-8">
          <InputGroupAddon>
            <Search className="size-3.5" />
          </InputGroupAddon>
          <InputGroupInput
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="筛选收藏夹…"
            aria-label="筛选收藏夹"
          />
          {filter && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label="清空收藏夹筛选"
                onClick={() => setFilter('')}
              >
                <X className="size-3" />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2">
        <div className="flex flex-col gap-0.5 pb-4">
          <PanelRow chosen={selectedId === 0} onClick={() => onSelectCollection(0)}>
            <Layers className="size-3.5 shrink-0" />
            <span className="flex-1 truncate">全部书签</span>
          </PanelRow>
          <PanelRow chosen={selectedId === -1} onClick={() => onSelectCollection(-1)}>
            <Inbox className="size-3.5 shrink-0" />
            <span className="flex-1 truncate">未分类</span>
          </PanelRow>

          {tree.map((group, index) => {
            const hasMatch = group.nodes.some((node) => matchesFilter(node, query))
            if (!hasMatch) return null
            return (
              <div key={group.title || `group-${index}`} className="mt-3">
                {group.title && (
                  <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
                    {group.title}
                  </p>
                )}
                <TreeBranch
                  nodes={group.nodes}
                  selectedId={selectedId}
                  expandedIds={expandedIds}
                  filterQuery={query}
                  onSelectCollection={onSelectCollection}
                  onToggleExpand={onToggleExpand}
                />
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {expandedIds.size > 0 && (
        <div className="flex items-center justify-end border-t border-border/60 px-3 py-2">
          <Button variant="ghost" size="xs" onClick={onCollapseAll} className="text-muted-foreground">
            全部收起
          </Button>
        </div>
      )}
    </div>
  )
}

export function CollectionsNav({
  open,
  isWide,
  onOpenChange,
  onSelectCollection,
  ...rest
}: CollectionsNavProps) {
  const handleSelect = (id: number) => {
    onSelectCollection(id)
    if (!isWide) onOpenChange(false)
  }

  if (isWide) {
    if (!open) return null
    return (
      <aside className="flex w-56 shrink-0 flex-col border-r border-border/60 bg-sidebar pt-3">
        <CollectionsContent {...rest} onSelectCollection={handleSelect} />
      </aside>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-[272px] max-w-[85vw] flex-col bg-sidebar p-0"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm font-medium">收藏夹</SheetTitle>
        </SheetHeader>
        <CollectionsContent {...rest} onSelectCollection={handleSelect} />
      </SheetContent>
    </Sheet>
  )
}
