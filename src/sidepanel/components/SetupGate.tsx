import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

interface SetupGateProps {
  onOpenSettings: () => void
}

export function SetupGate({ onOpenSettings }: SetupGateProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Empty className="max-w-xs border-0 p-2">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <KeyRound className="size-4" />
          </EmptyMedia>
          <EmptyTitle>先连接 Raindrop 账户</EmptyTitle>
          <EmptyDescription>
            在设置页粘贴你的 Raindrop Test Token。该 Token 仅保存在本机扩展存储中，不经过第三方服务器。
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onOpenSettings}>打开设置</Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
