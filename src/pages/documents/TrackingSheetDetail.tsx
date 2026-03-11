import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useDetailPage } from "@/lib/hooks/useDetailPage"
import { usePageScale } from "@/lib/hooks/usePageScale"
import { useQuery } from "@/lib/hooks/useQuery"
import { PrintPreview } from "@/components/print/PrintPreview"
import { TrackingSheetPage } from "@/components/print/TrackingSheetPage"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { ArrowLeft, Eye, FileDown, Pencil, Save } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface TrackingSheet {
  id: number
  title: string
  chapter_id: string
  periodicite_id: number
  sort_order: number
  created_at: string
  updated_at: string
}

interface Periodicite {
  id: number
  label: string
  nombre: number
  sort_order: number
}

export default function TrackingSheetDetail() {
  const {
    id, navigate, backPath, item: sheet, loading, refetch,
    classeurName, establishment, chapter, update,
  } = useDetailPage<TrackingSheet>("tracking_sheets")

  const [previewOpen, setPreviewOpen] = useState(false)
  const { containerRef, scale } = usePageScale("fit")

  const { data: periodicites } = useQuery<Periodicite>("periodicites")
  const periodicite = periodicites.find((p) => p.id === sheet?.periodicite_id)

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editPeriodiciteId, setEditPeriodiciteId] = useState<number>(0)

  useEffect(() => {
    if (sheet) {
      setEditTitle(sheet.title) // eslint-disable-line react-hooks/set-state-in-effect
      setEditPeriodiciteId(sheet.periodicite_id)
    }
  }, [sheet?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!id) return
    try {
      await update(id, {
        title: editTitle.trim() || "Sans titre",
        periodicite_id: editPeriodiciteId,
        updated_at: new Date().toISOString(),
      })
      refetch()
      setEditing(false)
      toast.success("Feuille de suivi enregistrée")
    } catch {
      toast.error("Erreur lors de la sauvegarde")
    }
  }

  const handleStartEdit = () => {
    if (sheet) {
      setEditTitle(sheet.title)
      setEditPeriodiciteId(sheet.periodicite_id)
    }
    setEditing(true)
  }

  const currentPerio = periodicites.find((p) => p.id === (editing ? editPeriodiciteId : sheet?.periodicite_id))

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
        <p>Feuille de suivi introuvable</p>
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
              placeholder="Titre de la feuille"
            />
            <Select
              value={String(editPeriodiciteId)}
              onValueChange={(v) => setEditPeriodiciteId(Number(v))}
            >
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Périodicité" />
              </SelectTrigger>
              <SelectContent>
                {periodicites.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <h1 className="text-lg font-semibold flex-1 truncate">
            {sheet.title || "Sans titre"}
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
                      setEditTitle(sheet.title)
                      setEditPeriodiciteId(sheet.periodicite_id)
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
          <TrackingSheetPage
            title={editing ? (editTitle || "Sans titre") : (sheet.title || "Sans titre")}
            periodiciteLabel={currentPerio?.label ?? ""}
            nombre={currentPerio?.nombre ?? 8}
            chapterName={chapter?.label}
            classeurName={classeurName}
            establishment={establishment}
            themed
          />
        </div>
      </div>

      {/* Aperçu avant impression */}
      <PrintPreview open={previewOpen} onOpenChange={setPreviewOpen} filename={sheet?.title || "fiche-de-suivi"}>
        <TrackingSheetPage
          title={sheet.title || "Sans titre"}
          periodiciteLabel={periodicite?.label ?? ""}
          nombre={periodicite?.nombre ?? 8}
          chapterName={chapter?.label}
          classeurName={classeurName}
          establishment={establishment}
        />
      </PrintPreview>
    </div>
  )
}
