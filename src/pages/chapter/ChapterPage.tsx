import { useState, useCallback, useMemo, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import type { DragEndEvent } from "@dnd-kit/core"
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import { useQuery } from "@/lib/hooks/useQuery"
import { useMutation } from "@/lib/hooks/useMutation"
import type { ChapterRow, ClasseurRow } from "@/lib/navigation"
import { DEFAULT_REGISTRY_NAME, buildEstablishment } from "@/lib/navigation"
import { useDndRegistry, type DocumentDragData, type TrackingSheetDragData, type SignatureSheetDragData, type IntercalaireDragData } from "@/lib/dnd/useDndRegistry"
import { PrintPreview } from "@/components/print/PrintPreview"
import { DocumentPages } from "@/components/print/DocumentPages"
import { TrackingSheetPage } from "@/components/print/TrackingSheetPage"
import { SignatureSheetPage } from "@/components/print/SignatureSheetPage"
import { IntercalaireSheet } from "@/components/print/IntercalaireSheet"
import { CoverPage } from "@/components/print/CoverPage"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Plus, FileText, Pencil, Printer } from "lucide-react"
import type { Doc, TrackingSheet, SignatureSheet, Intercalaire, Periodicite, ChapterItem } from "./types"
import { DocumentCard } from "./DocumentCard"
import { TrackingSheetCard } from "./TrackingSheetCard"
import { IntercalaireCard } from "./IntercalaireCard"
import { CreateItemDialog } from "./CreateItemDialog"
import { DeleteItemDialog } from "./DeleteItemDialog"
import { EditItemDialog } from "./EditItemDialog"
import { EditTrackingSheetDialog } from "./EditTrackingSheetDialog"
import { SignatureSheetCard } from "./SignatureSheetCard"
import { EditChapterDialog } from "./EditChapterDialog"
import { useDropZone, DropOverlay } from "./DropZone"
import { emit, CHAPTERS_CHANGED } from "@/lib/events"

