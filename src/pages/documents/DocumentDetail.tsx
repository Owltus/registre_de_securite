import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useQuery } from "@/lib/hooks/useQuery"
import { useMutation } from "@/lib/hooks/useMutation"
import { exportToPdf } from "@/lib/export-pdf"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Pencil, Eye, FileDown, Save } from "lucide-react"

interface Doc {
  id: number
  title: string
  content: string
  chapter_id: string
  created_at: string
  updated_at: string
}

export default function DocumentDetail() {
  const { id, chapterId } = useParams<{ id: string; chapterId: string }>()
  const navigate = useNavigate()
  const { update } = useMutation("documents")
  const proseRef = useRef<HTMLDivElement>(null)
  const previewScrollRef = useRef<HTMLDivElement>(null)
  const editorScrollRef = useRef<HTMLTextAreaElement>(null)
  const isSyncing = useRef(false)

  const backPath = chapterId ? `/chapitres/${chapterId}` : "/"

  const filters = useMemo(() => ({ id: Number(id) }), [id])
  const { data: docs, loading, refetch } = useQuery<Doc>("documents", filters)
  const doc = docs[0] ?? null

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")

  // Synchroniser le state local quand le document est chargé
  useEffect(() => {
    if (doc) {
      setEditTitle(doc.title)  
      setEditContent(doc.content)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id])

  const handleSave = async () => {
    if (!id) return
    await update(id, {
      title: editTitle.trim() || "Sans titre",
      content: editContent,
      updated_at: new Date().toISOString(),
    })
    refetch()
    setEditing(false)
  }

  const handleExport = () => {
    const html = proseRef.current?.innerHTML
    if (!html) return
    exportToPdf(editTitle || "Sans titre", html)
  }

  // Synchronisation du scroll par mapping bloc-à-bloc
  const syncScroll = useCallback((source: "preview" | "editor") => {
    if (isSyncing.current) return
    isSyncing.current = true

    const previewEl = previewScrollRef.current
    const editorEl = editorScrollRef.current
    if (!previewEl || !editorEl) {
      isSyncing.current = false
      return
    }

    const proseEl = previewEl.querySelector(".prose") as HTMLElement | null
    const previewBlocks = proseEl
      ? (Array.from(proseEl.children) as HTMLElement[])
      : []

    const sourceBlocks = editContent.split(/\n\n+/)
    const blockCount = Math.min(previewBlocks.length, sourceBlocks.length)

    if (blockCount < 2) {
      const from = source === "preview" ? previewEl : editorEl
      const to = source === "preview" ? editorEl : previewEl
      const fromMax = from.scrollHeight - from.clientHeight
      const toMax = to.scrollHeight - to.clientHeight
      if (fromMax > 0 && toMax > 0) {
        to.scrollTop = (from.scrollTop / fromMax) * toMax
      }
      requestAnimationFrame(() => { isSyncing.current = false })
      return
    }

    const editorStyle = getComputedStyle(editorEl)
    let lineHeight = parseFloat(editorStyle.lineHeight)
    if (isNaN(lineHeight)) lineHeight = parseFloat(editorStyle.fontSize) * 1.5
    if (isNaN(lineHeight)) lineHeight = 20

    const editorAnchors: number[] = [0]
    let cumLines = 0
    for (let i = 0; i < blockCount - 1; i++) {
      cumLines += sourceBlocks[i].split("\n").length + 1
      editorAnchors.push(cumLines * lineHeight)
    }
    editorAnchors.push(editorEl.scrollHeight)

    const containerRect = previewEl.getBoundingClientRect()
    const previewAnchors: number[] = []
    for (let i = 0; i < blockCount; i++) {
      const rect = previewBlocks[i].getBoundingClientRect()
      previewAnchors.push(rect.top - containerRect.top + previewEl.scrollTop)
    }
    previewAnchors.push(previewEl.scrollHeight)

    const fromAnchors = source === "editor" ? editorAnchors : previewAnchors
    const toAnchors = source === "editor" ? previewAnchors : editorAnchors
    const fromEl = source === "editor" ? editorEl : previewEl
    const toEl = source === "editor" ? previewEl : editorEl

    const scrollPos = fromEl.scrollTop

    let idx = 0
    for (let i = 0; i < fromAnchors.length - 1; i++) {
      if (fromAnchors[i + 1] <= scrollPos) idx = i + 1
      else break
    }

    const fromStart = fromAnchors[idx]
    const fromEnd = fromAnchors[idx + 1] ?? fromAnchors[idx]
    const toStart = toAnchors[idx]
    const toEnd = toAnchors[idx + 1] ?? toAnchors[idx]

    const t = fromEnd > fromStart ? (scrollPos - fromStart) / (fromEnd - fromStart) : 0
    const targetScroll = toStart + t * (toEnd - toStart)

    toEl.scrollTop = Math.max(0, Math.min(targetScroll, toEl.scrollHeight - toEl.clientHeight))

    requestAnimationFrame(() => { isSyncing.current = false })
  }, [editContent])

  const handleStartEdit = () => {
    if (doc) {
      setEditTitle(doc.title)
      setEditContent(doc.content)
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
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => navigate(backPath)}
          aria-label="Retour"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {editing ? (
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="h-9 text-lg font-semibold flex-1"
            placeholder="Titre du document"
          />
        ) : (
          <h1 className="text-lg font-semibold flex-1 truncate">
            {doc.title || "Sans titre"}
          </h1>
        )}

        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(false)
                  setEditTitle(doc.title)
                  setEditContent(doc.content)
                }}
              >
                <Eye className="h-4 w-4 mr-1.5" />
                Aperçu
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-1.5" />
                Sauvegarder
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={handleStartEdit}>
                <Pencil className="h-4 w-4 mr-1.5" />
                Édition
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <FileDown className="h-4 w-4 mr-1.5" />
                Exporter PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Corps */}
      {editing ? (
        // Mode édition — Split view
        <div className="flex flex-1 min-h-0">
          {/* Aperçu temps réel (gauche) */}
          <div
            ref={previewScrollRef}
            onScroll={() => syncScroll("preview")}
            className="w-1/2 overflow-y-auto p-6 border-r border-border"
          >
            <div className="prose max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {editContent}
              </ReactMarkdown>
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
        // Mode aperçu
        <div className="flex-1 overflow-y-auto p-6">
          <div ref={proseRef} className="prose max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {editContent}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
