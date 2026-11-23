import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DotLoader } from '@/components/ui/dot-loader'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { ItemGroup } from '@/components/ui/item'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { type RaindropCollection, type RaindropItem } from '@/lib/raindrop'
import { BookmarkItem } from './BookmarkItem'

interface BookmarkListProps {
  items: RaindropItem[]
  total: number
  loading: boolean
  loadingMore: boolean
  hasSearch: boolean
  selectedIds: Set<number>
  selectMode: boolean
  showCollectionBadge: boolean
  showExcerpt: boolean
  collectionsById: Map<number, RaindropCollection>
  onToggleSelect: (id: number, checked: boolean) => void
  onOpen: (item: RaindropItem) => void
  onCopyLink: (item: RaindropItem) => void
  onOptimize: (item: RaindropItem) => void
  onEdit: (item: RaindropItem) => void
  onDelete: (item: RaindropItem) => void
  onTagClick: (tag: string) => void
  onLoadMore: () => void
  onClearSearch: () => void
}

function SkeletonList() {
  return (
    <div className="flex flex-col gap-2 px-3 pb-6" aria-busy="true" aria-label="加载书签中">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-2.5 rounded-xl border border-(--glass-edge) bg-(--panel) px-2.5 py-2.5"
        >
          <Skeleton className="size-9 shrink-0 rounded-sm" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function BookmarkList({
  items,
  total,
  loading,
  loadingMore,
  hasSearch,
  selectedIds,
  selectMode,
  showCollectionBadge,
  showExcerpt,
  collectionsById,
  onToggleSelect,
  onOpen,
  onCopyLink,
  onOptimize,
  onEdit,
  onDelete,
  onTagClick,
  onLoadMore,
  onClearSearch,
}: BookmarkListProps) {
  const showCheckbox = selectMode || selectedIds.size > 0
  const hasMore = items.length > 0 && items.length < total

  if (loading && items.length === 0) {
    return (
      <ScrollArea className="min-h-0 flex-1 pt-1">
        <SkeletonList />
      </ScrollArea>
    )
  }

  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Empty className="max-w-xs border-0 p-2">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search className="size-4" />
            </EmptyMedia>
            <EmptyTitle>这里还没有书签</EmptyTitle>
            <EmptyDescription>
              {hasSearch ? '没有找到匹配的书签，换个关键词试试。' : '当前收藏夹为空，或切换其他收藏夹查看。'}
            </EmptyDescription>
          </EmptyHeader>
          {hasSearch && (
            <EmptyContent>
              <Button variant="glass" size="sm" onClick={onClearSearch}>
                清空搜索条件
              </Button>
            </EmptyContent>
          )}
        </Empty>
      </div>
    )
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-3 px-3 pt-1 pb-20">
        <ItemGroup aria-label="书签列表" className="gap-2">
          {items.map((item) => (
            <BookmarkItem
              key={item._id}
              item={item}
              selected={selectedIds.has(Number(item._id))}
              showCheckbox={showCheckbox}
              showCollectionBadge={showCollectionBadge}
              showExcerpt={showExcerpt}
              collectionsById={collectionsById}
              onToggleSelect={onToggleSelect}
              onOpen={onOpen}
              onCopyLink={onCopyLink}
              onOptimize={onOptimize}
              onEdit={onEdit}
              onDelete={onDelete}
              onTagClick={onTagClick}
            />
          ))}
        </ItemGroup>

        {hasMore && (
          <Button
            variant="glass"
            size="sm"
            disabled={loadingMore}
            onClick={onLoadMore}
            className="w-full"
          >
            {loadingMore ? (
              <>
                <DotLoader />
                <span>加载中…</span>
              </>
            ) : (
              `加载更多 (还有 ${total - items.length} 项)`
            )}
          </Button>
        )}
      </div>
    </ScrollArea>
  )
}
