import { validateToken } from './api.js';
import { initTheme, saveThemeSettings } from './theme.js';
import { loadOptimizeSettings, saveOptimizeSettings } from './optimizer.js';
import {
  DEFAULT_THEME_SETTINGS,
  OPTIMIZE_LANGUAGES,
  OPTIMIZE_MODES,
  THEME_COLORS,
  THEME_MODES
} from './utils.mjs';

const MODE_HINTS = {
  local: '点击 ✨ 后在本地用规则整理书签名和摘要：即时完成，不联网、不产生费用。',
  ai: '点击 ✨ 后调用你配置的模型重写书签名和摘要，需要 API Key，并且会产生相应费用。'
};

const tokenInput = document.querySelector('#tokenInput');
const toggleTokenButton = document.querySelector('#toggleTokenButton');
const saveButton = document.querySelector('#saveButton');
const clearButton = document.querySelector('#clearButton');
const statusMessage = document.querySelector('#statusMessage');
const accountCard = document.querySelector('#accountCard');
const accountName = document.querySelector('#accountName');
const accountEmail = document.querySelector('#accountEmail');
const themeModeSelect = document.querySelector('#themeModeSelect');
const themeColorPicker = document.querySelector('#themeColorPicker');
const optimizeModeSelect = document.querySelector('#optimizeModeSelect');
const optimizeModeHint = document.querySelector('#optimizeModeHint');
const optimizeAiFields = document.querySelector('#optimizeAiFields');
const optimizeApiBase = document.querySelector('#optimizeApiBase');
const grantOptimizeAccessButton = document.querySelector('#grantOptimizeAccessButton');
const optimizeApiKey = document.querySelector('#optimizeApiKey');
const toggleOptimizeKeyButton = document.querySelector('#toggleOptimizeKeyButton');
const optimizeApiModel = document.querySelector('#optimizeApiModel');
const optimizeApiLanguage = document.querySelector('#optimizeApiLanguage');

