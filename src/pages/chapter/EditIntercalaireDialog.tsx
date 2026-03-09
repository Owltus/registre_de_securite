import { useState, useEffect } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import type { Intercalaire } from "./types"

interface EditIntercalaireDialogProps {
  page: Intercalaire | null
  onClose: () => void
  onSave: (id: number, title: string, description: string) => void
}

export function EditIntercalaireDialog({ page, onClose, onSave }: EditIntercalaireDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")

  useEffect(() => {
    if (page) {
      setTitle(page.title) // eslint-disable-line react-hooks/set-state-in-effect
      setDescription(page.description ?? "")
    }
  }, [page])

  const handleSubmit = () => {
    if (!page) return
    onSave(page.id, title.trim() || "Sans titre", description.trim())
  }

  return (
    <Dialog.Root open={page !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-sm border bg-background shadow-lg rounded-lg flex flex-col overflow-hidden focus:outline-none">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <Dialog.Title className="text-lg font-semibold">
              Modifier l'intercalaire
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
              <label htmlFor="edit-gp-title" className="text-sm font-medium">
                Titre
              </label>
              <Input
                id="edit-gp-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre de l'intercalaire"
                autoFocus
                onFocus={(e) => e.target.select()}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="edit-gp-description" className="text-sm font-medium">
                Description
              </label>
              <Input
                id="edit-gp-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optionnel)"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Annuler
                </Button>
              </Dialog.Close>
              <Button type="submit">
                Enregistrer
              </Button>
            </div>
          </form>

          <Dialog.Description className="sr-only">
            Modifier le titre et la description de l'intercalaire
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
