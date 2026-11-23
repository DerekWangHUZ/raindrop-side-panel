import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup } from '@/components/ui/field'
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
  type FlatCollectionOption,
  groupItemsByCollection,
  normalizeTags,
  type RaindropItem,
  updateRaindrops,
} from '@/lib/raindrop'

interface BulkEditDialogProps {
  open: boolean
  items: RaindropItem[]
  defaultCollectionId: number
  collectionOptions: FlatCollectionOption[]
  onOpenChange: (open: boolean) => void
  onCompleted: (updatedCount: number) => Promise<void>
}

export function BulkEditDialog({
  open,
  items,
  defaultCollectionId,
  collectionOptions,
  onOpenChange,
  onCompleted,
}: BulkEditDialogProps) {
  const [applyCollection, setApplyCollection] = useState(false)
  const [collectionId, setCollectionId] = useState('-1')
  const [applyTags, setApplyTags] = useState(false)
  const [tagsText, setTagsText] = useState('')
  const [applyNote, setApplyNote] = useState(false)
  const [note, setNote] = useState('')
  const [applyExcerpt, setApplyExcerpt] = useState(false)
  const [excerpt, setExcerpt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorText, setErrorText] = useState('')

  useEffect(() => {
    if (!open) return
    setApplyCollection(false)
    const exists = collectionOptions.some((opt) => opt.id === defaultCollectionId)
    setCollectionId(String(exists ? defaultCollectionId : -1))
    setApplyTags(false)
    setTagsText('')
    setApplyNote(false)
    setNote('')
    setApplyExcerpt(false)
    setExcerpt('')
    setSubmitting(false)
    setErrorText('')
  }, [open, defaultCollectionId, collectionOptions])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const updates: Record<string, unknown> = {}
    if (applyCollection) updates.collectionId = Number(collectionId)
    if (applyTags) updates.tags = normalizeTags(tagsText)
    if (applyNote) updates.note = note
    if (applyExcerpt) updates.excerpt = excerpt

    if (!Object.keys(updates).length) {
      setErrorText('请至少勾选一个要修改的字段。')
      return
    }

    setSubmitting(true)
    setErrorText('')
    let updatedCount = 0

    try {
      for (const [sourceId, group] of groupItemsByCollection(items)) {
        await updateRaindrops(sourceId, {
          ids: group.map((item: RaindropItem) => item._id),
          ...updates,
        })
        updatedCount += group.length
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '批量编辑失败'
      setErrorText(`已更新 ${updatedCount}/${items.length} 条：${msg}`)
      if (updatedCount > 0) await onCompleted(updatedCount).catch(() => {})
      setSubmitting(false)
      return
    }

    try {
      onOpenChange(false)
      await onCompleted(updatedCount)
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : '刷新列表失败')
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
          <DialogTitle>批量编辑书签</DialogTitle>
          <DialogDescription>只会应用勾选的字段；未勾选的字段保持原值。</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup className="gap-3">
            <Field>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={applyCollection}
                  onCheckedChange={(checked) => setApplyCollection(Boolean(checked))}
                />
                <span>移动到收藏夹</span>
              </label>
              <Select
                disabled={!applyCollection}
                value={collectionId}
                onValueChange={(value) => value && setCollectionId(value)}
              >
                <SelectTrigger className="w-full" aria-label="目标收藏夹">
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
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={applyTags}
                  onCheckedChange={(checked) => setApplyTags(Boolean(checked))}
                />
                <span>替换标签</span>
              </label>
              <Input
                disabled={!applyTags}
                type="text"
                placeholder="用逗号分隔；留空表示清除"
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
              />
            </Field>

            <Field>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={applyNote}
                  onCheckedChange={(checked) => setApplyNote(Boolean(checked))}
                />
                <span>设置/清空备注</span>
              </label>
              <Textarea
                disabled={!applyNote}
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>

            <Field>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={applyExcerpt}
                  onCheckedChange={(checked) => setApplyExcerpt(Boolean(checked))}
                />
                <span>设置/清空摘要</span>
              </label>
              <Textarea
                disabled={!applyExcerpt}
                rows={2}
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
              />
            </Field>

            {errorText && <FieldError>{errorText}</FieldError>}
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="glass" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? '应用中…' : '应用修改'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
