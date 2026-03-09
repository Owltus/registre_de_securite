import { useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { useQuery } from "@/lib/hooks/useQuery"
import { X, ArrowLeft, FileText, Columns3, PenLine, BookMarked } from "lucide-react"
import type { Periodicite } from "./types"

type ItemType = "document" | "tracking_sheet" | "signature_sheet" | "intercalaire"
type Step = "choose" | "form"

interface CreateItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateDocument: (title: string, description: string) => void
  onCreateTrackingSheet: (title: string, periodiciteId: number) => void
  onCreateSignatureSheet: (title: string, description: string) => void
  onCreateIntercalaire: (title: string, description: string) => void
}

export function CreateItemDialog({
  open,
  onOpenChange,
  onCreateDocument,
  onCreateTrackingSheet,
  onCreateSignatureSheet,
  onCreateIntercalaire,
}: CreateItemDialogProps) {
  const [step, setStep] = useState<Step>("choose")
  const [itemType, setItemType] = useState<ItemType>("document")
  const [title, setTitle] = useState("Sans titre")
  const [description, setDescription] = useState("")
  const [periodiciteId, setPeriodiciteId] = useState<string>("")
  const { data: periodicites } = useQuery<Periodicite>("periodicites")

  const reset = () => {
    setStep("choose")
    setItemType("document")
    setTitle("Sans titre")
    setDescription("")
    setPeriodiciteId("")
  }

  const handleChoose = (type: ItemType) => {
    setItemType(type)
    setStep("form")
  }

  const handleSubmit = () => {
    if (itemType === "document") {
      onCreateDocument(title.trim() || "Sans titre", description.trim())
    } else if (itemType === "tracking_sheet") {
      const pId = Number(periodiciteId)
      if (!pId) return
      onCreateTrackingSheet(title.trim() || "Sans titre", pId)
    } else if (itemType === "signature_sheet") {
      onCreateSignatureSheet(title.trim() || "Sans titre", description.trim())
    } else {
      onCreateIntercalaire(title.trim() || "Sans titre", description.trim())
    }
    reset()
  }

  const dialogTitle =
    step === "choose"
      ? "Nouveau"
      : itemType === "document"
        ? "Nouveau document"
        : itemType === "tracking_sheet"
          ? "Nouvelle feuille de suivi"
        : itemType === "signature_sheet"
          ? "Nouvelle feuille de signature"
          : "Nouvel intercalaire"

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (v) reset()
        onOpenChange(v)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-sm border bg-background shadow-lg rounded-lg flex flex-col overflow-hidden focus:outline-none">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div className="flex items-center gap-2">
              {step === "form" && (
                <button
                  type="button"
                  onClick={() => setStep("choose")}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <Dialog.Title className="text-lg font-semibold">
                {dialogTitle}
              </Dialog.Title>
            </div>
            <Dialog.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Fermer</span>
            </Dialog.Close>
          </div>

          {step === "choose" ? (
            <div className="px-6 py-4 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => handleChoose("document")}
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-left hover:border-primary/50 hover:bg-accent/50 transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Document</p>
                  <p className="text-xs text-muted-foreground">
                    Document texte libre (Markdown)
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleChoose("tracking_sheet")}
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-left hover:border-primary/50 hover:bg-accent/50 transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground shrink-0">
                  <Columns3 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Feuille de suivi</p>
                  <p className="text-xs text-muted-foreground">
                    Suivi périodique avec tableau de vérifications
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleChoose("signature_sheet")}
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-left hover:border-primary/50 hover:bg-accent/50 transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground shrink-0">
                  <PenLine className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Feuille de signature</p>
                  <p className="text-xs text-muted-foreground">
                    Feuille d'émargement avec date
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleChoose("intercalaire")}
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-left hover:border-primary/50 hover:bg-accent/50 transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground shrink-0">
                  <BookMarked className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Intercalaire</p>
                  <p className="text-xs text-muted-foreground">
                    Intercalaire à placer devant des documents externes
                  </p>
                </div>
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSubmit()
              }}
              className="px-6 py-4 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <label htmlFor="create-title" className="text-sm font-medium">
                  Titre
                </label>
                <Input
                  id="create-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    itemType === "document"
                      ? "Titre du document"
                      : itemType === "tracking_sheet"
                        ? "Titre de la feuille de suivi"
                        : itemType === "signature_sheet"
                          ? "Titre de la feuille de signature"
                          : "Titre de l'intercalaire"
                  }
                  autoFocus
                  onFocus={(e) => e.target.select()}
                />
              </div>

              {(itemType === "document" || itemType === "signature_sheet" || itemType === "intercalaire") && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="create-description" className="text-sm font-medium">
                    Description
                  </label>
                  <Input
                    id="create-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description (optionnel)"
                  />
                </div>
              )}

              {itemType === "tracking_sheet" && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="create-periodicite" className="text-sm font-medium">
                    Périodicité
                  </label>
                  <Select value={periodiciteId} onValueChange={setPeriodiciteId}>
                    <SelectTrigger id="create-periodicite">
                      <SelectValue placeholder="Choisir une périodicité" />
                    </SelectTrigger>
                    <SelectContent>
                      {periodicites.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="outline">
                    Annuler
                  </Button>
                </Dialog.Close>
                <Button
                  type="submit"
                  disabled={itemType === "tracking_sheet" && !periodiciteId}
                >
                  Créer
                </Button>
              </div>
            </form>
          )}

          <Dialog.Description className="sr-only">
            Choisir le type d'élément à créer
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
