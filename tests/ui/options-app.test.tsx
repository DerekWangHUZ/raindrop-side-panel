import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { App as OptionsApp } from '@/options/App'
import { createChromeMock } from './setup'

describe('Options App', () => {
  it('mounts without errors and switches theme modes via html.dark', async () => {
    const mock = createChromeMock({ themeMode: 'light' })
    ;(globalThis as any).chrome = mock.chrome

    render(
      <TooltipProvider>
        <OptionsApp />
      </TooltipProvider>
    )

    expect(await screen.findByText('Raindrop Side Panel')).toBeInTheDocument()

    const appearanceTab = screen.getByRole('tab', { name: /外观与材质/ })
    fireEvent.click(appearanceTab)

    const darkTrigger = await screen.findByRole('tab', { name: /深色/ })
    fireEvent.click(darkTrigger)

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(mock.storageData.themeMode).toBe('dark')
    })

    const lightTrigger = screen.getByRole('tab', { name: /浅色/ })
    fireEvent.click(lightTrigger)

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false)
      expect(mock.storageData.themeMode).toBe('light')
    })
  })

  it('validates and saves token on Account tab', async () => {
    const mock = createChromeMock({})
    ;(globalThis as any).chrome = mock.chrome
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ result: true, user: { fullName: 'Derek', email: 'd@example.com' } }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    ) as any

    render(
      <TooltipProvider>
        <OptionsApp />
      </TooltipProvider>
    )

    const input = await screen.findByPlaceholderText('粘贴 Raindrop Test Token')
    fireEvent.change(input, { target: { value: 'test-token-123' } })
    fireEvent.click(screen.getByRole('button', { name: '验证并保存' }))

    await waitFor(() => {
      expect(mock.storageData.raindropToken).toBe('test-token-123')
      expect(screen.getByText('已连接 · Derek')).toBeInTheDocument()
    })
  })
})
