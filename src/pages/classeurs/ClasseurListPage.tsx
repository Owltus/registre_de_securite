import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import * as Dialog from "@radix-ui/react-dialog"
import { Plus, X, Trash2, Download, Upload } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getChapterIcon, type ClasseurRow } from "@/lib/navigation"
import { useQuery } from "@/lib/hooks/useQuery"
import { useMutation } from "@/lib/hooks/useMutation"
import { sqliteAdapter } from "@/lib/db/sqlite"
import { emit, on, CLASSEURS_CHANGED } from "@/lib/events"
import { IconPicker } from "@/components/IconPicker"
import { importDatabase, importDatabaseFromBytes } from "@/lib/exportMarkdown"

/** Chapitres par défaut à insérer dans chaque nouveau classeur */
const DEFAULT_CHAPTERS = [
  { label: "Informations générales", icon: "Building2", description: "Identité de l'établissement, classement ERP, coordonnées et informations administratives.", sort_order: 1 },
  { label: "Vérifications périodiques", icon: "ClipboardCheck", description: "Rapports de vérifications techniques réglementaires (électricité, gaz, ascenseurs, etc.).", sort_order: 2 },
  { label: "Moyens de secours", icon: "ShieldAlert", description: "Inventaire et maintenance des équipements de sécurité (extincteurs, alarmes, désenfumage, etc.).", sort_order: 3 },
  { label: "Formation du personnel", icon: "GraduationCap", description: "Attestations de formation sécurité incendie, exercices d'évacuation et habilitations.", sort_order: 4 },
  { label: "Travaux", icon: "Wrench", description: "Suivi des travaux réalisés ou en cours impactant la sécurité de l'établissement.", sort_order: 5 },
  { label: "Observations", icon: "Eye", description: "Remarques, anomalies constatées et actions correctives à mener.", sort_order: 6 },
  { label: "Consignes de sécurité", icon: "ScrollText", description: "Consignes générales et particulières de sécurité, plans d'évacuation et procédures.", sort_order: 7 },
  { label: "Commissions de sécurité", icon: "Users", description: "Procès-verbaux des commissions de sécurité et suivi des prescriptions.", sort_order: 8 },
]

async function insertDefaultChapters(classeurId: number) {
  for (const ch of DEFAULT_CHAPTERS) {
    await sqliteAdapter.insert("chapters", { ...ch, classeur_id: classeurId })
  }
}

