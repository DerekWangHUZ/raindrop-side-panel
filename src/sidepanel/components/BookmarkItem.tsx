import {
  Copy,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { CoverMedia } from '@/components/CoverMedia'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Tag } from '@/components/ui/tag'
import {
  collectionTitleById,
  getItemCollectionId,
  type RaindropCollection,
  type RaindropItem,
  safeHostname,
} from '@/lib/raindrop'
import { cn } from '@/lib/utils'

interface BookmarkItemProps {
  item: RaindropItem
  selected: boolean
  showCheckbox: boolean
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
}

export function BookmarkItem({
  item,
  selected,
  showCheckbox,
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
}: BookmarkItemProps) {
  const id = Number(item._id)
  const title = item.title || item.link || '无标题'
  const domain = item.domain || safeHostname(item.link)
  const tags = Array.isArray(item.tags) ? item.tags : []
  const visibleTags = tags.slice(0, 2)
  const extraTagCount = tags.length - visibleTags.length
  const collectionName = showCollectionBadge
    ? collectionTitleById(getItemCollectionId(item), collectionsById)
    : ''

  return (
    <Item
      variant="outline"
      size="sm"
      role="listitem"
      tabIndex={0}
      aria-label={title}
      onClick={(event) => {
        const target = event.target as HTMLElement
        if (target.closest('button, input, [role="checkbox"], [data-slot="tag"]')) return
        onOpen(item)
      }}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement
        if (target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(item)
        }
      }}
      className={cn(
        'cursor-pointer flex-nowrap items-start gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-(--hover)',
        selected && 'glass-chosen'
      )}
    >
      <div
        className={cn(
          'flex items-center self-center transition-all duration-150',
          showCheckbox || selected
            ? 'w-4 opacity-100'
            : 'w-0 overflow-hidden opacity-0 group-hover/item:w-4 group-hover/item:overflow-visible group-hover/item:opacity-100 group-focus-within/item:w-4 group-focus-within/item:overflow-visible group-focus-within/item:opacity-100'
        )}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onToggleSelect(id, Boolean(checked))}
          aria-label={`选择 ${title}`}
        />
      </div>

      <ItemMedia variant="image" className="mt-0.5 size-9">
        <CoverMedia title={title || domain} cover={item.cover || ''} />
      </ItemMedia>

      <ItemContent className="min-w-0 gap-0.5">
        <ItemTitle className="w-full max-w-full text-[13.5px] leading-snug font-medium text-foreground">
          <span className="line-clamp-2 break-words">{title}</span>
        </ItemTitle>

        {showExcerpt && item.excerpt && (
          <p className="line-clamp-1 text-xs text-muted-foreground/90 select-text">
            {item.excerpt}
          </p>
        )}

        <ItemDescription className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {domain && <span className="truncate max-w-[140px] select-text">{domain}</span>}
          {collectionName && (
            <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
              {collectionName}
            </Badge>
          )}
          {visibleTags.map((tag) => (
            <Tag
              key={tag}
              onClick={(event) => {
                event.stopPropagation()
                onTagClick(tag)
              }}
              className="h-5 cursor-pointer px-1.5 text-[11px] hover:bg-(--hover)"
              title={`按标签「${tag}」搜索`}
            >
              {tag}
            </Tag>
          ))}
          {extraTagCount > 0 && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              +{extraTagCount}
            </span>
          )}
        </ItemDescription>
      </ItemContent>

      <ItemActions className="shrink-0 self-center">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`更多操作：${title}`}
                className="text-muted-foreground opacity-70 transition-opacity group-hover/item:opacity-100 group-focus-within/item:opacity-100 data-popup-open:opacity-100 data-[state=open]:opacity-100"
              />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onOpen(item)}>
              <ExternalLink className="size-4" />
              <span>打开链接</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCopyLink(item)}>
              <Copy className="size-4" />
              <span>复制链接</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOptimize(item)}>
              <Sparkles className="size-4" />
              <span>优化标题与摘要</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(item)}>
              <Pencil className="size-4" />
              <span>编辑</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(item)}>
              <Trash2 className="size-4" />
              <span>删除</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ItemActions>
    </Item>
  )
}
