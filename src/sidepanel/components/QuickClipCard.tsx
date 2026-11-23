import { ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { CoverMedia } from '@/components/CoverMedia'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { isValidHttpUrl } from '@/lib/raindrop'

interface QuickClipCardProps {
  tab: chrome.tabs.Tab | null
  destinationName: string
  collapsed: boolean
  onToggleCollapse: () => void
  onSaveCurrent: () => void
}

export function QuickClipCard({
  tab,
  destinationName,
  collapsed,
  onToggleCollapse,
  onSaveCurrent,
}: QuickClipCardProps) {
  const canSave = isValidHttpUrl(tab?.url || '')
  const title = tab?.title?.trim() || '当前网页'

  if (collapsed) {
    return (
      <div className="px-3 pb-1.5">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-card px-2.5 py-1.5 ring-1 ring-(--glass-edge)">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className="size-3.5 shrink-0" />
            <span className="truncate">当前页：{title}</span>
          </button>
          <Button
            size="xs"
            disabled={!canSave}
            onClick={onSaveCurrent}
            className="shrink-0"
          >
            <Plus className="size-3" />
            <span>保存</span>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-3 pb-1.5">
      <Card size="sm" className="gap-0 py-2">
        <div className="flex items-center gap-2.5 px-2.5">
          <CoverMedia
            title={title}
            cover={tab?.favIconUrl || ''}
            lazy={false}
            className="size-8"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground" title={title}>
              {title}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {canSave ? `保存到：${destinationName}` : '当前页面不是可保存的 HTTP/HTTPS 网页'}
            </p>
          </div>
          <Button
            size="xs"
            disabled={!canSave}
            onClick={onSaveCurrent}
            className="shrink-0"
          >
            <Plus className="size-3" />
            <span>保存</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="收起当前页保存卡"
            onClick={onToggleCollapse}
            className="shrink-0 text-muted-foreground"
          >
            <ChevronUp className="size-3.5" />
          </Button>
        </div>
      </Card>
    </div>
  )
}
