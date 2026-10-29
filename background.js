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

// Errors surface as system notifications; the toolbar stays free of badges.
chrome.action.setBadgeText({ text: '' }).catch(() => {});

function notifySaveFailure(message) {
  const options = {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: '保存到 Raindrop 失败',
    message: String(message || '未知错误')
  };
  try {
    // Best-effort feedback only; a notification failure must never mask or
    // replace the original error.
    chrome.notifications?.create(options)?.catch?.(() => {});
  } catch (_) {
    // Notifications unavailable (e.g. permission removed); nothing to do.
  }
}

chrome.runtime.onInstalled.addListener(() => {
  configureSidePanel();
  configureContextMenu();
});

chrome.runtime.onStartup.addListener(() => configureSidePanel());
configureSidePanel();

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;

  const link = info.linkUrl || info.pageUrl || tab?.url;
  const title = info.linkUrl ? '' : (tab?.title || '');
  if (!link || !/^https?:/i.test(link)) {
    notifySaveFailure('该地址不是可保存的 HTTP/HTTPS 链接');
    return;
  }

  // chrome.sidePanel.open() only works while the click's user gesture is
  // still active, and that gesture does not survive awaits — so it must be
  // the first call in this handler, before any storage or network work.
  const panelOpened = chrome.sidePanel?.open && Number.isFinite(tab?.windowId)
    ? chrome.sidePanel.open({ windowId: tab.windowId })
    : Promise.resolve();

  void (async () => {
    // The draft is worth saving even when the panel cannot be opened: the
    // panel picks it up on its next launch within the validity window.
    let draftSaved = false;
    try {
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
      draftSaved = true;
    } catch (error) {
      console.error('写入待保存草稿失败：', error);
    }

    try {
      await panelOpened;
    } catch (error) {
      notifySaveFailure(error?.message || '无法打开侧边栏');
      return;
    }

    // A panel that just opened is still bootstrapping and reads the draft
    // from storage on start-up, so a failed send here is expected and
    // harmless; it only matters for an already-running panel.
    if (draftSaved) chrome.runtime.sendMessage({ type: 'OPEN_SAVE_EDITOR' }).catch(() => {});
  })();
});
