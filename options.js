import { validateToken } from './api.js';

const tokenInput = document.querySelector('#tokenInput');
const toggleTokenButton = document.querySelector('#toggleTokenButton');
const saveButton = document.querySelector('#saveButton');
const clearButton = document.querySelector('#clearButton');
const statusMessage = document.querySelector('#statusMessage');
const accountCard = document.querySelector('#accountCard');
const accountName = document.querySelector('#accountName');
const accountEmail = document.querySelector('#accountEmail');

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

loadSavedSettings();