export default function ChapterPage() {
  const { chapterId, classeurId } = useParams<{ chapterId: string; classeurId: string }>()
  const navigate = useNavigate()

  // Chargement du classeur depuis la DB
  const classeurFilters = useMemo(() => ({ id: Number(classeurId) }), [classeurId])
  const { data: classeurRows } = useQuery<ClasseurRow>("classeurs", classeurFilters)
  const classeur = classeurRows[0] ?? null
  const classeurName = classeur?.name ?? DEFAULT_REGISTRY_NAME
  const establishment = buildEstablishment(classeur)

  // Chargement du chapitre depuis la DB
  const chapterFilters = useMemo(() => ({ id: Number(chapterId) }), [chapterId])
  const { data: chapterRows, loading: chapterLoading, refetch: chapterRefetch } = useQuery<ChapterRow>("chapters", chapterFilters)
  const chapter = chapterRows[0] ?? null

  const filters = useMemo(() => ({ chapter_id: String(chapterId ?? "") }), [chapterId])
  const { data: docs, loading, refetch } = useQuery<Doc>("documents", filters)
  const { insert, update: updateDoc, remove } = useMutation("documents")
  const { update: updateChapter, remove: removeChapter } = useMutation("chapters")

  // Feuilles de suivi
  const { data: trackingSheets, loading: tsLoading, refetch: tsRefetch } = useQuery<TrackingSheet>("tracking_sheets", filters)
  const { insert: insertTs, update: updateTs, remove: removeTs } = useMutation("tracking_sheets")
  const { data: periodicites } = useQuery<Periodicite>("periodicites")

  // Feuilles de signature
  const { data: signatureSheets, loading: ssLoading, refetch: ssRefetch } = useQuery<SignatureSheet>("signature_sheets", filters)
  const { insert: insertSs, update: updateSs, remove: removeSs } = useMutation("signature_sheets")

  // Intercalaires
  const { data: intercalaires, loading: gpLoading, refetch: gpRefetch } = useQuery<Intercalaire>("intercalaires", filters)
  const { insert: insertGp, update: updateGp, remove: removeGp } = useMutation("intercalaires")

  // Liste unifiée triée par sort_order
  const allItems: ChapterItem[] = useMemo(() => {
    const items: ChapterItem[] = [
      ...docs.map(d => ({ kind: "document" as const, data: d })),
      ...trackingSheets.map(s => ({ kind: "tracking_sheet" as const, data: s })),
      ...signatureSheets.map(s => ({ kind: "signature_sheet" as const, data: s })),
      ...intercalaires.map(g => ({ kind: "intercalaire" as const, data: g })),
    ]
    return items.sort((a, b) => a.data.sort_order - b.data.sort_order)
  }, [docs, trackingSheets, signatureSheets, intercalaires])

  // État local optimiste pour le réordonnancement
  const [optimisticItems, setOptimisticItems] = useState<ChapterItem[] | null>(null)
  const [prevAllItems, setPrevAllItems] = useState(allItems)
  if (prevAllItems !== allItems) {
    setPrevAllItems(allItems)
    if (optimisticItems !== null) setOptimisticItems(null)
  }
  const localItems = optimisticItems ?? allItems
  const setLocalItems = setOptimisticItems

  // IDs pour le SortableContext (préfixés selon le type)
  const sortableIds = useMemo(
    () => localItems.map((item) => {
      if (item.kind === "document") return `document-${item.data.id}`
      if (item.kind === "tracking_sheet") return `sheet-${item.data.id}`
      if (item.kind === "signature_sheet") return `sig-${item.data.id}`
      return `int-${item.data.id}`
    }),
    [localItems]
  )

  const [createOpen, setCreateOpen] = useState(false)
  const [editChapterOpen, setEditChapterOpen] = useState(false)

  // Dialogs génériques — item + type
  const [editDoc, setEditDoc] = useState<Doc | null>(null)
  const [deleteItem, setDeleteItem] = useState<{ item: { title: string; id: number }; kind: "document" | "tracking_sheet" | "signature_sheet" | "intercalaire" } | null>(null)

  // Aperçu avant impression
  type PrintPreviewState =
    | { type: "document"; doc: Doc }
    | { type: "tracking_sheet"; sheet: TrackingSheet; periodiciteLabel: string; nombre: number }
    | { type: "signature_sheet"; sheet: SignatureSheet }
    | { type: "intercalaire"; page: Intercalaire }
    | { type: "all" }
    | null
  const [printPreview, setPrintPreview] = useState<PrintPreviewState>(null)

  // États feuilles de suivi
  const [editSheet, setEditSheet] = useState<TrackingSheet | null>(null)

  // États feuilles de signature
  const [editSigSheet, setEditSigSheet] = useState<SignatureSheet | null>(null)

  // États intercalaires
  const [editIntercalaire, setEditIntercalaire] = useState<Intercalaire | null>(null)

  // Drag-and-drop fichiers (import)
  const handleImport = useCallback(async (files: { title: string; content: string }[]) => {
    const nextOrder = localItems.length > 0
      ? Math.max(...localItems.map((item) => item.data.sort_order)) + 1
      : 1
    for (let i = 0; i < files.length; i++) {
      const { title, content } = files[i]
      await insert({ title, content, chapter_id: chapterId ?? "", sort_order: nextOrder + i })
    }
    refetch()
  }, [insert, chapterId, refetch, localItems])

  const { isDragOver, dragProps } = useDropZone(handleImport)

  // Drag-and-drop unifié : réordonnancement OU déplacement vers un autre chapitre
  const dndRegistry = useDndRegistry()

  const handleItemDrop = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const data = active.data.current as (DocumentDragData | TrackingSheetDragData | SignatureSheetDragData | IntercalaireDragData) | undefined
      if (!data) return

      const overData = over.data.current as { type?: string; chapterId?: string } | undefined

      // Cas 1 : drop sur un chapitre de la sidebar → déplacer l'item
      if (overData?.type === "chapter") {
        const targetChapterId = overData.chapterId ?? String(over.id)
        const sourceChapterId = data.sourceChapterId
        if (targetChapterId === sourceChapterId) return

        if (data.type === "document") {
          await updateDoc(String(data.docId), { chapter_id: targetChapterId })
          refetch()
        } else if (data.type === "tracking_sheet") {
          await updateTs(String(data.sheetId), { chapter_id: targetChapterId })
          tsRefetch()
        } else if (data.type === "signature_sheet") {
          await updateSs(String(data.sheetId), { chapter_id: targetChapterId })
          ssRefetch()
        } else {
          await updateGp(String(data.pageId), { chapter_id: targetChapterId })
          gpRefetch()
        }
        return
      }

      // Cas 2 : drop sur un autre item → réordonner
      const overType = overData?.type
      if (overType === "document" || overType === "tracking_sheet" || overType === "signature_sheet" || overType === "intercalaire") {
        const activeId = String(active.id)
        const overId = String(over.id)
        const itemSortId = (item: ChapterItem) => {
          if (item.kind === "document") return `document-${item.data.id}`
          if (item.kind === "tracking_sheet") return `sheet-${item.data.id}`
          if (item.kind === "signature_sheet") return `sig-${item.data.id}`
          return `int-${item.data.id}`
        }
        const oldIndex = localItems.findIndex((item) => itemSortId(item) === activeId)
        const newIndex = localItems.findIndex((item) => itemSortId(item) === overId)
        if (oldIndex === -1 || newIndex === -1) return

        // Mise à jour optimiste
        const reordered = [...localItems]
        const [moved] = reordered.splice(oldIndex, 1)
        reordered.splice(newIndex, 0, moved)
        setLocalItems(reordered)

        // Persister en DB — mettre à jour le sort_order de chaque item
        await Promise.all(
          reordered.map((item, i) => {
            if (item.kind === "document") {
              return updateDoc(String(item.data.id), { sort_order: i + 1 })
            } else if (item.kind === "tracking_sheet") {
              return updateTs(String(item.data.id), { sort_order: i + 1 })
            } else if (item.kind === "signature_sheet") {
              return updateSs(String(item.data.id), { sort_order: i + 1 })
            } else {
              return updateGp(String(item.data.id), { sort_order: i + 1 })
            }
          })
        )
        refetch()
        tsRefetch()
        ssRefetch()
        gpRefetch()
      }
    },
    [localItems, setLocalItems, updateDoc, updateTs, updateSs, updateGp, refetch, tsRefetch, ssRefetch, gpRefetch]
  )

  useEffect(() => {
    dndRegistry.registerHandler("document", handleItemDrop)
    dndRegistry.registerHandler("tracking_sheet", handleItemDrop)
    dndRegistry.registerHandler("signature_sheet", handleItemDrop)
    dndRegistry.registerHandler("intercalaire", handleItemDrop)
    return () => {
      dndRegistry.unregisterHandler("document")
      dndRegistry.unregisterHandler("tracking_sheet")
      dndRegistry.unregisterHandler("signature_sheet")
      dndRegistry.unregisterHandler("intercalaire")
    }
  }, [dndRegistry, handleItemDrop])

  // Export PDF — ouvre l'aperçu avant impression
  const handleExport = useCallback((e: React.MouseEvent, doc: Doc) => {
    e.stopPropagation()
    setPrintPreview({ type: "document", doc })
  }, [])

  // Édition document (titre + description)
  const handleDocEditClick = useCallback((e: React.MouseEvent, doc: Doc) => {
    e.stopPropagation()
    setEditDoc(doc)
  }, [])

  const handleDocEditSave = useCallback(async (values: Record<string, string>) => {
    if (!editDoc) return
    try {
      await updateDoc(String(editDoc.id), { title: values.title?.trim() || "Sans titre", description: values.description?.trim() ?? "" })
      refetch()
      setEditDoc(null)
    } catch {
      toast.error("Erreur lors de la modification")
    }
  }, [editDoc, updateDoc, refetch])

  // Création document
  const handleCreate = useCallback(async (title: string, description: string) => {
    const nextOrder = localItems.length > 0
      ? Math.max(...localItems.map((item) => item.data.sort_order)) + 1
      : 1
    await insert({ title, description, content: "", chapter_id: chapterId ?? "", sort_order: nextOrder })
    refetch()
    setCreateOpen(false)
  }, [insert, chapterId, refetch, localItems])

  // Création feuille de suivi
  const handleCreateTrackingSheet = useCallback(async (title: string, periodiciteId: number) => {
    const nextOrder = localItems.length > 0
      ? Math.max(...localItems.map((item) => item.data.sort_order)) + 1
      : 1
    await insertTs({ title, chapter_id: chapterId ?? "", periodicite_id: periodiciteId, sort_order: nextOrder })
    tsRefetch()
    setCreateOpen(false)
  }, [insertTs, chapterId, tsRefetch, localItems])

  // Création feuille de signature
  const handleCreateSignatureSheet = useCallback(async (title: string, description: string) => {
    const nextOrder = localItems.length > 0
      ? Math.max(...localItems.map((item) => item.data.sort_order)) + 1
      : 1
    await insertSs({ title, description, chapter_id: chapterId ?? "", nombre: 14, sort_order: nextOrder })
    ssRefetch()
    setCreateOpen(false)
  }, [insertSs, chapterId, ssRefetch, localItems])

  // Export PDF feuille de suivi — ouvre l'aperçu avant impression
  const handleTsExport = useCallback((e: React.MouseEvent, sheet: TrackingSheet) => {
    e.stopPropagation()
    const perio = periodicites.find((p) => p.id === sheet.periodicite_id)
    setPrintPreview({
      type: "tracking_sheet",
      sheet,
      periodiciteLabel: perio?.label ?? "",
      nombre: perio?.nombre ?? 8,
    })
  }, [periodicites])

  // Édition feuille de suivi
  const handleTsEditClick = useCallback((e: React.MouseEvent, sheet: TrackingSheet) => {
    e.stopPropagation()
    setEditSheet(sheet)
  }, [])

  const handleTsEditSave = useCallback(async (id: number, title: string, periodiciteId: number) => {
    try {
      await updateTs(String(id), { title, periodicite_id: periodiciteId })
      tsRefetch()
      setEditSheet(null)
    } catch {
      toast.error("Erreur lors de la modification")
    }
  }, [updateTs, tsRefetch])

  // Export PDF feuille de signature
  const handleSsExport = useCallback((e: React.MouseEvent, sheet: SignatureSheet) => {
    e.stopPropagation()
    setPrintPreview({ type: "signature_sheet", sheet })
  }, [])

  // Édition feuille de signature
  const handleSsEditClick = useCallback((e: React.MouseEvent, sheet: SignatureSheet) => {
    e.stopPropagation()
    setEditSigSheet(sheet)
  }, [])

  const handleSsEditSave = useCallback(async (values: Record<string, string>) => {
    if (!editSigSheet) return
    try {
      await updateSs(String(editSigSheet.id), { title: values.title?.trim() || "Sans titre", description: values.description?.trim() ?? "" })
      ssRefetch()
      setEditSigSheet(null)
    } catch {
      toast.error("Erreur lors de la modification")
    }
  }, [editSigSheet, updateSs, ssRefetch])

  // Création intercalaire
  const handleCreateIntercalaire = useCallback(async (title: string, description: string) => {
    const nextOrder = localItems.length > 0
      ? Math.max(...localItems.map((item) => item.data.sort_order)) + 1
      : 1
    await insertGp({ title, description, chapter_id: chapterId ?? "", sort_order: nextOrder })
    gpRefetch()
    setCreateOpen(false)
  }, [insertGp, chapterId, gpRefetch, localItems])

  // Export PDF intercalaire
  const handleGpExport = useCallback((e: React.MouseEvent, page: Intercalaire) => {
    e.stopPropagation()
    setPrintPreview({ type: "intercalaire", page })
  }, [])

  // Édition intercalaire
  const handleGpEditClick = useCallback((e: React.MouseEvent, page: Intercalaire) => {
    e.stopPropagation()
    setEditIntercalaire(page)
  }, [])

  const handleGpEditSave = useCallback(async (values: Record<string, string>) => {
    if (!editIntercalaire) return
    try {
      await updateGp(String(editIntercalaire.id), { title: values.title?.trim() || "Sans titre", description: values.description?.trim() ?? "" })
      gpRefetch()
      setEditIntercalaire(null)
    } catch {
      toast.error("Erreur lors de la modification")
    }
  }, [editIntercalaire, updateGp, gpRefetch])

  // Suppression générique
  const handleDeleteClick = useCallback((e: React.MouseEvent, item: { title: string; id: number }, kind: "document" | "tracking_sheet" | "signature_sheet" | "intercalaire") => {
    e.stopPropagation()
    setDeleteItem({ item, kind })
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteItem) return
    try {
      const { item, kind } = deleteItem
      if (kind === "document") {
        await remove(String(item.id))
        refetch()
      } else if (kind === "tracking_sheet") {
        await removeTs(String(item.id))
        tsRefetch()
      } else if (kind === "signature_sheet") {
        await removeSs(String(item.id))
        ssRefetch()
      } else {
        await removeGp(String(item.id))
        gpRefetch()
      }
      setDeleteItem(null)
    } catch {
      toast.error("Erreur lors de la suppression")
    }
  }, [deleteItem, remove, removeTs, removeSs, removeGp, refetch, tsRefetch, ssRefetch, gpRefetch])

  // Édition du chapitre
  const handleChapterSave = useCallback(async (label: string, description: string, icon: string) => {
    if (!chapterId) return
    await updateChapter(chapterId, { label, description, icon })
    chapterRefetch()
    emit(CHAPTERS_CHANGED)
    setEditChapterOpen(false)
  }, [chapterId, updateChapter, chapterRefetch])

  // Suppression du chapitre
  const handleChapterDelete = useCallback(async () => {
    if (!chapterId) return
    await removeChapter(chapterId)
    emit(CHAPTERS_CHANGED)
    navigate(classeurId ? `/classeurs/${classeurId}` : "/")
  }, [chapterId, classeurId, removeChapter, navigate])

  const deleteDialogConfig = useMemo(() => {
    if (!deleteItem) return { title: "", sr: "" }
    const labels: Record<string, { title: string; sr: string }> = {
      document: { title: "Supprimer le document", sr: "Confirmer la suppression du document" },
      tracking_sheet: { title: "Supprimer la feuille de suivi", sr: "Confirmer la suppression de la feuille de suivi" },
      signature_sheet: { title: "Supprimer la feuille de signature", sr: "Confirmer la suppression de la feuille de signature" },
      intercalaire: { title: "Supprimer l'intercalaire", sr: "Confirmer la suppression de l'intercalaire" },
    }
    return labels[deleteItem.kind]
  }, [deleteItem])

  if (chapterLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    )
  }

  if (!chapter) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <p>Chapitre introuvable</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" {...dragProps}>
      {/* Header */}
      <div className="flex items-center gap-2 p-2 border-b border-border">
        <span className="text-sm text-muted-foreground truncate flex-1 min-w-0 ml-2">
          {chapter.description || chapter.label}
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setPrintPreview({ type: "all" })} aria-label="Tout imprimer">
              <Printer className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Tout imprimer</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setEditChapterOpen(true)} aria-label="Édition">
              <Pencil className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Édition</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setCreateOpen(true)} aria-label="Nouveau">
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Nouveau</TooltipContent>
        </Tooltip>
      </div>

      {/* Corps */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col">
       <div className="mx-auto flex-1 flex flex-col w-full">

        {/* Zone de drop — prend tout l'espace restant */}
        <div className="relative flex-1 rounded-lg flex flex-col">
          {isDragOver && <DropOverlay />}

          {loading || tsLoading || ssLoading || gpLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          ) : localItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 h-full text-center text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-50" />
              <p className="font-medium">Aucun élément</p>
              <p className="text-sm mt-1">Cliquez sur Nouveau pour en créer un</p>
            </div>
          ) : (
            <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {localItems.map((item) =>
                  item.kind === "document" ? (
                    <DocumentCard
                      key={`doc-${item.data.id}`}
                      doc={item.data}
                      chapterId={chapterId!}
                      classeurId={classeurId}
                      chapterName={chapter?.label}
                      classeurName={classeurName}
                      establishment={establishment}
                      onExport={handleExport}
                      onEdit={handleDocEditClick}
                      onDelete={(e, d) => handleDeleteClick(e, d, "document")}
                    />
                  ) : item.kind === "tracking_sheet" ? (
                    <TrackingSheetCard
                      key={`sheet-${item.data.id}`}
                      sheet={item.data}
                      chapterId={chapterId!}
                      classeurId={classeurId}
                      chapterName={chapter?.label}
                      classeurName={classeurName}
                      establishment={establishment}
                      periodicite={periodicites.find((p) => p.id === (item.data as TrackingSheet).periodicite_id)}
                      onExport={handleTsExport}
                      onEdit={handleTsEditClick}
                      onDelete={(e, s) => handleDeleteClick(e, s, "tracking_sheet")}
                    />
                  ) : item.kind === "signature_sheet" ? (
                    <SignatureSheetCard
                      key={`sig-${item.data.id}`}
                      sheet={item.data as SignatureSheet}
                      chapterId={chapterId!}
                      classeurId={classeurId}
                      chapterName={chapter?.label}
                      classeurName={classeurName}
                      establishment={establishment}
                      onExport={handleSsExport}
                      onEdit={handleSsEditClick}
                      onDelete={(e, s) => handleDeleteClick(e, s, "signature_sheet")}
                    />
                  ) : (
                    <IntercalaireCard
                      key={`int-${item.data.id}`}
                      page={item.data as Intercalaire}
                      chapterId={chapterId!}
                      classeurId={classeurId}
                      chapterName={chapter?.label}
                      classeurName={classeurName}
                      establishment={establishment}
                      onExport={handleGpExport}
                      onEdit={handleGpEditClick}
                      onDelete={(e, p) => handleDeleteClick(e, p, "intercalaire")}
                    />
                  )
                )}
              </div>
            </SortableContext>
          )}
        </div>
       </div>
      </div>

      {/* Aperçu avant impression */}
      <PrintPreview open={printPreview !== null} onOpenChange={(open) => { if (!open) setPrintPreview(null) }} filename={chapter?.label || "chapitre"}>
        {printPreview?.type === "document" && (
          <DocumentPages
            title={printPreview.doc.title || "Sans titre"}
            subtitle={printPreview.doc.description ?? ""}
            content={printPreview.doc.content}
            chapterName={chapter?.label}
            classeurName={classeurName}
            establishment={establishment}
          />
        )}
        {printPreview?.type === "tracking_sheet" && (
          <TrackingSheetPage
            title={printPreview.sheet.title || "Sans titre"}
            periodiciteLabel={printPreview.periodiciteLabel}
            nombre={printPreview.nombre}
            chapterName={chapter?.label}
            classeurName={classeurName}
            establishment={establishment}
          />
        )}
        {printPreview?.type === "signature_sheet" && (
          <SignatureSheetPage
            title={printPreview.sheet.title || "Sans titre"}
            subtitle={printPreview.sheet.description ?? ""}
            nombre={printPreview.sheet.nombre}
            chapterName={chapter?.label}
            classeurName={classeurName}
            establishment={establishment}
          />
        )}
        {printPreview?.type === "intercalaire" && (
          <IntercalaireSheet
            title={printPreview.page.title || "Sans titre"}
            description={printPreview.page.description ?? ""}
            chapterName={chapter?.label}
            classeurName={classeurName}
            establishment={establishment}
          />
        )}
        {printPreview?.type === "all" && (
          <CoverPage
            chapterLabel={chapter?.label ?? ""}
            chapterDescription={chapter?.description}
            chapterIcon={chapter?.icon}
            classeurName={classeurName}
          />
        )}
        {printPreview?.type === "all" && localItems.map((item) =>
          item.kind === "document" ? (
            <DocumentPages
              key={`doc-${item.data.id}`}
              title={item.data.title || "Sans titre"}
              subtitle={(item.data as Doc).description ?? ""}
              content={(item.data as Doc).content}
              chapterName={chapter?.label}
              classeurName={classeurName}
              establishment={establishment}
            />
          ) : item.kind === "tracking_sheet" ? (
            <TrackingSheetPage
              key={`sheet-${item.data.id}`}
              title={item.data.title || "Sans titre"}
              periodiciteLabel={periodicites.find((p) => p.id === (item.data as TrackingSheet).periodicite_id)?.label ?? ""}
              nombre={periodicites.find((p) => p.id === (item.data as TrackingSheet).periodicite_id)?.nombre ?? 8}
              chapterName={chapter?.label}
              classeurName={classeurName}
              establishment={establishment}
            />
          ) : item.kind === "signature_sheet" ? (
            <SignatureSheetPage
              key={`sig-${item.data.id}`}
              title={item.data.title || "Sans titre"}
              subtitle={(item.data as SignatureSheet).description ?? ""}
              nombre={(item.data as SignatureSheet).nombre}
              chapterName={chapter?.label}
              classeurName={classeurName}
              establishment={establishment}
            />
          ) : (
            <IntercalaireSheet
              key={`int-${item.data.id}`}
              title={item.data.title || "Sans titre"}
              description={(item.data as Intercalaire).description ?? ""}
              chapterName={chapter?.label}
              classeurName={classeurName}
              establishment={establishment}
            />
          )
        )}
      </PrintPreview>

      <CreateItemDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreateDocument={handleCreate}
        onCreateTrackingSheet={handleCreateTrackingSheet}
        onCreateSignatureSheet={handleCreateSignatureSheet}
        onCreateIntercalaire={handleCreateIntercalaire}
      />

      {/* Dialog d'édition document — générique */}
      <EditItemDialog
        open={editDoc !== null}
        dialogTitle="Modifier le document"
        srDescription="Modifier le titre et la description du document"
        fields={[
          { key: "title", label: "Titre", placeholder: "Titre du document", initialValue: editDoc?.title ?? "" },
          { key: "description", label: "Description", placeholder: "Description (optionnel)", initialValue: editDoc?.description ?? "" },
        ]}
        onClose={() => setEditDoc(null)}
        onSave={handleDocEditSave}
      />

      {/* Dialog suppression générique */}
      <DeleteItemDialog
        item={deleteItem?.item ?? null}
        dialogTitle={deleteDialogConfig.title}
        srDescription={deleteDialogConfig.sr}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDeleteConfirm}
      />

      <EditTrackingSheetDialog
        sheet={editSheet}
        onClose={() => setEditSheet(null)}
        onSave={handleTsEditSave}
      />

      {/* Dialog d'édition feuille de signature — générique */}
      <EditItemDialog
        open={editSigSheet !== null}
        dialogTitle="Modifier la feuille de signature"
        srDescription="Modifier le titre de la feuille de signature"
        fields={[
          { key: "title", label: "Titre", placeholder: "Titre de la feuille de signature", initialValue: editSigSheet?.title ?? "" },
          { key: "description", label: "Description", placeholder: "Description (optionnel)", initialValue: editSigSheet?.description ?? "" },
        ]}
        onClose={() => setEditSigSheet(null)}
        onSave={handleSsEditSave}
      />

      {/* Dialog d'édition intercalaire — générique */}
      <EditItemDialog
        open={editIntercalaire !== null}
        dialogTitle="Modifier l'intercalaire"
        srDescription="Modifier le titre et la description de l'intercalaire"
        fields={[
          { key: "title", label: "Titre", placeholder: "Titre de l'intercalaire", initialValue: editIntercalaire?.title ?? "" },
          { key: "description", label: "Description", placeholder: "Description (optionnel)", initialValue: editIntercalaire?.description ?? "" },
        ]}
        onClose={() => setEditIntercalaire(null)}
        onSave={handleGpEditSave}
      />

      <EditChapterDialog
        open={editChapterOpen}
        onOpenChange={setEditChapterOpen}
        chapter={chapter}
        onSave={handleChapterSave}
        onDelete={handleChapterDelete}
      />
    </div>
  )
}
