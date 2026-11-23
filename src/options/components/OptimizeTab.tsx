import { useEffect, useState } from 'react'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  OPTIMIZE_LANGUAGES,
  OPTIMIZE_MODES,
  type OptimizeSettings,
  saveOptimizeSettings,
} from '@/lib/raindrop'

interface OptimizeTabProps {
  settings: OptimizeSettings
  onSettingsChange: (next: OptimizeSettings) => void
}

export function OptimizeTab({ settings, onSettingsChange }: OptimizeTabProps) {
  const [showKey, setShowKey] = useState(false)
  const [apiBase, setApiBase] = useState(settings.optimizeApiBase)
  const [apiKey, setApiKey] = useState(settings.optimizeApiKey)
  const [apiModel, setApiModel] = useState(settings.optimizeApiModel)

  useEffect(() => {
    setApiBase(settings.optimizeApiBase)
    setApiKey(settings.optimizeApiKey)
    setApiModel(settings.optimizeApiModel)
  }, [settings.optimizeApiBase, settings.optimizeApiKey, settings.optimizeApiModel])

  const commitPatch = async (patch: Partial<OptimizeSettings>, message?: string) => {
    const next = (await saveOptimizeSettings(patch)) as OptimizeSettings
    onSettingsChange(next)
    setApiBase(next.optimizeApiBase)
    setApiKey(next.optimizeApiKey)
    setApiModel(next.optimizeApiModel)
    if (message) toast.success(message)
  }

  const handleGrantAccess = async () => {
    const trimmed = apiBase.trim()
    let origin = ''
    try {
      origin = new URL(trimmed).origin
    } catch {
      toast.error('请先填写有效的 HTTP/HTTPS API 地址')
      return
    }
    if (!origin || origin === 'null') {
      toast.error('该 API 地址不是有效的 HTTP/HTTPS 地址')
      return
    }

    try {
      const granted = await chrome.permissions.request({ origins: [`${origin}/*`] })
      if (granted) {
        toast.success(`已授权访问 ${origin}`)
      } else {
        toast.error(`未获得 ${origin} 的访问授权，AI 优化将无法请求该地址`)
      }
    } catch (error) {
      toast.error(`请求授权失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">书签名与摘要优化方式</CardTitle>
        <CardDescription>
          仅在弹窗点击「优化」按钮或行内菜单执行「优化标题与摘要」时触发，平时不改动任何数据。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <FieldGroup>
          <Field orientation="responsive">
            <FieldContent>
              <FieldTitle>默认优化引擎</FieldTitle>
              <FieldDescription>
                {settings.optimizeMode === 'local'
                  ? '本地规则：纯前端剥离站点名后缀与摘要噪声，不联网、无费用。'
                  : 'AI 模型：调用 OpenAI 兼容接口重写标题与摘要，需配置 API Key。'}
              </FieldDescription>
            </FieldContent>
            <Select
              value={settings.optimizeMode}
              onValueChange={(value) => {
                if (value) void commitPatch({ optimizeMode: value as 'local' | 'ai' })
              }}
            >
              <SelectTrigger className="w-full sm:w-44" aria-label="优化方式">
                <SelectValue>
                  {OPTIMIZE_MODES.find((m) => m.id === settings.optimizeMode)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {OPTIMIZE_MODES.map((mode) => (
                  <SelectItem key={mode.id} value={mode.id}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>

        {settings.optimizeMode === 'ai' && (
          <FieldGroup className="border-t border-border pt-4">
            <Field>
              <FieldLabel htmlFor="optimizeApiBase">API 地址</FieldLabel>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="optimizeApiBase"
                  type="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="https://api.openai.com/v1"
                  value={apiBase}
                  onChange={(event) => setApiBase(event.target.value)}
                  onBlur={() => {
                    if (apiBase.trim() !== settings.optimizeApiBase) {
                      void commitPatch({ optimizeApiBase: apiBase }, 'API 地址已保存')
                    }
                  }}
                />
                <Button type="button" variant="glass" onClick={handleGrantAccess} className="shrink-0">
                  <ShieldCheck className="size-3.5" />
                  <span>授权访问</span>
                </Button>
              </div>
              <FieldDescription>
                需兼容 OpenAI <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-xs text-(--code-inline)">/chat/completions</code> 接口；填写后请点击「授权访问」授予扩展该站点网络权限。
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="optimizeApiKey">API Key</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="optimizeApiKey"
                  type={showKey ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  onBlur={() => {
                    if (apiKey.trim() !== settings.optimizeApiKey) {
                      void commitPatch({ optimizeApiKey: apiKey }, 'API Key 已保存')
                    }
                  }}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label={showKey ? '隐藏 API Key' : '显示 API Key'}
                    onClick={() => setShowKey((prev) => !prev)}
                  >
                    {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                仅保存在本机 <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-xs text-(--code-inline)">chrome.storage.local</code>，仅在点击优化时发出请求。
              </FieldDescription>
            </Field>

            <Field orientation="responsive">
              <FieldContent>
                <FieldTitle>模型名称</FieldTitle>
                <FieldDescription>例如 gpt-4o-mini、gpt-4.1-mini</FieldDescription>
              </FieldContent>
              <Input
                id="optimizeApiModel"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={apiModel}
                onChange={(event) => setApiModel(event.target.value)}
                onBlur={() => {
                  if (apiModel.trim() !== settings.optimizeApiModel) {
                    void commitPatch({ optimizeApiModel: apiModel }, '模型配置已保存')
                  }
                }}
                className="w-full sm:w-48"
              />
            </Field>

            <Field orientation="responsive">
              <FieldContent>
                <FieldTitle>摘要语言</FieldTitle>
                <FieldDescription>控制 AI 生成摘要的输出语言</FieldDescription>
              </FieldContent>
              <Select
                value={settings.optimizeApiLanguage}
                onValueChange={(value) => {
                  if (value) {
                    void commitPatch(
                      { optimizeApiLanguage: value as OptimizeSettings['optimizeApiLanguage'] },
                      '摘要语言已更新'
                    )
                  }
                }}
              >
                <SelectTrigger className="w-full sm:w-48" aria-label="摘要语言">
                  <SelectValue>
                    {OPTIMIZE_LANGUAGES.find((l) => l.id === settings.optimizeApiLanguage)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {OPTIMIZE_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.id} value={lang.id}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        )}
      </CardContent>
    </Card>
  )
}
