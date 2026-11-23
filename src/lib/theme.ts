import { DEFAULT_THEME_SETTINGS } from '../../utils.mjs'

export type ThemeMode = 'system' | 'light' | 'dark'
export type EffectiveTheme = 'light' | 'dark'

export interface ThemeSettings {
  themeMode: ThemeMode
}

export function normalizeThemeSettings(settings: Partial<ThemeSettings> = {}): ThemeSettings {
  const mode = settings.themeMode
  return {
    themeMode: mode === 'system' || mode === 'light' || mode === 'dark'
      ? mode
      : (DEFAULT_THEME_SETTINGS.themeMode as ThemeMode),
  }
}

export function getSystemTheme(): EffectiveTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveEffectiveTheme(themeMode: ThemeMode): EffectiveTheme {
  return themeMode === 'system' ? getSystemTheme() : themeMode
}

export function applyTheme(settings: Partial<ThemeSettings> = {}): {
  themeMode: ThemeMode
  effectiveTheme: EffectiveTheme
} {
  const normalized = normalizeThemeSettings(settings)
  const effectiveTheme = resolveEffectiveTheme(normalized.themeMode)
  const root = document.documentElement

  root.classList.toggle('dark', effectiveTheme === 'dark')
  root.dataset.themeMode = normalized.themeMode
  root.style.colorScheme = effectiveTheme

  return {
    themeMode: normalized.themeMode,
    effectiveTheme,
  }
}

/**
 * Apply system theme synchronously before first React paint to prevent FOUC.
 */
export function applyInitialThemeSync(): EffectiveTheme {
  return applyTheme({ themeMode: 'system' }).effectiveTheme
}

export async function loadThemeSettings(): Promise<ThemeSettings> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return normalizeThemeSettings()
  }
  const stored = await chrome.storage.local.get(['themeMode'])
  return normalizeThemeSettings(stored as Partial<ThemeSettings>)
}

export async function saveThemeSettings(settings: Partial<ThemeSettings>): Promise<ThemeSettings> {
  const normalized = normalizeThemeSettings(settings)
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set(normalized)
  }
  applyTheme(normalized)
  return normalized
}

export async function initTheme(
  onChange?: (state: { themeMode: ThemeMode; effectiveTheme: EffectiveTheme }) => void
): Promise<{ themeMode: ThemeMode; effectiveTheme: EffectiveTheme }> {
  const settings = await loadThemeSettings()
  const applied = applyTheme(settings)
  onChange?.(applied)

  const cleanups: Array<() => void> = []

  if (typeof window !== 'undefined' && window.matchMedia) {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemChange = () => {
      const currentMode = (document.documentElement.dataset.themeMode as ThemeMode) || 'system'
      if (currentMode === 'system') {
        const next = applyTheme({ themeMode: 'system' })
        onChange?.(next)
      }
    }
    media.addEventListener?.('change', onSystemChange)
    cleanups.push(() => media.removeEventListener?.('change', onSystemChange))
  }

  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    const onStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== 'local' || !changes.themeMode) return
      const nextMode = (changes.themeMode.newValue as ThemeMode) || 'system'
      const next = applyTheme({ themeMode: nextMode })
      onChange?.(next)
    }
    chrome.storage.onChanged.addListener(onStorageChange)
    cleanups.push(() => chrome.storage.onChanged.removeListener(onStorageChange))
  }

  return applied
}
