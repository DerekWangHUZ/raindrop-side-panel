import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface CoverMediaProps {
  title?: string
  cover?: string
  lazy?: boolean
  className?: string
}

/**
 * Single-element cover box: renders either the image OR the title's first letter,
 * never both stacked underneath each other (transparent favicons would otherwise
 * bleed the letter through).
 */
export function CoverMedia({ title = '', cover = '', lazy = true, className }: CoverMediaProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [cover])

  const seed = String(title || '').trim()
  const initial = seed.charAt(0).toUpperCase() || '·'
  const showImage = Boolean(cover) && !failed

  return (
    <span
      data-slot="cover-media"
      className={cn(
        'flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-(--glass-state) ring-1 ring-(--glass-edge)',
        className
      )}
    >
      {showImage ? (
        <img
          src={cover}
          alt=""
          loading={lazy ? 'lazy' : undefined}
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setFailed(true)}
          onLoad={(event) => {
            if (!event.currentTarget.naturalWidth) setFailed(true)
          }}
        />
      ) : (
        <span
          aria-hidden="true"
          className="text-sm leading-none font-semibold text-muted-foreground select-none"
        >
          {initial}
        </span>
      )}
    </span>
  )
}
