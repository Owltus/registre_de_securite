import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Trash2, FileDown, Pencil, Columns3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { TrackingSheetPage } from "@/components/print/TrackingSheetPage"
import type { TrackingSheet, Periodicite } from "./types"
import type { TrackingSheetDragData } from "@/lib/dnd/useDndRegistry"
import { A4Preview } from "./A4Preview"

interface TrackingSheetCardProps {
  sheet: TrackingSheet
  chapterId: string
  classeurId?: string
  chapterName?: string
  classeurName?: string
  establishment?: string
  periodicite?: Periodicite
  sortableDisabled?: boolean
  onExport?: (e: React.MouseEvent, sheet: TrackingSheet) => void
  onEdit?: (e: React.MouseEvent, sheet: TrackingSheet) => void
  onDelete?: (e: React.MouseEvent, sheet: TrackingSheet) => void
}

export function TrackingSheetCard({ sheet, chapterId, classeurId, chapterName, classeurName, establishment, periodicite, sortableDisabled, onExport, onEdit, onDelete }: TrackingSheetCardProps) {
  const navigate = useNavigate()

  const dragData: TrackingSheetDragData = {
    type: "tracking_sheet",
    sheetId: sheet.id,
    sheetTitle: sheet.title,
    sourceChapterId: chapterId,
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `sheet-${sheet.id}`,
    data: dragData,
    disabled: sortableDisabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleClick = useCallback(() => {
    navigate(classeurId ? `/classeurs/${classeurId}/chapitres/${chapterId}/sheets/${sheet.id}` : `/chapitres/${chapterId}/sheets/${sheet.id}`)
  }, [navigate, chapterId, sheet.id, classeurId])

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative flex flex-col rounded-lg border border-border bg-card cursor-pointer hover:border-primary/50 transition-colors overflow-hidden",
        !sortableDisabled && "touch-none",
        isDragging && "opacity-30 z-50"
      )}
      onClick={handleClick}
    >
      {/* Header — icône + titre */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Columns3 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium truncate flex-1">
          {sheet.title || "Sans titre"}
        </span>
      </div>

      {/* Miniature + boutons en surimpression */}
      <div className="relative">
        <A4Preview>
          <TrackingSheetPage
            title={sheet.title || "Sans titre"}
            periodiciteLabel={periodicite?.label ?? ""}
            nombre={periodicite?.nombre ?? 8}
            chapterName={chapterName}
            classeurName={classeurName}
            establishment={establishment}
            themed
          />
        </A4Preview>

        {/* Actions en surimpression, bas centré */}
        {!sortableDisabled && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-1 rounded-md bg-background/90 border border-border shadow-sm px-1 py-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => onExport?.(e, sheet)} aria-label="Exporter PDF">
                    <FileDown className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Exporter PDF</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => onEdit?.(e, sheet)} aria-label="Modifier">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Modifier</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => onDelete?.(e, sheet)} aria-label="Supprimer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Supprimer</TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
