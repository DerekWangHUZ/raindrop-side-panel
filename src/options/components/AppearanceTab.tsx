import { Monitor, Moon, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldTitle } from '@/components/ui/field'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type EffectiveTheme, type ThemeMode } from '@/lib/theme'

interface AppearanceTabProps {
  themeMode: ThemeMode
  effectiveTheme: EffectiveTheme
  onThemeModeChange: (mode: ThemeMode) => Promise<void>
}

export function AppearanceTab({
  themeMode,
  effectiveTheme,
  onThemeModeChange,
}: AppearanceTabProps) {
  const handleModeChange = async (value: string) => {
    const next = value as ThemeMode
    await onThemeModeChange(next)
    const label = next === 'system' ? '跟随系统' : next === 'light' ? '浅色' : '深色'
    toast.success(`外观模式已切换为「${label}」`)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">明暗模式</CardTitle>
          <CardDescription>
            深色是 Solid Glass 的原生设计基准，浅色为日光版玻璃；当前实际生效为「{effectiveTheme === 'dark' ? '深色' : '浅色'}」。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field orientation="responsive">
              <FieldContent>
                <FieldTitle>主题偏好</FieldTitle>
                <FieldDescription>
                  切换后设置页与侧边栏会实时同步更新。
                </FieldDescription>
              </FieldContent>
              <Tabs value={themeMode} onValueChange={handleModeChange}>
                <TabsList aria-label="明暗模式">
                  <TabsTrigger value="system">
                    <Monitor className="size-3.5" />
                    <span>跟随系统</span>
                  </TabsTrigger>
                  <TabsTrigger value="light">
                    <Sun className="size-3.5" />
                    <span>浅色</span>
                  </TabsTrigger>
                  <TabsTrigger value="dark">
                    <Moon className="size-3.5" />
                    <span>深色</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Solid Glass 材质厚度预览</CardTitle>
          <CardDescription>
            官方三档玻璃厚度严格按层级递增（Panel &lt; Card &lt; Popover），所有表面保持中性灰与边缘高光。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="glass-panel rounded-md p-3">
              <p className="text-sm font-medium">1. Panel / Sidebar</p>
              <p className="mt-1 text-xs text-muted-foreground">最薄档玻璃，用于书签行卡片与收藏夹侧栏</p>
            </div>
            <div className="rounded-xl bg-card p-3">
              <p className="text-sm font-medium">2. Card</p>
              <p className="mt-1 text-xs text-muted-foreground">中档厚度，用于设置分组与当前页快捷保存卡</p>
            </div>
            <div className="rounded-lg bg-popover p-3">
              <p className="text-sm font-medium">3. Popover / Dialog</p>
              <p className="mt-1 text-xs text-muted-foreground">最厚档玻璃，用于弹窗、下拉列表与操作菜单</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
