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

/* S10 运行时无障碍降级：把系统的「减少动态 / 减少透明」实时同步到 html
   的 is-reduced-* class。CSS 媒体查询守卫（ui-base.css）仍是首帧基线，
   这层负责「设置中途切换偏好」的实时性 —— 双层机制对齐模板 chrome.css
   的「实时无障碍与材质控制」段。实色 token 组见 vendor 层末段。 */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const REDUCED_TRANSPARENCY_QUERY = '(prefers-reduced-transparency: reduce)';

function applyAccessibilityClasses() {
  if (!window.matchMedia) return;
  const root = document.documentElement;
  root.classList.toggle('is-reduced-motion', window.matchMedia(REDUCED_MOTION_QUERY).matches);
  root.classList.toggle('is-reduced-transparency', window.matchMedia(REDUCED_TRANSPARENCY_QUERY).matches);
}

function watchAccessibilityPreferences() {
  if (!window.matchMedia || initTheme.a11yWatched) return;
  initTheme.a11yWatched = true;
  applyAccessibilityClasses();
  for (const queryText of [REDUCED_MOTION_QUERY, REDUCED_TRANSPARENCY_QUERY]) {
    const listener = window.matchMedia(queryText);
    const onChange = () => applyAccessibilityClasses();
    if (listener.addEventListener) listener.addEventListener('change', onChange);
    else listener.addListener?.(onChange);
  }
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
  watchAccessibilityPreferences();
  const stored = await chrome.storage.local.get(['themeColor', 'themeMode']);
  const settings = applyTheme(stored);

  if (!initTheme.systemListener && window.matchMedia) {
    initTheme.systemListener = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => {
      if (document.documentElement.dataset.themeMode === 'system') {
        applyTheme({
          themeColor: document.documentElement.dataset.themeColor,
          themeMode: 'system'
        });
      }
    };
    if (initTheme.systemListener.addEventListener) initTheme.systemListener.addEventListener('change', updateSystemTheme);
    else initTheme.systemListener.addListener?.(updateSystemTheme);
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
