import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SelectionDockProps {
  selectedCount: number
  onBulkEdit: () => void
  onBulkDelete: () => void
  onClearSelection: () => void
}

export function SelectionDock({
  selectedCount,
  onBulkEdit,
  onBulkDelete,
  onClearSelection,
}: SelectionDockProps) {
  if (selectedCount === 0) return null

  return (
    <div
      role="region"
      aria-label="批量操作"
      className="fixed inset-x-3 bottom-3 z-40 flex items-center gap-2 rounded-xl bg-popover px-3 py-2 text-popover-foreground animate-float-in"
    >
      <span className="mr-auto text-xs font-medium tabular-nums">
        {selectedCount} 项已选
      </span>
      <Button variant="glass" size="xs" onClick={onBulkEdit}>
        批量编辑
      </Button>
      <Button variant="destructive" size="xs" onClick={onBulkDelete}>
        批量删除
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="取消选择"
        onClick={onClearSelection}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}
