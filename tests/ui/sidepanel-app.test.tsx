import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { App as SidePanelApp } from '@/sidepanel/App'
import { createChromeMock } from './setup'

describe('SidePanel App', () => {
  it('shows SetupGate when no token is stored', async () => {
    const mock = createChromeMock({})
    ;(globalThis as any).chrome = mock.chrome

    render(
      <TooltipProvider>
        <SidePanelApp />
      </TooltipProvider>
    )

    expect(await screen.findByText('先连接 Raindrop 账户')).toBeInTheDocument()
    const openButtons = screen.getAllByRole('button', { name: '打开设置' })
    fireEvent.click(openButtons[openButtons.length - 1])
    expect(mock.chrome.runtime.openOptionsPage).toHaveBeenCalled()
  })

  it('loads collections and bookmarks when token is present and supports tag filtering', async () => {
    const mock = createChromeMock({ raindropToken: 'tok-123' })
    ;(globalThis as any).chrome = mock.chrome

    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url)
      if (u.includes('/user')) {
        return new Response(JSON.stringify({ result: true, user: { fullName: 'Derek', groups: [] } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (u.includes('/collections/childrens')) {
        return new Response(JSON.stringify({ result: true, items: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (u.includes('/collections')) {
        return new Response(
          JSON.stringify({ result: true, items: [{ _id: 10, title: 'Design', count: 2 }] }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({
          result: true,
          count: 1,
          items: [
            {
              _id: 101,
              title: 'Solid Glass Docs',
              link: 'https://deeplethe.github.io/solid-glass',
              domain: 'deeplethe.github.io',
              tags: ['ui', 'glass'],
              collection: { $id: 10 },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }) as any

    render(
      <TooltipProvider>
        <SidePanelApp />
      </TooltipProvider>
    )

    expect(await screen.findByText('Solid Glass Docs')).toBeInTheDocument()
    expect(screen.getByText('Example Article')).toBeInTheDocument()

    // Click tag pill to filter search
    fireEvent.click(screen.getByText('glass'))
    await waitFor(() => {
      expect(screen.getByLabelText('搜索全部书签')).toHaveValue('#glass')
    })
  })
})
