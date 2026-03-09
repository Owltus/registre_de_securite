import { useState, useEffect, useMemo, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "@/lib/hooks/useQuery"
import { useMutation } from "@/lib/hooks/useMutation"
import type { ChapterRow, ClasseurRow } from "@/lib/navigation"
import { DEFAULT_REGISTRY_NAME, buildEstablishment } from "@/lib/navigation"
import { PrintPreview } from "@/components/print/PrintPreview"
import { IntercalaireSheet } from "@/components/print/IntercalaireSheet"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { ArrowLeft, Eye, FileDown, Pencil, Save } from "lucide-react"
import { Input } from "@/components/ui/input"

interface Intercalaire {
  id: number
  title: string
  description: string
  chapter_id: string
  sort_order: number
  created_at: string
  updated_at: string
}

// Taille native de la page A4 en px
const PAGE_W_PX = 210 * 3.7795
const PAGE_H_PX = 297 * 3.7795

export default function IntercalaireDetail() {
  const { id, chapterId, classeurId } = useParams<{ id: string; chapterId: string; classeurId: string }>()
  const navigate = useNavigate()
  const [previewOpen, setPreviewOpen] = useState(false)

  const backPath = classeurId && chapterId
    ? `/classeurs/${classeurId}/chapitres/${chapterId}`
    : chapterId ? `/chapitres/${chapterId}` : "/"

  const filters = useMemo(() => ({ id: Number(id) }), [id])
  const { data: pages, loading, refetch } = useQuery<Intercalaire>("intercalaires", filters)
  const page = pages[0] ?? null

  const classeurFilters = useMemo(() => ({ id: Number(classeurId) }), [classeurId])
  const { data: classeurRows } = useQuery<ClasseurRow>("classeurs", classeurFilters)
  const classeurObj = classeurRows[0] ?? null
  const classeurName = classeurObj?.name ?? DEFAULT_REGISTRY_NAME
  const establishment = buildEstablishment(classeurObj)

  const chapterFilters = useMemo(() => ({ id: Number(chapterId) }), [chapterId])
  const { data: chapterRows } = useQuery<ChapterRow>("chapters", chapterFilters)
  const chapter = chapterRows[0] ?? null

  const { update } = useMutation("intercalaires")
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")

  const [scale, setScale] = useState(1)

  useEffect(() => {
    if (page) {
      setEditTitle(page.title) // eslint-disable-line react-hooks/set-state-in-effect
      setEditDescription(page.description ?? "")
    }
  }, [page?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
      description: editDescription.trim(),
      updated_at: new Date().toISOString(),
    })
    refetch()
    setEditing(false)
  }

  const handleStartEdit = () => {
    if (page) {
      setEditTitle(page.title)
      setEditDescription(page.description ?? "")
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

  if (!page) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <p>Intercalaire introuvable</p>
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
              placeholder="Titre de l'intercalaire"
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
            {page.title || "Sans titre"}
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
                      setEditTitle(page.title)
                      setEditDescription(page.description ?? "")
                    }}
                    aria-label="Annuler"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Annuler</TooltipContent>
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
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleStartEdit} aria-label="Modifier">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Modifier</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setPreviewOpen(true)} aria-label="Exporter PDF">
                    <FileDown className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Exporter PDF</TooltipContent>
              </Tooltip>
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
          <IntercalaireSheet
            title={editing ? (editTitle || "Sans titre") : (page.title || "Sans titre")}
            description={editing ? editDescription : (page.description ?? "")}
            chapterName={chapter?.label}
            classeurName={classeurName}
            establishment={establishment}
            themed
          />
        </div>
      </div>

      {/* Aperçu avant impression */}
      <PrintPreview open={previewOpen} onOpenChange={setPreviewOpen}>
        <IntercalaireSheet
          title={page.title || "Sans titre"}
          description={page.description ?? ""}
          chapterName={chapter?.label}
          classeurName={classeurName}
          establishment={establishment}
        />
      </PrintPreview>
    </div>
  )
}
