import { validateToken } from './api.js';
import { initTheme, saveThemeSettings } from './theme.js';
import { DEFAULT_THEME_SETTINGS, THEME_COLORS, THEME_MODES } from './utils.mjs';

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
loadAppearance().catch(error => console.error('外观设置加载失败：', error));
loadSavedSettings();