function setStatus(message, type = '') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`.trim();
}

function showAccount(user) {
  if (!user) {
    accountCard.classList.add('hidden');
    return;
  }
  accountName.textContent = user.fullName || '已连接 Raindrop';
  accountEmail.textContent = user.email || '';
  accountCard.classList.remove('hidden');
}

async function loadSavedSettings() {
  const { raindropToken = '' } = await chrome.storage.local.get('raindropToken');
  tokenInput.value = raindropToken;
  if (!raindropToken) return;

  try {
    const user = await validateToken(raindropToken);
    showAccount(user);
    setStatus('当前 Token 可用。', 'success');
  } catch (error) {
    showAccount(null);
    setStatus(`已保存的 Token 无法验证：${error.message}`, 'error');
  }
}

function renderThemeColors(selected) {
  themeColorPicker.replaceChildren();
  Object.entries(THEME_COLORS).forEach(([id, color]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `theme-swatch${id === selected ? ' selected' : ''}`;
    button.dataset.color = id;
    button.style.setProperty('--swatch', color.light);
    button.title = color.label;
    button.setAttribute('aria-label', color.label);
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(id === selected));
    const check = document.createElement('span');
    check.className = 'swatch-check';
    check.textContent = '✓';
    check.setAttribute('aria-hidden', 'true');
    button.appendChild(check);
    button.addEventListener('click', () => updateAppearance({ themeColor: id }));
    themeColorPicker.appendChild(button);
  });
}

async function updateAppearance(changes = {}) {
  const current = await chrome.storage.local.get(['themeColor', 'themeMode']);
  const settings = await saveThemeSettings({
    ...DEFAULT_THEME_SETTINGS,
    ...current,
    ...changes
  });
  themeModeSelect.value = settings.themeMode;
  renderThemeColors(settings.themeColor);
}

async function loadAppearance() {
  const settings = await initTheme();
  themeModeSelect.replaceChildren(...THEME_MODES.map(mode => new Option(mode.label, mode.id)));
  themeModeSelect.value = settings.themeMode;
  renderThemeColors(settings.themeColor);
}

async function grantOptimizeAccess() {
  const apiBase = optimizeApiBase.value.trim();
  let origin = '';
  try {
    origin = new URL(apiBase).origin;
  } catch (_) {
    setStatus('请先填写有效的 API 地址。', 'error');
    return;
  }
  if (origin === 'null') {
    setStatus('该 API 地址不是有效的 HTTP/HTTPS 地址。', 'error');
    return;
  }

  try {
    // Must run inside this click's user gesture, hence the explicit button.
    const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    setStatus(granted
      ? `已授权访问 ${origin}。`
      : `未获得 ${origin} 的访问授权，AI 优化将无法请求该地址。`, granted ? 'success' : 'error');
  } catch (error) {
    setStatus(`请求授权失败：${error.message}`, 'error');
  }
}

function renderOptimize(settings) {
  optimizeModeSelect.value = settings.optimizeMode;
  optimizeModeHint.textContent = MODE_HINTS[settings.optimizeMode] || '';
  optimizeAiFields.classList.toggle('hidden', settings.optimizeMode !== 'ai');
  optimizeApiBase.value = settings.optimizeApiBase;
  optimizeApiKey.value = settings.optimizeApiKey;
  optimizeApiModel.value = settings.optimizeApiModel;
  optimizeApiLanguage.value = settings.optimizeApiLanguage;
}

async function loadOptimize() {
  renderOptimize(await loadOptimizeSettings());
}

toggleTokenButton.addEventListener('click', () => {
  const showing = tokenInput.type === 'text';
  tokenInput.type = showing ? 'password' : 'text';
  toggleTokenButton.textContent = showing ? '显示' : '隐藏';
});

saveButton.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  if (!token) {
    setStatus('请先输入 Token。', 'error');
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = '验证中…';
  setStatus('正在向 Raindrop 验证 Token…');

  try {
    const user = await validateToken(token);
    await chrome.storage.local.set({ raindropToken: token });
    showAccount(user);
    setStatus('验证成功，Token 已保存。现在点击扩展工具栏图标即可打开侧边栏。', 'success');
  } catch (error) {
    showAccount(null);
    setStatus(`验证失败：${error.message}`, 'error');
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = '验证并保存';
  }
});

clearButton.addEventListener('click', async () => {
  await chrome.storage.local.remove(['raindropToken', 'lastCollectionId']);
  tokenInput.value = '';
  showAccount(null);
  setStatus('Token 已从本机扩展存储中清除。', 'success');
});

themeModeSelect.addEventListener('change', () => updateAppearance({ themeMode: themeModeSelect.value }));

optimizeModeSelect.addEventListener('change', async () => {
  const next = await saveOptimizeSettings({ optimizeMode: optimizeModeSelect.value });
  renderOptimize(next);
});

optimizeApiLanguage.addEventListener('change', () => saveOptimizeSettings({
  optimizeApiLanguage: optimizeApiLanguage.value
}));

for (const [input, key] of [
  [optimizeApiBase, 'optimizeApiBase'],
  [optimizeApiKey, 'optimizeApiKey'],
  [optimizeApiModel, 'optimizeApiModel']
]) {
  input.addEventListener('change', async () => {
    const next = await saveOptimizeSettings({ [key]: input.value });
    renderOptimize(next);
  });
}

grantOptimizeAccessButton.addEventListener('click', grantOptimizeAccess);

toggleOptimizeKeyButton.addEventListener('click', () => {
  const showing = optimizeApiKey.type === 'text';
  optimizeApiKey.type = showing ? 'password' : 'text';
  toggleOptimizeKeyButton.textContent = showing ? '显示' : '隐藏';
});

optimizeModeSelect.replaceChildren(...OPTIMIZE_MODES.map(mode => new Option(mode.label, mode.id)));
optimizeApiLanguage.replaceChildren(...OPTIMIZE_LANGUAGES.map(item => new Option(item.label, item.id)));

loadAppearance().catch(error => console.error('外观设置加载失败：', error));
loadOptimize().catch(error => console.error('自动优化设置加载失败：', error));
loadSavedSettings();
