import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  chunkItems,
  createRaindrops,
  type FlatCollectionOption,
  normalizeTags,
  parseBulkLines,
} from '@/lib/raindrop'

interface BulkAddDialogProps {
  open: boolean
  defaultCollectionId: number
  collectionOptions: FlatCollectionOption[]
  onOpenChange: (open: boolean) => void
  onCompleted: (createdCount: number) => Promise<void>
}

export function BulkAddDialog({
  open,
  defaultCollectionId,
  collectionOptions,
  onOpenChange,
  onCompleted,
}: BulkAddDialogProps) {
  const [linesInput, setLinesInput] = useState('')
  const [collectionId, setCollectionId] = useState('-1')
  const [tagsText, setTagsText] = useState('')
  const [note, setNote] = useState('')
  const [progressLabel, setProgressLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorText, setErrorText] = useState('')

  useEffect(() => {
    if (!open) return
    setLinesInput('')
    const exists = collectionOptions.some((opt) => opt.id === defaultCollectionId)
    setCollectionId(String(exists ? defaultCollectionId : -1))
    setTagsText('')
    setNote('')
    setProgressLabel('')
    setSubmitting(false)
    setErrorText('')
  }, [open, defaultCollectionId, collectionOptions])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = parseBulkLines(linesInput)
    if (parsed.errors.length > 0) {
      setErrorText(parsed.errors.map((err) => `第 ${err.line} 行：${err.message}`).join('\n'))
      return
    }
    if (!parsed.items.length) {
      setErrorText('请至少输入一条书签。')
      return
    }

    setSubmitting(true)
    setErrorText('')
    const common = {
      collectionId: Number(collectionId),
      tags: normalizeTags(tagsText),
      note,
    }
    const chunks = chunkItems(parsed.items, 100)
    let createdCount = 0

    try {
      for (let index = 0; index < chunks.length; index += 1) {
        setProgressLabel(`新增中 ${index + 1}/${chunks.length}…`)
        await createRaindrops(chunks[index], common)
        createdCount += chunks[index].length
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '批量新增失败'
      setErrorText(`已完成 ${createdCount}/${parsed.items.length} 条：${msg}`)
      if (createdCount > 0) {
        await onCompleted(createdCount).catch(() => {})
      }
      setSubmitting(false)
      setProgressLabel('')
      return
    }

    try {
      onOpenChange(false)
      await onCompleted(parsed.items.length)
    } catch (error) {
      setErrorText(
        `书签已提交，但刷新列表失败：${error instanceof Error ? error.message : '请手动刷新'}`
      )
    } finally {
      setSubmitting(false)
      setProgressLabel('')
    }
  }

  const activeCollectionLabel =
    collectionOptions.find((opt) => String(opt.id) === collectionId)?.label.trim() || '未分类'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批量新增书签</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel htmlFor="bulkAddInput">每行一个 URL，也支持“标题 | URL”</FieldLabel>
              <Textarea
                id="bulkAddInput"
                rows={6}
                className="font-mono text-xs"
                placeholder={'https://example.com\n示例页面 | https://example.com/article'}
                value={linesInput}
                onChange={(event) => setLinesInput(event.target.value)}
              />
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

            <Field>
              <FieldLabel htmlFor="bulkAddTagsInput">公共标签</FieldLabel>
              <Input
                id="bulkAddTagsInput"
                type="text"
                placeholder="用逗号分隔，可留空"
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="bulkAddNoteInput">公共备注</FieldLabel>
              <Textarea
                id="bulkAddNoteInput"
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>

            {errorText && <FieldError className="whitespace-pre-line">{errorText}</FieldError>}
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="glass" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {progressLabel || '开始新增'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
