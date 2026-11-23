import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CoverMedia } from '@/components/CoverMedia'

describe('CoverMedia', () => {
  it('renders only initial when cover is empty', () => {
    const { container } = render(<CoverMedia title="Raindrop" cover="" />)
    const box = container.querySelector('[data-slot="cover-media"]')!
    expect(box.children).toHaveLength(1)
    expect(box.querySelector('img')).toBeNull()
    expect(box.textContent).toBe('R')
  })

  it('renders only img when cover is provided, and falls back to initial on error', () => {
    const { container } = render(
      <CoverMedia title="GitHub" cover="https://github.com/favicon.ico" />
    )
    const box = container.querySelector('[data-slot="cover-media"]')!
    expect(box.children).toHaveLength(1)
    const img = box.querySelector('img')!
    expect(img).not.toBeNull()

    fireEvent.error(img)
    expect(box.children).toHaveLength(1)
    expect(box.querySelector('img')).toBeNull()
    expect(box.textContent).toBe('G')
  })
})
