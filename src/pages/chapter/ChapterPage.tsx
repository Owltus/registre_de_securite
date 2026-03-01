/* eslint-disable react-hooks/static-components */
import { useState, useRef, useCallback, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useQuery } from "@/lib/hooks/useQuery"
import { useMutation } from "@/lib/hooks/useMutation"
import { exportToPdf } from "@/lib/export-pdf"
import type { ChapterRow } from "@/lib/navigation"
import { getChapterIcon } from "@/lib/navigation"
import { Button } from "@/components/ui/button"
import { Plus, FileText, Pencil } from "lucide-react"
import type { Doc } from "./types"
import { DocumentCard } from "./DocumentCard"
import { CreateDocumentDialog } from "./CreateDocumentDialog"
import { DeleteDocumentDialog } from "./DeleteDocumentDialog"
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
  const { insert, remove } = useMutation("documents")
  const { update: updateChapter, remove: removeChapter } = useMutation("chapters")

  const [createOpen, setCreateOpen] = useState(false)
  const [editChapterOpen, setEditChapterOpen] = useState(false)
  const [deleteDoc, setDeleteDoc] = useState<Doc | null>(null)
  const [pdfDoc, setPdfDoc] = useState<Doc | null>(null)
  const pdfRef = useRef<HTMLDivElement>(null)

  // Drag-and-drop
  const handleImport = useCallback(async (files: { title: string; content: string }[]) => {
    for (const { title, content } of files) {
      await insert({ title, content, chapter_id: chapterId ?? "" })
    }
    refetch()
  }, [insert, chapterId, refetch])

  const { isDragOver, dragProps } = useDropZone(handleImport)

  // Export PDF
  const handleExport = useCallback((e: React.MouseEvent, doc: Doc) => {
    e.stopPropagation()
    setPdfDoc(doc)
  }, [])

  const handlePdfRendered = useCallback(() => {
    if (!pdfDoc || !pdfRef.current) return
    const html = pdfRef.current.innerHTML
    exportToPdf(pdfDoc.title || "Sans titre", html)
    setPdfDoc(null)
  }, [pdfDoc])

  // Création
  const handleCreate = useCallback(async (title: string) => {
    await insert({ title, content: "", chapter_id: chapterId ?? "" })
    refetch()
    setCreateOpen(false)
  }, [insert, chapterId, refetch])

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
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground shrink-0">
          <Icon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate leading-tight">
            {chapter.label}
          </h1>
          {chapter.description && (
            <p className="text-xs text-muted-foreground truncate leading-tight">
              {chapter.description}
            </p>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={() => setEditChapterOpen(true)}>
          <Pencil className="h-4 w-4 mr-1.5" />
          Édition
        </Button>
        <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nouveau
        </Button>
      </div>

      {/* Corps */}
      <div className="flex-1 overflow-y-auto p-6">
       <div className="mx-auto" style={{ maxWidth: "210mm" }}>

        {/* Zone de drop — prend tout l'espace restant */}
        <div className="relative flex-1 rounded-lg flex flex-col">
          {isDragOver && <DropOverlay />}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 h-full text-center text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-50" />
              <p className="font-medium">Aucun document</p>
              <p className="text-sm mt-1">Cliquez sur Nouveau pour en créer un</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {docs.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  chapterId={chapterId!}
                  onExport={handleExport}
                  onDelete={handleDeleteClick}
                />
              ))}
            </div>
          )}
        </div>
       </div>
      </div>

      {/* Rendu off-screen pour export PDF */}
      {pdfDoc && (
        <div className="fixed -left-[9999px] top-0" aria-hidden>
          <div ref={(el) => { pdfRef.current = el; if (el) handlePdfRendered() }} className="prose max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{pdfDoc.content}</ReactMarkdown>
          </div>
        </div>
      )}

      <CreateDocumentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
      />

      <DeleteDocumentDialog
        doc={deleteDoc}
        onClose={() => setDeleteDoc(null)}
        onConfirm={handleDeleteConfirm}
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