export default function ClasseurListPage() {
  const navigate = useNavigate()
  const { data: classeurs, refetch } = useQuery<ClasseurRow>("classeurs")
  const { insert, remove } = useMutation("classeurs")
  useEffect(() => on(CLASSEURS_CHANGED, refetch), [refetch])

  const sortedClasseurs = [...classeurs].sort((a, b) => a.sort_order - b.sort_order)

  // Drag-and-drop .db
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounter = useRef(0)

  const handleImportResult = useCallback(async (newId: number | null) => {
    if (newId) {
      emit(CLASSEURS_CHANGED)
      refetch()
      navigate(`/classeurs/${newId}`)
    }
  }, [refetch, navigate])

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    setIsDragOver(true)
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragOver(false)
  }, [])

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragOver(false)

    const file = Array.from(e.dataTransfer.files).find((f) => f.name.endsWith(".db"))
    if (!file) return

    const buffer = await file.arrayBuffer()
    const newId = await importDatabaseFromBytes(buffer)
    handleImportResult(newId)
  }, [handleImportResult])

  // Dialog de création
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newIcon, setNewIcon] = useState("BookOpen")
  const [newEtablissement, setNewEtablissement] = useState("")
  const [newComplement, setNewComplement] = useState("")
  const [useTemplate, setUseTemplate] = useState(true)

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    const nextOrder = classeurs.length > 0
      ? Math.max(...classeurs.map((c) => c.sort_order)) + 1
      : 1
    const newId = await insert({ name, icon: newIcon, etablissement: newEtablissement.trim(), etablissement_complement: newComplement.trim(), sort_order: nextOrder })
    if (useTemplate) {
      await insertDefaultChapters(Number(newId))
    }
    emit(CLASSEURS_CHANGED)
    refetch()
    setCreateOpen(false)
    setNewName("")
    setNewIcon("BookOpen")
    setNewEtablissement("")
    setNewComplement("")
    setUseTemplate(true)
    navigate(`/classeurs/${newId}`)
  }

  // Dialog de suppression
  const [deleteTarget, setDeleteTarget] = useState<ClasseurRow | null>(null)

  const handleDelete = async () => {
    if (!deleteTarget) return
    // Suppression en cascade : documents, tracking_sheets, signature_sheets liés aux chapitres du classeur
    await sqliteAdapter.execute(
      "DELETE FROM documents WHERE chapter_id IN (SELECT id FROM chapters WHERE classeur_id = $1)",
      [deleteTarget.id]
    )
    await sqliteAdapter.execute(
      "DELETE FROM tracking_sheets WHERE chapter_id IN (SELECT id FROM chapters WHERE classeur_id = $1)",
      [deleteTarget.id]
    )
    await sqliteAdapter.execute(
      "DELETE FROM signature_sheets WHERE chapter_id IN (SELECT id FROM chapters WHERE classeur_id = $1)",
      [deleteTarget.id]
    )
    await sqliteAdapter.execute(
      "DELETE FROM chapters WHERE classeur_id = $1",
      [deleteTarget.id]
    )
    await remove(String(deleteTarget.id))
    emit(CLASSEURS_CHANGED)
    refetch()
    setDeleteTarget(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Corps */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center p-6">
        <div className="flex flex-col gap-3 max-w-md w-full">
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-4 rounded-lg border border-dashed bg-card px-5 py-4 hover:bg-accent transition-colors text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground shrink-0">
              <Plus className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">Nouveau classeur</span>
              <span className="text-xs text-muted-foreground/70">Créez un classeur vierge ou pré-rempli avec les chapitres types</span>
            </div>
          </button>

          <button
            onClick={async () => {
              const newId = await importDatabase()
              handleImportResult(newId)
            }}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`relative flex items-center gap-4 rounded-lg border border-dashed px-5 py-4 hover:bg-accent transition-colors text-left ${isDragOver ? "border-primary bg-primary/5" : "bg-card"}`}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${isDragOver ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"}`}>
              {isDragOver ? <Upload className="h-5 w-5" /> : <Download className="h-5 w-5" />}
            </div>
            <div className="flex flex-col">
              <span className={`text-sm font-medium ${isDragOver ? "text-primary" : "text-muted-foreground"}`}>
                {isDragOver ? "Déposez le fichier .db ici" : "Importer un classeur"}
              </span>
              {!isDragOver && (
                <span className="text-xs text-muted-foreground/70">Reprenez un classeur existant depuis une sauvegarde</span>
              )}
            </div>
          </button>

          {sortedClasseurs.length > 0 && <div className="border-b border-border" />}
          {sortedClasseurs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center">
              Aucun classeur. Créez-en un pour commencer.
            </p>
          ) : (
            sortedClasseurs.map((cl) => {
              const Icon = getChapterIcon(cl.icon)
              const subtitle = [cl.etablissement, cl.etablissement_complement].filter(Boolean).join(" · ")
              return (
                <button
                  key={cl.id}
                  onClick={() => navigate(`/classeurs/${cl.id}`)}
                  className="group flex items-center gap-4 rounded-lg border bg-card px-5 py-4 hover:bg-accent transition-colors text-left"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-sm font-semibold truncate">{cl.name}</span>
                    {subtitle && (
                      <span className="text-xs text-muted-foreground truncate">{subtitle}</span>
                    )}
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        role="button"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(cl) }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Supprimer</TooltipContent>
                  </Tooltip>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Dialog de création */}
      <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-lg border bg-background shadow-lg rounded-lg flex flex-col overflow-hidden focus:outline-none max-h-[85vh]">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <Dialog.Title className="text-lg font-semibold">
                Nouveau classeur
              </Dialog.Title>
              <Dialog.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                <X className="h-4 w-4" />
                <span className="sr-only">Fermer</span>
              </Dialog.Close>
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); handleCreate() }}
              className="px-6 py-4 flex flex-col gap-4 overflow-y-auto"
            >
              <div className="flex flex-col gap-2">
                <label htmlFor="classeur-name" className="text-sm font-medium">Nom</label>
                <Input
                  id="classeur-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nom du classeur"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Icône</label>
                <IconPicker value={newIcon} onChange={setNewIcon} />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="classeur-etablissement" className="text-sm font-medium">Établissement</label>
                <Input
                  id="classeur-etablissement"
                  value={newEtablissement}
                  onChange={(e) => setNewEtablissement(e.target.value)}
                  placeholder="Nom de l'établissement"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="classeur-complement" className="text-sm font-medium">Complément</label>
                <Input
                  id="classeur-complement"
                  value={newComplement}
                  onChange={(e) => setNewComplement(e.target.value)}
                  placeholder="Précision (optionnel)"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                <input
                  type="checkbox"
                  checked={useTemplate}
                  onChange={(e) => setUseTemplate(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Chapitres par défaut</span>
                  <span className="text-xs text-muted-foreground">
                    Pré-remplir avec les {DEFAULT_CHAPTERS.length} chapitres du registre de sécurité ERP
                  </span>
                </div>
              </label>

              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="outline">Annuler</Button>
                </Dialog.Close>
                <Button type="submit" disabled={!newName.trim()}>Créer</Button>
              </div>
            </form>

            <Dialog.Description className="sr-only">
              Créer un nouveau classeur avec ses chapitres par défaut
            </Dialog.Description>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Dialog de suppression */}
      <Dialog.Root open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md border bg-background shadow-lg rounded-lg flex flex-col overflow-hidden focus:outline-none">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <Dialog.Title className="text-lg font-semibold">
                Supprimer le classeur
              </Dialog.Title>
              <Dialog.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                <X className="h-4 w-4" />
                <span className="sr-only">Fermer</span>
              </Dialog.Close>
            </div>

            <div className="px-6 py-4 flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Supprimer le classeur <strong>« {deleteTarget?.name} »</strong> et tout son contenu (chapitres, documents, fiches de suivi et de signature) ? Cette action est irréversible.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
                <Button variant="destructive" onClick={handleDelete}>Supprimer</Button>
              </div>
            </div>

            <Dialog.Description className="sr-only">
              Confirmer la suppression du classeur et de tout son contenu
            </Dialog.Description>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
