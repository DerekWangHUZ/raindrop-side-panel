import { AlignLeft, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SORT_OPTIONS } from '@/lib/raindrop'
import { cn } from '@/lib/utils'

interface SearchToolbarProps {
  searchInputRef: React.RefObject<HTMLInputElement | null>
  search: string
  sort: string
  total: number
  itemCount: number
  selectedCount: number
  selectMode: boolean
  showExcerpt: boolean
  loading: boolean
  onSearchChange: (value: string) => void
  onSortChange: (value: string) => void
  onToggleSelectAll: (checked: boolean) => void
  onToggleExcerpt: () => void
}

export function SearchToolbar({
  searchInputRef,
  search,
  sort,
  total,
  itemCount,
  selectedCount,
  selectMode,
  showExcerpt,
  loading,
  onSearchChange,
  onSortChange,
  onToggleSelectAll,
  onToggleExcerpt,
}: SearchToolbarProps) {
  const allSelected = itemCount > 0 && selectedCount === itemCount
  const indeterminate = selectedCount > 0 && selectedCount < itemCount
  const showPickAll = selectMode || selectedCount > 0
  const activeSortLabel = SORT_OPTIONS.find((option) => option.id === sort)?.label ?? '排序'

  return (
    <div className="flex shrink-0 flex-col gap-2 px-3 pt-2.5 pb-1.5">
      <InputGroup className="h-9">
        <InputGroupAddon>
          <Search className="size-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          ref={searchInputRef}
          type="text"
          autoComplete="off"
          placeholder="搜索全部书签… (⌘K)"
          aria-label="搜索全部书签"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        {search && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label="清空搜索"
              onClick={() => onSearchChange('')}
            >
              <X className="size-3.5" />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>

      <div className="flex min-h-7 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {showPickAll ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground select-none">
              <Checkbox
                checked={allSelected}
                indeterminate={indeterminate}
                onCheckedChange={(checked) => onToggleSelectAll(Boolean(checked))}
                aria-label="选择当前列表全部书签"
              />
              <span className="tabular-nums">
                {selectedCount > 0 ? `已选 ${selectedCount} 项` : '全选当前页'}
              </span>
            </label>
          ) : (
            <div className="flex min-w-0 items-center gap-1.5">
              {search.trim() && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                  全局搜索
                </Badge>
              )}
              <span className="truncate text-xs text-muted-foreground tabular-nums" aria-live="polite">
                {loading && itemCount === 0
                  ? '加载中…'
                  : total > 0
                    ? `共 ${total} 项`
                    : ''}
              </span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={showExcerpt ? '隐藏摘要' : '显示摘要'}
                  aria-pressed={showExcerpt}
                  onClick={onToggleExcerpt}
                  className={cn(showExcerpt && 'glass-chosen text-foreground')}
                />
              }
            >
              <AlignLeft className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>{showExcerpt ? '隐藏摘要预览' : '显示摘要预览'}</TooltipContent>
          </Tooltip>

          <Select
            value={sort}
            onValueChange={(value) => {
              if (value) onSortChange(value)
            }}
          >
            <SelectTrigger size="sm" aria-label="排序方式" className="h-7 max-w-[116px] text-xs">
              <SelectValue>{activeSortLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
