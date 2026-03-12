import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import * as Dialog from "@radix-ui/react-dialog"
import { Plus, X, Trash2, Download, Upload } from "lucide-react"
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { DragEndEvent } from "@dnd-kit/core"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getChapterIcon, type ClasseurRow } from "@/lib/navigation"
import { useQuery } from "@/lib/hooks/useQuery"
import { useMutation } from "@/lib/hooks/useMutation"
import { sqliteAdapter } from "@/lib/db/sqlite"
import { emit, on, CLASSEURS_CHANGED } from "@/lib/events"
import { useDndRegistry } from "@/lib/dnd/useDndRegistry"
import { IconPicker } from "@/components/IconPicker"
import { importClasseur, importJsonAsNewClasseurFromBytes } from "@/lib/exportMarkdown"

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

/** Carte de classeur réordonnnable par drag-and-drop */
function SortableClasseurCard({
  classeur,
  icon: Icon,
  onNavigate,
  onDelete,
}: {
  classeur: ClasseurRow
  icon: React.ComponentType<{ className?: string }>
  onNavigate: () => void
  onDelete: () => void
}) {
  const subtitle = [classeur.etablissement, classeur.etablissement_complement].filter(Boolean).join(" · ")

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: classeur.id,
    data: { type: "classeur", classeurId: classeur.id, title: classeur.name, icon: classeur.icon, subtitle },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`touch-none ${isDragging ? "z-50 opacity-30" : ""}`}
    >
      <button
        onClick={onNavigate}
        className="group flex items-center gap-4 rounded-lg border bg-card px-5 py-4 hover:bg-accent transition-colors text-left w-full"
      >
        <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex flex-col gap-0.5 min-w-0 flex-1 min-h-[2.5rem] justify-center">
          <span className="text-sm font-medium truncate">{classeur.name}</span>
          {subtitle && <span className="text-xs text-muted-foreground truncate">{subtitle}</span>}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              role="button"
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              aria-label="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </div>
          </TooltipTrigger>
          <TooltipContent>Supprimer</TooltipContent>
        </Tooltip>
      </button>
    </div>
  )
}

export default function ClasseurListPage() {
  const navigate = useNavigate()
  const { data: classeurs, refetch } = useQuery<ClasseurRow>("classeurs")
  const { insert, remove, update } = useMutation("classeurs")
  useEffect(() => on(CLASSEURS_CHANGED, refetch), [refetch])

  const sortedClasseurs = useMemo(
    () => [...classeurs].sort((a, b) => a.sort_order - b.sort_order),
    [classeurs]
  )

  // État local optimiste pour le drag-and-drop
  const [localClasseurs, setLocalClasseurs] = useState<ClasseurRow[]>([])
  useEffect(() => { setLocalClasseurs(sortedClasseurs) }, [sortedClasseurs])

  // Ref stable pour éviter de recréer le handler à chaque changement de localClasseurs
  const localClasseursRef = useRef(localClasseurs)
  useEffect(() => { localClasseursRef.current = localClasseurs }, [localClasseurs])

  // Handler de réordonnancement DnD
  const dndRegistry = useDndRegistry()

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const items = localClasseursRef.current
      const oldIndex = items.findIndex((c) => c.id === active.id)
      const newIndex = items.findIndex((c) => c.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      // 1. Mise à jour optimiste
      const reordered = [...items]
      const [moved] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, moved)
      setLocalClasseurs(reordered)

      // 2. Persister en DB
      Promise.all(
        reordered.map((cl, i) =>
          update(String(cl.id), { sort_order: i + 1 })
        )
      ).then(() => {
        emit(CLASSEURS_CHANGED)
        refetch()
      })
    },
    [update, refetch]
  )

  useEffect(() => {
    dndRegistry.registerHandler("classeur", handleDragEnd)
    return () => dndRegistry.unregisterHandler("classeur")
  }, [dndRegistry, handleDragEnd])

  // Drag-and-drop .json
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounter = useRef(0)

  const handleImportResult = useCallback(async (newId: number | null) => {
    if (newId) {
      emit(CLASSEURS_CHANGED)
      refetch()
      toast.success("Classeur importé")
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

    const file = Array.from(e.dataTransfer.files).find((f) => f.name.endsWith(".json"))
    if (!file) return

    const buffer = await file.arrayBuffer()
    const newId = await importJsonAsNewClasseurFromBytes(buffer)
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
    // Soft delete en cascade : items, chapitres, puis suppression réelle du classeur
    const now = new Date().toISOString()
    await sqliteAdapter.execute(
      "UPDATE documents SET deleted_at = $2 WHERE chapter_id IN (SELECT id FROM chapters WHERE classeur_id = $1) AND deleted_at IS NULL",
      [deleteTarget.id, now]
    )
    await sqliteAdapter.execute(
      "UPDATE tracking_sheets SET deleted_at = $2 WHERE chapter_id IN (SELECT id FROM chapters WHERE classeur_id = $1) AND deleted_at IS NULL",
      [deleteTarget.id, now]
    )
    await sqliteAdapter.execute(
      "UPDATE signature_sheets SET deleted_at = $2 WHERE chapter_id IN (SELECT id FROM chapters WHERE classeur_id = $1) AND deleted_at IS NULL",
      [deleteTarget.id, now]
    )
    await sqliteAdapter.execute(
      "UPDATE intercalaires SET deleted_at = $2 WHERE chapter_id IN (SELECT id FROM chapters WHERE classeur_id = $1) AND deleted_at IS NULL",
      [deleteTarget.id, now]
    )
    await sqliteAdapter.execute(
      "UPDATE chapters SET deleted_at = $2 WHERE classeur_id = $1 AND deleted_at IS NULL",
      [deleteTarget.id, now]
    )
    await remove(String(deleteTarget.id))
    emit(CLASSEURS_CHANGED)
    refetch()
    setDeleteTarget(null)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto flex items-center justify-center p-6">
        <div className="flex flex-col gap-4 max-w-md w-full">

          {/* Nouveau classeur + Importer */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-4 rounded-lg border border-dashed bg-card px-5 py-4 hover:bg-accent transition-colors text-left"
            >
              <Plus className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Nouveau classeur</span>
                <span className="text-xs text-muted-foreground">Vierge ou pré-rempli</span>
              </div>
            </button>
            <button
              onClick={async () => {
                const newId = await importClasseur()
                handleImportResult(newId)
              }}
              onDragEnter={onDragEnter}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`flex items-center gap-4 rounded-lg border border-dashed px-5 py-4 hover:bg-accent transition-colors text-left ${isDragOver ? "border-primary bg-primary/5" : "bg-card"}`}
            >
              {isDragOver ? <Upload className="h-5 w-5 text-muted-foreground shrink-0" /> : <Download className="h-5 w-5 text-muted-foreground shrink-0" />}
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{isDragOver ? "Déposez ici" : "Importer"}</span>
                {!isDragOver && <span className="text-xs text-muted-foreground">Depuis un fichier .json</span>}
              </div>
            </button>
          </div>

          {localClasseurs.length > 0 && <div className="border-b border-border" />}

          {/* Liste des classeurs */}
          {localClasseurs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center">
              Aucun classeur. Créez-en un pour commencer.
            </p>
          ) : (
            <SortableContext
              items={localClasseurs.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {localClasseurs.map((cl) => (
                <SortableClasseurCard
                  key={cl.id}
                  classeur={cl}
                  icon={getChapterIcon(cl.icon)}
                  onNavigate={() => navigate(`/classeurs/${cl.id}`)}
                  onDelete={() => setDeleteTarget(cl)}
                />
              ))}
            </SortableContext>
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
