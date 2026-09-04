import { getStoredToken } from './api.js';

const MENU_ID = 'raindrop-save';
const PENDING_SAVE_KEY = 'pendingSaveDraft';

async function configureSidePanel() {
  if (!chrome.sidePanel?.setPanelBehavior) return;
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    console.error('无法设置侧边栏点击行为：', error);
  }
}

async function configureContextMenu() {
  try {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
      id: MENU_ID,
      title: '保存到 Raindrop…',
      contexts: ['page', 'link']
    });
  } catch (error) {
    console.error('无法创建右键菜单：', error);
  }
}

async function flashBadge(text, timeout = 1800) {
  try {
    await chrome.action.setBadgeText({ text });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }).catch(() => {}), timeout);
  } catch (_) {
    // Badge 仅作为反馈，不影响核心功能。
  }
}

chrome.runtime.onInstalled.addListener(() => {
  configureSidePanel();
  configureContextMenu();
});

chrome.runtime.onStartup.addListener(() => configureSidePanel());
configureSidePanel();

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;

  try {
    const link = info.linkUrl || info.pageUrl || tab?.url;
    const title = info.linkUrl ? '' : (tab?.title || '');
    if (!link || !/^https?:/i.test(link)) {
      await flashBadge('!');
      return;
    }

    const { lastCollectionId = -1 } = await chrome.storage.local.get('lastCollectionId');
    await chrome.storage.local.set({
      [PENDING_SAVE_KEY]: {
        link,
        title,
        collectionId: Number(lastCollectionId) || -1,
        tabId: tab?.id,
        windowId: tab?.windowId,
        createdAt: Date.now()
      }
    });

    const token = await getStoredToken();
    if (!token) {
      await chrome.runtime.openOptionsPage();
      return;
    }

    if (chrome.sidePanel?.open && Number.isFinite(tab?.windowId)) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
    chrome.runtime.sendMessage({ type: 'OPEN_SAVE_EDITOR' }).catch(() => {});
  } catch (error) {
    console.error('打开保存编辑器失败：', error);
    await flashBadge('!');
    chrome.runtime.sendMessage({
      type: 'RAINDROP_SAVE_FAILED',
      message: error.message || '无法打开保存编辑器'
    }).catch(() => {});
  }
});
