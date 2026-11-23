import { useEffect, useState } from 'react'
import { ChevronRight, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DotLoader } from '@/components/ui/dot-loader'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  type FlatCollectionOption,
  isValidHttpUrl,
  normalizeTags,
  optimizeFields,
  type RaindropItem,
  readActivePageMeta,
  requestPageAccess,
} from '@/lib/raindrop'
import { cn } from '@/lib/utils'

interface BookmarkEditorDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  initialItem: Partial<RaindropItem> | null
  defaultCollectionId: number
  collectionOptions: FlatCollectionOption[]
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: {
    mode: 'create' | 'edit'
    id?: number
    link: string
    title: string
    collectionId: number
    tags: string[]
    note: string
    excerpt: string
  }) => Promise<void>
}

export function BookmarkEditorDialog({
  open,
  mode,
  initialItem,
  defaultCollectionId,
  collectionOptions,
  onOpenChange,
  onSubmit,
}: BookmarkEditorDialogProps) {
  const [link, setLink] = useState('')
  const [title, setTitle] = useState('')
  const [collectionId, setCollectionId] = useState('-1')
  const [tagsText, setTagsText] = useState('')
  const [note, setNote] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorText, setErrorText] = useState('')

  useEffect(() => {
    if (!open) return
    const item = initialItem || {}
    setLink(item.link || '')
    setTitle(item.title || '')
    const desired = Number(item.collection?.$id ?? item.collectionId ?? defaultCollectionId)
    const exists = collectionOptions.some((opt) => opt.id === desired)
    setCollectionId(String(exists ? desired : -1))
    const tags = Array.isArray(item.tags) ? item.tags.join(', ') : ''
    setTagsText(tags)
    setNote(item.note || '')
    setExcerpt(item.excerpt || '')
    setAdvancedOpen(Boolean(tags || item.note || item.excerpt))
    setErrorText('')
    setOptimizing(false)
    setSubmitting(false)
  }, [open, initialItem, defaultCollectionId, collectionOptions])

  const handleOptimize = async () => {
    const trimmedLink = link.trim()
    if (!isValidHttpUrl(trimmedLink)) {
      setErrorText('请先填写有效的链接，再进行优化。')
      return
    }

    setOptimizing(true)
    setErrorText('')
    try {
      let currentTitle = title.trim()
      let currentExcerpt = excerpt
      let accessDenied = false

      if (mode !== 'edit' && (!currentTitle || !currentExcerpt)) {
        // Must execute straight from click gesture for Chrome permission prompt
        const granted = await requestPageAccess(trimmedLink)
        const meta = granted
          ? await readActivePageMeta(trimmedLink)
          : { title: '', description: '', denied: true }
        if (!currentTitle) currentTitle = meta.title
        if (!currentExcerpt) currentExcerpt = meta.description
        accessDenied = Boolean(meta.denied)
      }

      const result = await optimizeFields({
        link: trimmedLink,
        title: currentTitle,
        excerpt: currentExcerpt,
      })

      if (result.title) setTitle(result.title)
      if (result.excerpt !== currentExcerpt) setAdvancedOpen(true)
      setExcerpt(result.excerpt)

      if (accessDenied) {
        toast.error('未授权访问该网页，已仅优化书签名')
      } else {
        toast.success(result.changed ? '已优化书签名和摘要' : '没有需要优化的地方')
      }
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : '优化失败')
    } finally {
      setOptimizing(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedLink = link.trim()
    const numericCollection = Number(collectionId)
    if (!isValidHttpUrl(trimmedLink)) {
      setErrorText('请输入有效的 HTTP/HTTPS 链接。')
      return
    }
    if (!Number.isFinite(numericCollection) || numericCollection === 0) {
      setErrorText('请选择实际收藏夹。')
      return
    }

    setSubmitting(true)
    setErrorText('')
    try {
      await onSubmit({
        mode,
        id: initialItem?._id,
        link: trimmedLink,
        title: title.trim(),
        collectionId: numericCollection,
        tags: normalizeTags(tagsText),
        note,
        excerpt,
      })
      onOpenChange(false)
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const activeCollectionLabel =
    collectionOptions.find((opt) => String(opt.id) === collectionId)?.label.trim() || '未分类'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? '编辑书签' : '保存书签'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup className="gap-3.5">
            <Field>
              <FieldLabel htmlFor="editorLinkInput">链接</FieldLabel>
              <Input
                id="editorLinkInput"
                type="url"
                required
                value={link}
                onChange={(event) => setLink(event.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="editorTitleInput">标题</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="editorTitleInput"
                  type="text"
                  maxLength={1000}
                  placeholder="可留空"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
                <InputGroupAddon align="inline-end">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <InputGroupButton
                          size="icon-xs"
                          disabled={optimizing}
                          aria-label="优化书签名和摘要"
                          onClick={handleOptimize}
                        />
                      }
                    >
                      {optimizing ? <DotLoader /> : <Sparkles className="size-3.5" />}
                    </TooltipTrigger>
                    <TooltipContent>优化书签名和摘要</TooltipContent>
                  </Tooltip>
                </InputGroupAddon>
              </InputGroup>
            </Field>

            <Field>
              <FieldLabel>收藏夹</FieldLabel>
              <Select value={collectionId} onValueChange={(value) => value && setCollectionId(value)}>
                <SelectTrigger className="w-full" aria-label="选择收藏夹">
                  <SelectValue>{activeCollectionLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {collectionOptions.map((opt) => (
                    <SelectItem key={opt.id} value={String(opt.id)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between py-1 text-sm font-medium text-muted-foreground hover:text-foreground">
                <span>更多字段（标签、备注、摘要）</span>
                <ChevronRight
                  className={cn(
                    'size-4 transition-transform duration-150',
                    advancedOpen && 'rotate-90'
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 flex flex-col gap-3">
                <Field>
                  <FieldLabel htmlFor="editorTagsInput">标签</FieldLabel>
                  <Input
                    id="editorTagsInput"
                    type="text"
                    placeholder="用逗号分隔"
                    value={tagsText}
                    onChange={(event) => setTagsText(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="editorNoteInput">备注</FieldLabel>
                  <Textarea
                    id="editorNoteInput"
                    rows={2}
                    maxLength={10000}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="editorExcerptInput">摘要</FieldLabel>
                  <Textarea
                    id="editorExcerptInput"
                    rows={3}
                    maxLength={10000}
                    value={excerpt}
                    onChange={(event) => setExcerpt(event.target.value)}
                  />
                </Field>
              </CollapsibleContent>
            </Collapsible>

            {errorText && <FieldError>{errorText}</FieldError>}
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="glass" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? '保存中…' : mode === 'edit' ? '保存修改' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
