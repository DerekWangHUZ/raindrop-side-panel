import { useEffect, useState } from 'react'
import { CheckCircle2, Eye, EyeOff, KeyRound, ShieldAlert, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DotLoader } from '@/components/ui/dot-loader'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { Panel } from '@/components/ui/panel'
import { type RaindropUser, validateToken } from '@/lib/raindrop'
import { toast } from 'sonner'

interface AccountTabProps {
  token: string
  user: RaindropUser | null
  tokenError: string
  onTokenSaved: (token: string, user: RaindropUser | null) => void
  onTokenCleared: () => void
}

export function AccountTab({
  token,
  user,
  tokenError,
  onTokenSaved,
  onTokenCleared,
}: AccountTabProps) {
  const [draftToken, setDraftToken] = useState(token)
  const [showToken, setShowToken] = useState(false)
  const [validating, setValidating] = useState(false)
  const [errorText, setErrorText] = useState(tokenError)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    setDraftToken(token)
  }, [token])

  useEffect(() => {
    setErrorText(tokenError)
  }, [tokenError])

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = draftToken.trim()
    if (!trimmed) {
      setErrorText('请先输入 Raindrop Test Token。')
      return
    }

    setValidating(true)
    setErrorText('')
    try {
      const nextUser = await validateToken(trimmed)
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ raindropToken: trimmed })
      }
      onTokenSaved(trimmed, nextUser)
      toast.success('Token 验证成功并已保存', {
        description: '点击浏览器工具栏图标即可打开 Raindrop 侧边栏。',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token 验证失败'
      setErrorText(`验证失败：${message}`)
      toast.error('Token 验证失败')
    } finally {
      setValidating(false)
    }
  }

  const handleClear = async () => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.remove(['raindropToken', 'lastCollectionId'])
    }
    setDraftToken('')
    setErrorText('')
    setConfirmOpen(false)
    onTokenCleared()
    toast.success('Token 已从本机扩展存储中清除')
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">连接 Raindrop.io 账户</CardTitle>
          <CardDescription>
            Test Token 仅保存在本机 <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-(--code-inline)">chrome.storage.local</code> 中，扩展直连 Raindrop 官方 API，不经过任何第三方服务器。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="tokenInput">Raindrop Test Token</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <KeyRound className="size-4" />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="tokenInput"
                    type={showToken ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="粘贴 Raindrop Test Token"
                    value={draftToken}
                    onChange={(event) => setDraftToken(event.target.value)}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label={showToken ? '隐藏 Token' : '显示 Token'}
                      onClick={() => setShowToken((prev) => !prev)}
                    >
                      {showToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription>
                  该 Token 可长期使用，直到你在 Raindrop 开发者设置中主动撤销。
                </FieldDescription>
                {errorText && <FieldError>{errorText}</FieldError>}
              </Field>
            </FieldGroup>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button type="submit" disabled={validating}>
                {validating ? (
                  <>
                    <DotLoader />
                    <span>验证中…</span>
                  </>
                ) : (
                  '验证并保存'
                )}
              </Button>
              <Button
                type="button"
                variant="glass"
                disabled={!token && !draftToken}
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="size-3.5" />
                <span>清除 Token</span>
              </Button>
            </div>

            {user && (
              <Item variant="outline" className="mt-1">
                <ItemMedia variant="icon">
                  <CheckCircle2 className="size-4 text-(--success)" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{user.fullName || '已连接 Raindrop'}</ItemTitle>
                  {user.email && <ItemDescription>{user.email}</ItemDescription>}
                </ItemContent>
              </Item>
            )}
          </form>
        </CardContent>
      </Card>

      <Panel title="如何获取 Test Token" className="rounded-xl">
        <div className="px-4 py-3.5 text-sm leading-relaxed text-muted-foreground">
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 marker:text-muted-foreground/80">
            <li>登录并打开 Raindrop.io 的网页端设置。</li>
            <li>进入「集成（Integrations）→ 开发者（For Developers）」页面。</li>
            <li>创建一个新的开发者应用（或打开已有应用），点击 <strong className="font-medium text-foreground">Create test token</strong>。</li>
            <li>复制生成的 Test Token 并粘贴到上方输入框中，点击「验证并保存」。</li>
          </ol>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground/90">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
            <span>若在 Raindrop 中重置了 Test Token 或删除了对应应用，原 Token 会立即失效。</span>
          </p>
        </div>
      </Panel>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清除已保存的 Token？</AlertDialogTitle>
            <AlertDialogDescription>
              将从本机扩展存储移除 Raindrop Test Token 与上次选中的收藏夹记录，清除后需要重新验证才能继续使用。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleClear}>
              确认清除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
