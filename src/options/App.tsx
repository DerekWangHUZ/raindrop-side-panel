import { useEffect, useState } from 'react'
import { KeyRound, Palette, Sparkles } from 'lucide-react'
import icon48 from '../../icons/icon48.png'
import { Badge } from '@/components/ui/badge'
import { Toaster } from '@/components/ui/sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DEFAULT_OPTIMIZE_SETTINGS,
  loadOptimizeSettings,
  type OptimizeSettings,
  type RaindropUser,
  validateToken,
} from '@/lib/raindrop'
import { type EffectiveTheme, initTheme, saveThemeSettings, type ThemeMode } from '@/lib/theme'
import { AccountTab } from './components/AccountTab'
import { AppearanceTab } from './components/AppearanceTab'
import { OptimizeTab } from './components/OptimizeTab'

export function App() {
  const [token, setToken] = useState('')
  const [user, setUser] = useState<RaindropUser | null>(null)
  const [tokenError, setTokenError] = useState('')
  const [themeMode, setThemeMode] = useState<ThemeMode>('system')
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>('dark')
  const [optimizeSettings, setOptimizeSettings] = useState<OptimizeSettings>(
    DEFAULT_OPTIMIZE_SETTINGS as OptimizeSettings
  )

  useEffect(() => {
    void initTheme((next) => {
      setThemeMode(next.themeMode)
      setEffectiveTheme(next.effectiveTheme)
    })

    void loadOptimizeSettings()
      .then((settings) => setOptimizeSettings(settings as OptimizeSettings))
      .catch((error) => console.error('加载优化设置失败：', error))

    const loadToken = async () => {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) return
      const { raindropToken = '' } = await chrome.storage.local.get('raindropToken')
      const trimmed = String(raindropToken || '').trim()
      setToken(trimmed)
      if (!trimmed) return
      try {
        const verified = await validateToken(trimmed)
        setUser(verified)
        setTokenError('')
      } catch (error) {
        setUser(null)
        setTokenError(`已保存的 Token 无法验证：${error instanceof Error ? error.message : String(error)}`)
      }
    }
    void loadToken()
  }, [])

  const handleThemeModeChange = async (mode: ThemeMode) => {
    await saveThemeSettings({ themeMode: mode })
    setThemeMode(mode)
  }

  return (
    <div className="min-h-full overflow-y-auto bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-10 sm:px-8">
        <header className="flex flex-wrap items-center gap-4">
          <img
            src={icon48}
            alt=""
            className="size-12 shrink-0 rounded-xl ring-1 ring-(--glass-edge)"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Raindrop Side Panel
              </h1>
              <Badge variant={user ? 'secondary' : 'outline'}>
                {user ? `已连接 · ${user.fullName || 'Raindrop'}` : '未连接'}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              管理 Raindrop.io 账户连接、Solid Glass 外观模式与标题摘要优化引擎
            </p>
          </div>
        </header>

        <Tabs defaultValue="account" className="gap-5">
          <TabsList>
            <TabsTrigger value="account">
              <KeyRound className="size-3.5" />
              <span>账户与连接</span>
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="size-3.5" />
              <span>外观与材质</span>
            </TabsTrigger>
            <TabsTrigger value="optimize">
              <Sparkles className="size-3.5" />
              <span>标题与摘要优化</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <AccountTab
              token={token}
              user={user}
              tokenError={tokenError}
              onTokenSaved={(nextToken, nextUser) => {
                setToken(nextToken)
                setUser(nextUser)
                setTokenError('')
              }}
              onTokenCleared={() => {
                setToken('')
                setUser(null)
                setTokenError('')
              }}
            />
          </TabsContent>

          <TabsContent value="appearance">
            <AppearanceTab
              themeMode={themeMode}
              effectiveTheme={effectiveTheme}
              onThemeModeChange={handleThemeModeChange}
            />
          </TabsContent>

          <TabsContent value="optimize">
            <OptimizeTab
              settings={optimizeSettings}
              onSettingsChange={setOptimizeSettings}
            />
          </TabsContent>
        </Tabs>
      </main>
      <Toaster position="bottom-center" theme={effectiveTheme} />
    </div>
  )
}
