import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { useDetailPage } from "@/lib/hooks/useDetailPage"
import { usePageScale } from "@/lib/hooks/usePageScale"
import { PrintPreview } from "@/components/print/PrintPreview"
import { DocumentPages } from "@/components/print/DocumentPages"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { ArrowLeft, Pencil, Eye, FileDown, FileOutput, Save } from "lucide-react"
import { exportMarkdown } from "@/lib/exportMarkdown"

interface Doc {
  id: number
  title: string
  description: string
  content: string
  chapter_id: string
  created_at: string
  updated_at: string
}

export default function DocumentDetail() {
  const {
    id, navigate, backPath, item: doc, loading, refetch,
    classeurName, establishment, chapter, update,
  } = useDetailPage<Doc>("documents")

  const [searchParams] = useSearchParams()
  const [previewOpen, setPreviewOpen] = useState(false)
  const previewScrollRef = useRef<HTMLDivElement>(null)
  const editorScrollRef = useRef<HTMLTextAreaElement>(null)
  const isSyncing = useRef(false)

  // Scale pour l'aperçu A4 (mode width pour les pages scrollables)
  const { containerRef: previewRefCallback, scale } = usePageScale("width")

  const [editing, setEditing] = useState(searchParams.get("edit") === "1")
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editContent, setEditContent] = useState("")

  // Contenu debounced pour l'aperçu A4 (évite des re-paginations à chaque frappe)
  const [debouncedContent, setDebouncedContent] = useState("")

  // Synchroniser le state local quand le document est chargé
  useEffect(() => {
    if (doc) {
      setEditTitle(doc.title)
      setEditDescription(doc.description ?? "")
      setEditContent(doc.content)
      setDebouncedContent(doc.content)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id])

  // Debounce du contenu (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedContent(editContent), 300)
    return () => clearTimeout(timer)
  }, [editContent])

  // Ref combiné pour le scroll synchronisé ET le ResizeObserver
  const combinedPreviewRef = useCallback((node: HTMLDivElement | null) => {
    previewScrollRef.current = node
    previewRefCallback(node)
  }, [previewRefCallback])

  const handleSave = async () => {
    if (!id) return
    try {
      await update(id, {
        title: editTitle.trim() || "Sans titre",
        description: editDescription.trim(),
        content: editContent,
        updated_at: new Date().toISOString(),
      })
      refetch()
      setEditing(false)
      toast.success("Document enregistré")
    } catch {
      toast.error("Erreur lors de la sauvegarde")
    }
  }

  const handleExport = () => {
    setPreviewOpen(true)
  }

  // Synchronisation du scroll proportionnel (ratio)
  const syncScroll = useCallback((source: "preview" | "editor") => {
    if (isSyncing.current) return
    isSyncing.current = true

    const previewEl = previewScrollRef.current
    const editorEl = editorScrollRef.current
    if (!previewEl || !editorEl) {
      isSyncing.current = false
      return
    }

    const fromEl = source === "preview" ? previewEl : editorEl
    const toEl = source === "preview" ? editorEl : previewEl
    const fromMax = fromEl.scrollHeight - fromEl.clientHeight
    const toMax = toEl.scrollHeight - toEl.clientHeight
    if (fromMax > 0 && toMax > 0) {
      const ratio = fromEl.scrollTop / fromMax
      toEl.scrollTop = ratio * toMax
    }

    requestAnimationFrame(() => { isSyncing.current = false })
  }, [])

  const handleStartEdit = () => {
    if (doc) {
      setEditTitle(doc.title)
      setEditDescription(doc.description ?? "")
      setEditContent(doc.content)
      setDebouncedContent(doc.content)
    }
    setEditing(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <p>Document introuvable</p>
        <Button variant="outline" size="sm" onClick={() => navigate(backPath)}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Retour
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-2 border-b border-border">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => navigate(backPath)}
              aria-label="Retour"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Retour</TooltipContent>
        </Tooltip>

        {editing ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="h-9 text-lg font-semibold flex-1"
              placeholder="Titre du document"
            />
            <Input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="h-9 w-[200px]"
              placeholder="Description"
            />
          </div>
        ) : (
          <h1 className="text-lg font-semibold flex-1 truncate">
            {doc.title || "Sans titre"}
          </h1>
        )}

        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => {
                      setEditing(false)
                      setEditTitle(doc.title)
                      setEditDescription(doc.description ?? "")
                      setEditContent(doc.content)
                    }}
                    aria-label="Aperçu"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Aperçu</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" className="h-9 w-9" onClick={handleSave} aria-label="Sauvegarder">
                    <Save className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sauvegarder</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleStartEdit} aria-label="Édition">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Édition</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleExport} aria-label="Exporter PDF">
                    <FileDown className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Exporter PDF</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => exportMarkdown(editTitle, editContent)} aria-label="Exporter Markdown">
                    <FileOutput className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Exporter Markdown</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      {/* Corps */}
      {editing ? (
        // Mode édition — Split view avec aperçu A4 paginé
        <div className="flex flex-1 min-h-0">
          {/* Aperçu A4 temps réel (gauche) */}
          <div
            ref={combinedPreviewRef}
            onScroll={() => syncScroll("preview")}
            className="w-1/2 overflow-y-auto border-r border-border bg-muted/30"
          >
            <div className="flex flex-col items-center gap-4 py-4" style={{ zoom: scale }}>
              <DocumentPages
                title={editTitle || "Sans titre"}
                subtitle={editDescription}
                content={debouncedContent}
                chapterName={chapter?.label}
                classeurName={classeurName}
                establishment={establishment}
                themed
              />
            </div>
          </div>

          {/* Éditeur brut (droite) */}
          <div className="w-1/2 flex flex-col p-4">
            <Textarea
              ref={editorScrollRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onScroll={() => syncScroll("editor")}
              placeholder="Écrivez en Markdown…"
              className="flex-1 min-h-0 font-mono text-sm resize-none"
            />
          </div>
        </div>
      ) : (
        // Mode aperçu — pages A4 empilées
        <div
          ref={previewRefCallback}
          className="flex-1 overflow-y-auto bg-muted/30"
        >
          <div className="flex flex-col items-center gap-4 py-4" style={{ zoom: scale }}>
            <DocumentPages
              title={editTitle || "Sans titre"}
              subtitle={editDescription}
              content={editContent}
              chapterName={chapter?.label}
              classeurName={classeurName}
              establishment={establishment}
              themed
            />
          </div>
        </div>
      )}

      {/* Aperçu avant impression */}
      <PrintPreview open={previewOpen} onOpenChange={setPreviewOpen} filename={doc?.title || "document"}>
        <DocumentPages
          title={editTitle || "Sans titre"}
          subtitle={editDescription}
          content={editContent}
          chapterName={chapter?.label}
          classeurName={classeurName}
          establishment={establishment}
        />
      </PrintPreview>
    </div>
  )
}
