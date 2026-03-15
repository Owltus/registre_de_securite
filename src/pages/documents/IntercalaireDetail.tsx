import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useDetailPage } from "@/lib/hooks/useDetailPage"
import { usePageScale } from "@/lib/hooks/usePageScale"
import { PrintPreview } from "@/components/print/PrintPreview"
import { IntercalaireSheet } from "@/components/print/IntercalaireSheet"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { ArrowLeft, Eye, FileDown, Pencil, Save } from "lucide-react"
import { Input } from "@/components/ui/input"
import type { Intercalaire } from "@/pages/chapter/types"

export default function IntercalaireDetail() {
  const {
    id, navigate, backPath, item: page, loading, refetch,
    classeurName, establishment, chapter, update,
  } = useDetailPage<Intercalaire>("intercalaires")

  const [previewOpen, setPreviewOpen] = useState(false)
  const { containerRef, scale } = usePageScale("fit")

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")

  useEffect(() => {
    if (page) {
      setEditTitle(page.title) // eslint-disable-line react-hooks/set-state-in-effect
      setEditDescription(page.description ?? "")
    }
  }, [page?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!id) return
    try {
      await update(id, {
        title: editTitle.trim() || "Sans titre",
        description: editDescription.trim(),
        updated_at: new Date().toISOString(),
      })
      refetch()
      setEditing(false)
      toast.success("Intercalaire enregistré")
    } catch {
      toast.error("Erreur lors de la sauvegarde")
    }
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
      <div className="flex items-center justify-center h-full" role="status" aria-label="Chargement">
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
        ref={containerRef}
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
      <PrintPreview open={previewOpen} onOpenChange={setPreviewOpen} filename={page?.title || "intercalaire"}>
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
