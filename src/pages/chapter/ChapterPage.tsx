import { useState, useCallback, useMemo, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import type { DragEndEvent } from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { useQuery } from "@/lib/hooks/useQuery"
import { useMutation } from "@/lib/hooks/useMutation"
import type { ChapterRow } from "@/lib/navigation"
import { getChapterIcon } from "@/lib/navigation"
import { useDndRegistry, type DocumentDragData, type TrackingSheetDragData, type SignatureSheetDragData } from "@/lib/dnd/useDndRegistry"
import { PrintPreview } from "@/components/print/PrintPreview"
import { DocumentPages } from "@/components/print/DocumentPages"
import { TrackingSheetPage } from "@/components/print/TrackingSheetPage"
import { SignatureSheetPage } from "@/components/print/SignatureSheetPage"
import { Button } from "@/components/ui/button"
import { Plus, FileText, Pencil, Printer } from "lucide-react"
import type { Doc, TrackingSheet, SignatureSheet, Periodicite, ChapterItem } from "./types"
import { DocumentCard } from "./DocumentCard"
import { TrackingSheetCard } from "./TrackingSheetCard"
import { CreateItemDialog } from "./CreateItemDialog"
import { DeleteDocumentDialog } from "./DeleteDocumentDialog"
import { DeleteTrackingSheetDialog } from "./DeleteTrackingSheetDialog"
import { EditTrackingSheetDialog } from "./EditTrackingSheetDialog"
import { SignatureSheetCard } from "./SignatureSheetCard"
import { EditSignatureSheetDialog } from "./EditSignatureSheetDialog"
import { DeleteSignatureSheetDialog } from "./DeleteSignatureSheetDialog"
import { EditChapterDialog } from "./EditChapterDialog"
import { useDropZone, DropOverlay } from "./DropZone"
import { emit, CHAPTERS_CHANGED } from "@/lib/events"

export default function ChapterPage() {
  const { chapterId } = useParams<{ chapterId: string }>()
  const navigate = useNavigate()

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

  // Liste unifiée triée par sort_order
  const allItems: ChapterItem[] = useMemo(() => {
    const items: ChapterItem[] = [
      ...docs.map(d => ({ kind: "document" as const, data: d })),
      ...trackingSheets.map(s => ({ kind: "tracking_sheet" as const, data: s })),
      ...signatureSheets.map(s => ({ kind: "signature_sheet" as const, data: s })),
    ]
    return items.sort((a, b) => a.data.sort_order - b.data.sort_order)
  }, [docs, trackingSheets, signatureSheets])

  // État local optimiste pour le réordonnancement
  const [localItems, setLocalItems] = useState<ChapterItem[]>([])
  useEffect(() => { setLocalItems(allItems) }, [allItems])

  // IDs pour le SortableContext (préfixés selon le type)
  const sortableIds = useMemo(
    () => localItems.map((item) =>
      item.kind === "document" ? `document-${item.data.id}` : item.kind === "tracking_sheet" ? `sheet-${item.data.id}` : `sig-${item.data.id}`
    ),
    [localItems]
  )

  const [createOpen, setCreateOpen] = useState(false)
  const [editChapterOpen, setEditChapterOpen] = useState(false)
  const [deleteDoc, setDeleteDoc] = useState<Doc | null>(null)

  // Aperçu avant impression
  type PrintPreviewState =
    | { type: "document"; doc: Doc }
    | { type: "tracking_sheet"; sheet: TrackingSheet; periodiciteLabel: string; nombre: number }
    | { type: "signature_sheet"; sheet: SignatureSheet }
    | { type: "all" }
    | null
  const [printPreview, setPrintPreview] = useState<PrintPreviewState>(null)

  // États feuilles de suivi
  const [editSheet, setEditSheet] = useState<TrackingSheet | null>(null)
  const [deleteSheet, setDeleteSheet] = useState<TrackingSheet | null>(null)

  // États feuilles de signature
  const [editSigSheet, setEditSigSheet] = useState<SignatureSheet | null>(null)
  const [deleteSigSheet, setDeleteSigSheet] = useState<SignatureSheet | null>(null)

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

      const data = active.data.current as (DocumentDragData | TrackingSheetDragData | SignatureSheetDragData) | undefined
      if (!data) return

      const overData = over.data.current as { type?: string; chapterId?: string } | undefined

      // Cas 1 : drop sur un chapitre de la sidebar → déplacer l'item
      if (overData?.type === "chapter") {
        const targetChapterId = overData.chapterId ?? String(over.id)
        const sourceChapterId = data.type === "document" ? data.sourceChapterId : data.sourceChapterId
        if (targetChapterId === sourceChapterId) return

        if (data.type === "document") {
          await updateDoc(String(data.docId), { chapter_id: targetChapterId })
          refetch()
        } else if (data.type === "tracking_sheet") {
          await updateTs(String(data.sheetId), { chapter_id: targetChapterId })
          tsRefetch()
        } else {
          await updateSs(String(data.sheetId), { chapter_id: targetChapterId })
          ssRefetch()
        }
        return
      }

      // Cas 2 : drop sur un autre item → réordonner
      const overType = overData?.type
      if (overType === "document" || overType === "tracking_sheet" || overType === "signature_sheet") {
        const activeId = String(active.id)
        const overId = String(over.id)
        const itemSortId = (item: ChapterItem) =>
          item.kind === "document" ? `document-${item.data.id}` : item.kind === "tracking_sheet" ? `sheet-${item.data.id}` : `sig-${item.data.id}`
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
            } else {
              return updateSs(String(item.data.id), { sort_order: i + 1 })
            }
          })
        )
        refetch()
        tsRefetch()
        ssRefetch()
      }
    },
    [localItems, updateDoc, updateTs, updateSs, refetch, tsRefetch, ssRefetch]
  )

  useEffect(() => {
    dndRegistry.registerHandler("document", handleItemDrop)
    dndRegistry.registerHandler("tracking_sheet", handleItemDrop)
    dndRegistry.registerHandler("signature_sheet", handleItemDrop)
    return () => {
      dndRegistry.unregisterHandler("document")
      dndRegistry.unregisterHandler("tracking_sheet")
      dndRegistry.unregisterHandler("signature_sheet")
    }
  }, [dndRegistry, handleItemDrop])

  // Export PDF — ouvre l'aperçu avant impression
  const handleExport = useCallback((e: React.MouseEvent, doc: Doc) => {
    e.stopPropagation()
    setPrintPreview({ type: "document", doc })
  }, [])

  // Création document
  const handleCreate = useCallback(async (title: string) => {
    const nextOrder = localItems.length > 0
      ? Math.max(...localItems.map((item) => item.data.sort_order)) + 1
      : 1
    await insert({ title, content: "", chapter_id: chapterId ?? "", sort_order: nextOrder })
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
  const handleCreateSignatureSheet = useCallback(async (title: string) => {
    const nextOrder = localItems.length > 0
      ? Math.max(...localItems.map((item) => item.data.sort_order)) + 1
      : 1
    await insertSs({ title, chapter_id: chapterId ?? "", nombre: 14, sort_order: nextOrder })
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
    await updateTs(String(id), { title, periodicite_id: periodiciteId })
    tsRefetch()
    setEditSheet(null)
  }, [updateTs, tsRefetch])

  // Suppression feuille de suivi
  const handleTsDeleteClick = useCallback((e: React.MouseEvent, sheet: TrackingSheet) => {
    e.stopPropagation()
    setDeleteSheet(sheet)
  }, [])

  const handleTsDeleteConfirm = useCallback(async () => {
    if (!deleteSheet) return
    await removeTs(String(deleteSheet.id))
    tsRefetch()
    setDeleteSheet(null)
  }, [deleteSheet, removeTs, tsRefetch])

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

  const handleSsEditSave = useCallback(async (id: number, title: string) => {
    await updateSs(String(id), { title })
    ssRefetch()
    setEditSigSheet(null)
  }, [updateSs, ssRefetch])

  // Suppression feuille de signature
  const handleSsDeleteClick = useCallback((e: React.MouseEvent, sheet: SignatureSheet) => {
    e.stopPropagation()
    setDeleteSigSheet(sheet)
  }, [])

  const handleSsDeleteConfirm = useCallback(async () => {
    if (!deleteSigSheet) return
    await removeSs(String(deleteSigSheet.id))
    ssRefetch()
    setDeleteSigSheet(null)
  }, [deleteSigSheet, removeSs, ssRefetch])

  // Édition du chapitre
  const handleChapterSave = useCallback(async (label: string, description: string) => {
    if (!chapterId) return
    await updateChapter(chapterId, { label, description })
    chapterRefetch()
    emit(CHAPTERS_CHANGED)
    setEditChapterOpen(false)
  }, [chapterId, updateChapter, chapterRefetch])

  // Suppression du chapitre
  const handleChapterDelete = useCallback(async () => {
    if (!chapterId) return
    await removeChapter(chapterId)
    emit(CHAPTERS_CHANGED)
    navigate("/")
  }, [chapterId, removeChapter, navigate])

  // Suppression
  const handleDeleteClick = useCallback((e: React.MouseEvent, doc: Doc) => {
    e.stopPropagation()
    setDeleteDoc(doc)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteDoc) return
    await remove(String(deleteDoc.id))
    refetch()
    setDeleteDoc(null)
  }, [deleteDoc, remove, refetch])

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

  const Icon = getChapterIcon(chapter.icon)

  return (
    <div className="flex flex-col h-full" {...dragProps}>
      {/* Header */}
      <div className="flex items-center gap-2 p-2 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground shrink-0">
          <Icon className="h-4 w-4" />
        </div>

        <h1 className="text-sm font-semibold truncate flex-1 min-w-0">
          {chapter.label}
          {chapter.description && (
            <span className="font-normal text-muted-foreground"> — {chapter.description}</span>
          )}
        </h1>

        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setPrintPreview({ type: "all" })} aria-label="Tout imprimer" title="Tout imprimer">
          <Printer className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setEditChapterOpen(true)} aria-label="Édition">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setCreateOpen(true)} aria-label="Nouveau">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Corps */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col">
       <div className="mx-auto flex-1 flex flex-col w-full" style={{ maxWidth: "210mm" }}>

        {/* Zone de drop — prend tout l'espace restant */}
        <div className="relative flex-1 rounded-lg flex flex-col">
          {isDragOver && <DropOverlay />}

          {loading || tsLoading || ssLoading ? (
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
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {localItems.map((item) =>
                  item.kind === "document" ? (
                    <DocumentCard
                      key={`doc-${item.data.id}`}
                      doc={item.data}
                      chapterId={chapterId!}
                      onExport={handleExport}
                      onDelete={handleDeleteClick}
                    />
                  ) : item.kind === "tracking_sheet" ? (
                    <TrackingSheetCard
                      key={`sheet-${item.data.id}`}
                      sheet={item.data}
                      chapterId={chapterId!}
                      periodicite={periodicites.find((p) => p.id === (item.data as TrackingSheet).periodicite_id)}
                      onExport={handleTsExport}
                      onEdit={handleTsEditClick}
                      onDelete={handleTsDeleteClick}
                    />
                  ) : (
                    <SignatureSheetCard
                      key={`sig-${item.data.id}`}
                      sheet={item.data as SignatureSheet}
                      chapterId={chapterId!}
                      onExport={handleSsExport}
                      onEdit={handleSsEditClick}
                      onDelete={handleSsDeleteClick}
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
      <PrintPreview open={printPreview !== null} onOpenChange={(open) => { if (!open) setPrintPreview(null) }}>
        {printPreview?.type === "document" && (
          <DocumentPages
            title={printPreview.doc.title || "Sans titre"}
            content={printPreview.doc.content}
            chapterName={chapter?.label}
          />
        )}
        {printPreview?.type === "tracking_sheet" && (
          <TrackingSheetPage
            title={printPreview.sheet.title || "Sans titre"}
            periodiciteLabel={printPreview.periodiciteLabel}
            nombre={printPreview.nombre}
            chapterName={chapter?.label}
          />
        )}
        {printPreview?.type === "signature_sheet" && (
          <SignatureSheetPage
            title={printPreview.sheet.title || "Sans titre"}
            nombre={printPreview.sheet.nombre}
            chapterName={chapter?.label}
          />
        )}
        {printPreview?.type === "all" && localItems.map((item) =>
          item.kind === "document" ? (
            <DocumentPages
              key={`doc-${item.data.id}`}
              title={item.data.title || "Sans titre"}
              content={item.data.content}
              chapterName={chapter?.label}
            />
          ) : item.kind === "tracking_sheet" ? (
            <TrackingSheetPage
              key={`sheet-${item.data.id}`}
              title={item.data.title || "Sans titre"}
              periodiciteLabel={periodicites.find((p) => p.id === (item.data as TrackingSheet).periodicite_id)?.label ?? ""}
              nombre={periodicites.find((p) => p.id === (item.data as TrackingSheet).periodicite_id)?.nombre ?? 8}
              chapterName={chapter?.label}
            />
          ) : (
            <SignatureSheetPage
              key={`sig-${item.data.id}`}
              title={item.data.title || "Sans titre"}
              nombre={(item.data as SignatureSheet).nombre}
              chapterName={chapter?.label}
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
      />

      <DeleteDocumentDialog
        doc={deleteDoc}
        onClose={() => setDeleteDoc(null)}
        onConfirm={handleDeleteConfirm}
      />

      <EditTrackingSheetDialog
        sheet={editSheet}
        onClose={() => setEditSheet(null)}
        onSave={handleTsEditSave}
      />

      <DeleteTrackingSheetDialog
        sheet={deleteSheet}
        onClose={() => setDeleteSheet(null)}
        onConfirm={handleTsDeleteConfirm}
      />

      <EditSignatureSheetDialog
        sheet={editSigSheet}
        onClose={() => setEditSigSheet(null)}
        onSave={handleSsEditSave}
      />

      <DeleteSignatureSheetDialog
        sheet={deleteSigSheet}
        onClose={() => setDeleteSigSheet(null)}
        onConfirm={handleSsDeleteConfirm}
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
