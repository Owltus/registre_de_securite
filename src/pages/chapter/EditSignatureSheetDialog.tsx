import { useState, useEffect } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import type { SignatureSheet } from "./types"

interface EditSignatureSheetDialogProps {
  sheet: SignatureSheet | null
  onClose: () => void
  onSave: (id: number, title: string) => void
}

export function EditSignatureSheetDialog({ sheet, onClose, onSave }: EditSignatureSheetDialogProps) {
  const [title, setTitle] = useState("")

  useEffect(() => {
    if (sheet) {
      setTitle(sheet.title) // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [sheet])

  const handleSubmit = () => {
    if (!sheet) return
    onSave(sheet.id, title.trim() || "Sans titre")
  }

  return (
    <Dialog.Root open={sheet !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-sm border bg-background shadow-lg rounded-lg flex flex-col overflow-hidden focus:outline-none">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <Dialog.Title className="text-lg font-semibold">
              Modifier la feuille de signature
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
              <label htmlFor="edit-sig-title" className="text-sm font-medium">
                Titre
              </label>
              <Input
                id="edit-sig-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre de la feuille de signature"
                autoFocus
                onFocus={(e) => e.target.select()}
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
            Modifier le titre de la feuille de signature
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
