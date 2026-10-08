/**
 * Read title and description from the page the bookmark points at.
 *
 * Raindrop only fills in page metadata after a bookmark is created, so when the
 * user optimizes while composing a new bookmark there is nothing to work with
 * yet. This pulls the same information straight from the page instead.
 *
 * `activeTab` does not help here: it is only granted for interactions that start
 * in the extension's own UI (toolbar click, context menu), and a button inside
 * the side panel does not qualify. Access therefore has to be granted per host
 * through `chrome.permissions`, which the manifest declares as optional.
 *
 * Every failure degrades to empty fields: optimization is a convenience, and a
 * missing description must never block it. Local rules still work from the URL.
 */

const METADATA_EXTRACTOR = () => {
  const pick = selectors => {
    for (const selector of selectors) {
      const value = document.querySelector(selector)?.getAttribute('content');
      if (value && value.trim()) return value.trim();
    }
    return '';
  };

  return {
    title: document.title || '',
    description: pick([
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]'
    ])
  };
};

const EMPTY = { title: '', description: '' };

function originOf(url) {
  try {
    const { origin, protocol } = new URL(url);
    // Sandboxed "null" origins (data:, file:) cannot be requested.
    if (!origin || origin === 'null') return '';
    if (protocol !== 'http:' && protocol !== 'https:') return '';
    return origin;
  } catch (_) {
    return '';
  }
}

function patternFor(origin) {
  return `${origin}/*`;
}

function samePage(left, right) {
  if (!left || !right) return false;
  try {
    const a = new URL(left);
    const b = new URL(right);
    // Hash differences are irrelevant; the path is compared strictly so a
    // neighbouring page is never used as the source of metadata.
    return a.origin === b.origin && a.pathname === b.pathname && a.search === b.search;
  } catch (_) {
    return false;
  }
}

async function hasAccess(origin) {
  try {
    return await chrome.permissions.contains({ origins: [patternFor(origin)] });
  } catch (_) {
    return false;
  }
}

/**
 * Ask for access to one host.
 *
 * `chrome.permissions.request` only opens its prompt while the user gesture is
 * still active. Any await before the call consumes that gesture and the request
 * then fails silently, so this must run straight from the click handler.
 *
 * Chrome resolves the call with `true` without showing a prompt when the origin
 * is already granted, so no separate "do we already have it" check is needed.
 *
 * @returns {Promise<boolean>} true when the host is accessible.
 */
export async function requestPageAccess(link) {
  const origin = originOf(link);
  if (!origin) return false;

  try {
    return await chrome.permissions.request({ origins: [patternFor(origin)] });
  } catch (error) {
    console.warn('无法申请页面访问权限：', error?.message || error);
    return false;
  }
}

/**
 * @returns {Promise<{title: string, description: string, denied: boolean}>}
 * `denied` is true when access was refused or could not be requested, so the
 * caller can explain why the excerpt is unavailable.
 */
export async function readActivePageMeta(expectedLink = '') {
  const origin = originOf(expectedLink);
  if (!origin || !(await hasAccess(origin))) {
    return { ...EMPTY, denied: true };
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return { ...EMPTY };
    // Only read the page the bookmark actually points at.
    if (!samePage(tab.url, expectedLink)) return { ...EMPTY };

    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: METADATA_EXTRACTOR
    });
    const result = injection?.result;
    return {
      title: result?.title || '',
      description: result?.description || '',
      denied: false
    };
  } catch (error) {
    // Restricted pages (chrome://, the web store) reject injection even with
    // permission granted; treat that as "nothing to read".
    console.warn('无法读取页面元数据：', error?.message || error);
    return { ...EMPTY };
  }
}