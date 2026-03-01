import { useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { X, Trash2 } from "lucide-react"
import type { ChapterRow } from "@/lib/navigation"

interface EditChapterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chapter: ChapterRow
  onSave: (label: string, description: string) => void
  onDelete: () => void
}

export function EditChapterDialog({ open, onOpenChange, chapter, onSave, onDelete }: EditChapterDialogProps) {
  const [label, setLabel] = useState(chapter.label)
  const [description, setDescription] = useState(chapter.description)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setLabel(chapter.label)
      setDescription(chapter.description)
      setConfirmDelete(false)
    }
    onOpenChange(v)
  }

  const handleSubmit = () => {
    onSave(label.trim() || chapter.label, description.trim())
  }

  // Vue confirmation de suppression
  if (confirmDelete) {
    return (
      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-sm border bg-background shadow-lg rounded-lg flex flex-col overflow-hidden focus:outline-none">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <Dialog.Title className="text-lg font-semibold">
                Supprimer le chapitre
              </Dialog.Title>
              <Dialog.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                <X className="h-4 w-4" />
                <span className="sr-only">Fermer</span>
              </Dialog.Close>
            </div>

            <div className="px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Voulez-vous vraiment supprimer <span className="font-medium text-foreground">{chapter.label}</span> et tous ses documents ? Cette action est irréversible.
              </p>
            </div>

            <div className="flex justify-end gap-2 px-6 pb-4">
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4 mr-1.5" />
                Supprimer
              </Button>
            </div>

            <Dialog.Description className="sr-only">
              Confirmer la suppression du chapitre
            </Dialog.Description>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    )
  }

  // Vue édition
  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-sm border bg-background shadow-lg rounded-lg flex flex-col overflow-hidden focus:outline-none">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <Dialog.Title className="text-lg font-semibold">
              Modifier le chapitre
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Fermer</span>
            </Dialog.Close>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSubmit()
            }}
            className="px-6 py-4 flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="edit-chapter-label" className="text-sm font-medium">
                Nom
              </label>
              <Input
                id="edit-chapter-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Nom du chapitre"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="edit-chapter-desc" className="text-sm font-medium">
                Description
              </label>
              <Textarea
                id="edit-chapter-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description du chapitre"
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="flex justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Supprimer
              </Button>
              <div className="flex gap-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="outline">
                    Annuler
                  </Button>
                </Dialog.Close>
                <Button type="submit">Enregistrer</Button>
              </div>
            </div>
          </form>

          <Dialog.Description className="sr-only">
            Modifier le nom et la description du chapitre
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
