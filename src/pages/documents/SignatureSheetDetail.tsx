import { useState, useEffect, useMemo, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "@/lib/hooks/useQuery"
import { useMutation } from "@/lib/hooks/useMutation"
import type { ChapterRow, ClasseurRow } from "@/lib/navigation"
import { DEFAULT_REGISTRY_NAME, buildEstablishment } from "@/lib/navigation"
import { PrintPreview } from "@/components/print/PrintPreview"
import { SignatureSheetPage } from "@/components/print/SignatureSheetPage"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Eye, FileDown, Pencil, Save } from "lucide-react"
import { Input } from "@/components/ui/input"

interface SignatureSheet {
  id: number
  title: string
  chapter_id: string
  nombre: number
  sort_order: number
  created_at: string
  updated_at: string
}

// Taille native de la page A4 en px
const PAGE_W_PX = 210 * 3.7795
const PAGE_H_PX = 297 * 3.7795

export default function SignatureSheetDetail() {
  const { id, chapterId, classeurId } = useParams<{ id: string; chapterId: string; classeurId: string }>()
  const navigate = useNavigate()
  const [previewOpen, setPreviewOpen] = useState(false)

  const backPath = classeurId && chapterId
    ? `/classeurs/${classeurId}/chapitres/${chapterId}`
    : chapterId ? `/chapitres/${chapterId}` : "/"

  const filters = useMemo(() => ({ id: Number(id) }), [id])
  const { data: sheets, loading, refetch } = useQuery<SignatureSheet>("signature_sheets", filters)
  const sheet = sheets[0] ?? null

  const classeurFilters = useMemo(() => ({ id: Number(classeurId) }), [classeurId])
  const { data: classeurRows } = useQuery<ClasseurRow>("classeurs", classeurFilters)
  const classeurObj = classeurRows[0] ?? null
  const classeurName = classeurObj?.name ?? DEFAULT_REGISTRY_NAME
  const establishment = buildEstablishment(classeurObj)

  const chapterFilters = useMemo(() => ({ id: Number(chapterId) }), [chapterId])
  const { data: chapterRows } = useQuery<ChapterRow>("chapters", chapterFilters)
  const chapter = chapterRows[0] ?? null

  const { update } = useMutation("signature_sheets")
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState("")

  const [scale, setScale] = useState(1)

  useEffect(() => {
    if (sheet) {
      setEditTitle(sheet.title) // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [sheet?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ref callback pour attacher le ResizeObserver directement
  const containerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const compute = () => {
      const rect = node.getBoundingClientRect()
      const pad = 32
      const sx = (rect.width - pad) / PAGE_W_PX
      const sy = (rect.height - pad) / PAGE_H_PX
      setScale(Math.min(sx, sy))
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(node)
  }, [])

  const handleSave = async () => {
    if (!id) return
    await update(id, {
      title: editTitle.trim() || "Sans titre",
      updated_at: new Date().toISOString(),
    })
    refetch()
    setEditing(false)
  }

  const handleStartEdit = () => {
    if (sheet) {
      setEditTitle(sheet.title)
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

  if (!sheet) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <p>Feuille de signature introuvable</p>
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
            className="h-9 text-lg font-semibold flex-1 min-w-0"
            placeholder="Titre de la feuille"
          />
        ) : (
          <h1 className="text-lg font-semibold flex-1 truncate">
            {sheet.title || "Sans titre"}
          </h1>
        )}

        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => {
                  setEditing(false)
                  setEditTitle(sheet.title)
                }}
                aria-label="Annuler"
                title="Annuler"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button size="icon" className="h-9 w-9" onClick={handleSave} aria-label="Sauvegarder" title="Sauvegarder">
                <Save className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleStartEdit} aria-label="Modifier" title="Modifier">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setPreviewOpen(true)} aria-label="Exporter PDF" title="Exporter PDF">
                <FileDown className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Corps — la page A4 originale, scalée via transform pour remplir l'espace */}
      <div
        ref={containerCallbackRef}
        className="flex-1 overflow-hidden bg-muted/30"
        style={{ position: "relative" }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          <SignatureSheetPage
            title={editing ? (editTitle || "Sans titre") : (sheet.title || "Sans titre")}
            nombre={sheet.nombre}
            chapterName={chapter?.label}
            classeurName={classeurName}
            establishment={establishment}
            themed
          />
        </div>
      </div>

      {/* Aperçu avant impression */}
      <PrintPreview open={previewOpen} onOpenChange={setPreviewOpen}>
        <SignatureSheetPage
          title={sheet.title || "Sans titre"}
          nombre={sheet.nombre}
          chapterName={chapter?.label}
          classeurName={classeurName}
          establishment={establishment}
        />
      </PrintPreview>
    </div>
  )
}
