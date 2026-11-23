import { CheckSquare, Moon, PanelLeft, Plus, RefreshCw, Settings, Sun } from 'lucide-react'
import icon32 from '../../../icons/icon32.png'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DotLoader } from '@/components/ui/dot-loader'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { type EffectiveTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

interface TopBarProps {
  connected: boolean
  collectionTitle: string
  totalCount: number | null
  navOpen: boolean
  selectMode: boolean
  refreshing: boolean
  effectiveTheme: EffectiveTheme
  onToggleNav: () => void
  onOpenBulkAdd: () => void
  onToggleSelectMode: () => void
  onRefresh: () => void
  onToggleTheme: () => void
  onOpenSettings: () => void
}

export function TopBar({
  connected,
  collectionTitle,
  totalCount,
  navOpen,
  selectMode,
  refreshing,
  effectiveTheme,
  onToggleNav,
  onOpenBulkAdd,
  onToggleSelectMode,
  onRefresh,
  onToggleTheme,
  onOpenSettings,
}: TopBarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-border/60 px-2.5">
      {connected ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleNav}
          aria-expanded={navOpen}
          aria-label="切换收藏夹导航"
          className={cn(
            'min-w-0 max-w-[55%] gap-1.5 px-2 font-medium text-foreground',
            navOpen && 'glass-chosen'
          )}
        >
          <PanelLeft className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{collectionTitle}</span>
          {totalCount !== null && totalCount > 0 && (
            <Badge variant="secondary" className="ml-0.5 h-4 px-1.5 text-[10px] tabular-nums">
              {totalCount}
            </Badge>
          )}
        </Button>
      ) : (
        <div className="flex min-w-0 items-center gap-2 px-1">
          <img src={icon32} alt="" className="size-5 shrink-0 rounded-sm" />
          <span className="truncate text-sm font-medium text-foreground">Raindrop</span>
        </div>
      )}

      <div className="ml-auto flex items-center gap-0.5">
        {connected && (
          <>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="批量新增书签"
                    onClick={onOpenBulkAdd}
                  />
                }
              >
                <Plus className="size-4" />
              </TooltipTrigger>
              <TooltipContent>批量新增书签</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={selectMode ? '退出多选模式' : '多选模式'}
                    aria-pressed={selectMode}
                    onClick={onToggleSelectMode}
                    className={cn(selectMode && 'glass-chosen text-foreground')}
                  />
                }
              >
                <CheckSquare className="size-4" />
              </TooltipTrigger>
              <TooltipContent>{selectMode ? '退出多选' : '多选'}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="刷新"
                    disabled={refreshing}
                    onClick={onRefresh}
                  />
                }
              >
                {refreshing ? <DotLoader /> : <RefreshCw className="size-4" />}
              </TooltipTrigger>
              <TooltipContent>刷新</TooltipContent>
            </Tooltip>
          </>
        )}

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={effectiveTheme === 'dark' ? '切到浅色' : '切到深色'}
                onClick={onToggleTheme}
              />
            }
          >
            {effectiveTheme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </TooltipTrigger>
          <TooltipContent>{effectiveTheme === 'dark' ? '浅色模式' : '深色模式'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="打开设置"
                onClick={onOpenSettings}
              />
            }
          >
            <Settings className="size-4" />
          </TooltipTrigger>
          <TooltipContent>设置</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
