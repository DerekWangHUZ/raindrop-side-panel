import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('dark'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (typeof Element !== 'undefined' && !Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => []
}

export function createChromeMock(initialStorage: Record<string, unknown> = {}) {
  const storageData: Record<string, unknown> = { ...initialStorage }
  return {
    storageData,
    chrome: {
      storage: {
        local: {
          get: vi.fn(async (keys?: string | string[]) => {
            if (!keys) return { ...storageData }
            const list = Array.isArray(keys) ? keys : [keys]
            const out: Record<string, unknown> = {}
            for (const key of list) {
              if (key in storageData) out[key] = storageData[key]
            }
            return out
          }),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(storageData, items)
          }),
          remove: vi.fn(async (keys: string | string[]) => {
            const list = Array.isArray(keys) ? keys : [keys]
            for (const key of list) delete storageData[key]
          }),
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      tabs: {
        query: vi.fn(async () => [
          {
            id: 1,
            url: 'https://example.com/article',
            title: 'Example Article',
            favIconUrl: 'https://example.com/favicon.ico',
            active: true,
          },
        ]),
        create: vi.fn(),
        onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      runtime: {
        openOptionsPage: vi.fn(),
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      permissions: {
        request: vi.fn(async () => true),
        contains: vi.fn(async () => true),
      },
    },
  }
}

beforeEach(() => {
  const { chrome } = createChromeMock()
  ;(globalThis as any).chrome = chrome
  document.documentElement.className = ''
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
