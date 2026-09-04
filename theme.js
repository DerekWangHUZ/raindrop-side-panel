import {
  DEFAULT_THEME_SETTINGS,
  THEME_COLORS
} from './utils.mjs';

function normalizeSettings(settings = {}) {
  return {
    themeColor: Object.prototype.hasOwnProperty.call(THEME_COLORS, settings.themeColor)
      ? settings.themeColor
      : DEFAULT_THEME_SETTINGS.themeColor,
    themeMode: ['system', 'light', 'dark'].includes(settings.themeMode)
      ? settings.themeMode
      : DEFAULT_THEME_SETTINGS.themeMode
  };
}

function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(settings = {}) {
  const normalized = normalizeSettings(settings);
  const effectiveMode = normalized.themeMode === 'system' ? systemTheme() : normalized.themeMode;
  const root = document.documentElement;
  root.dataset.themeColor = normalized.themeColor;
  root.dataset.themeMode = normalized.themeMode;
  root.dataset.themeEffective = effectiveMode;
  root.style.colorScheme = effectiveMode;
  return normalized;
}

export async function initTheme() {
  const stored = await chrome.storage.local.get(['themeColor', 'themeMode']);
  const settings = applyTheme(stored);

  if (!initTheme.systemListener && window.matchMedia) {
    initTheme.systemListener = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => {
      if (document.documentElement.dataset.themeMode === 'system') applyTheme(settings);
    };
    initTheme.systemListener.addEventListener?.('change', updateSystemTheme);
    initTheme.systemListener.addListener?.(updateSystemTheme);
  }

  if (!initTheme.storageListener) {
    initTheme.storageListener = (changes, areaName) => {
      if (areaName !== 'local' || (!changes.themeColor && !changes.themeMode)) return;
      applyTheme({
        themeColor: changes.themeColor?.newValue || document.documentElement.dataset.themeColor,
        themeMode: changes.themeMode?.newValue || document.documentElement.dataset.themeMode
      });
    };
    chrome.storage.onChanged.addListener(initTheme.storageListener);
  }

  return settings;
}

export async function saveThemeSettings(settings) {
  const normalized = normalizeSettings(settings);
  await chrome.storage.local.set(normalized);
  applyTheme(normalized);
  return normalized;
}

export { normalizeSettings };
