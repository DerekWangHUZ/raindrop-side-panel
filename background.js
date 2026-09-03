import { createRaindrop, getStoredToken } from './api.js';

const MENU_ID = 'raindrop-save';

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
      title: '保存到 Raindrop',
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

chrome.runtime.onStartup.addListener(() => {
  configureSidePanel();
});

// Service worker 被重新唤醒后也确保行为已配置。
configureSidePanel();

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;

  try {
    const token = await getStoredToken();
    if (!token) {
      await chrome.runtime.openOptionsPage();
      return;
    }

    const { lastCollectionId = -1 } = await chrome.storage.local.get('lastCollectionId');
    const link = info.linkUrl || info.pageUrl || tab?.url;
    const title = info.linkUrl ? '' : (tab?.title || '');

    if (!link || !/^https?:/i.test(link)) {
      await flashBadge('!');
      return;
    }

    await createRaindrop({
      link,
      title,
      collectionId: Number(lastCollectionId)
    });

    await flashBadge('✓');
    chrome.runtime.sendMessage({ type: 'RAINDROP_SAVED', link }).catch(() => {});
  } catch (error) {
    console.error('右键保存失败：', error);
    await flashBadge('!');
    chrome.runtime.sendMessage({
      type: 'RAINDROP_SAVE_FAILED',
      message: error.message || '保存失败'
    }).catch(() => {});
  }
});
