import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Trash2, FileDown, FileText, Pencil, FileOutput } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { DocumentPages } from "@/components/print/DocumentPages"
import type { Doc } from "./types"
import type { DocumentDragData } from "@/lib/dnd/useDndRegistry"
import { exportMarkdown } from "@/lib/exportMarkdown"
import { A4Preview } from "./A4Preview"

interface DocumentCardProps {
  doc: Doc
  chapterId: string
  classeurId?: string
  chapterName?: string
  classeurName?: string
  establishment?: string
  sortableDisabled?: boolean
  onExport?: (e: React.MouseEvent, doc: Doc) => void
  onEdit?: (e: React.MouseEvent, doc: Doc) => void
  onDelete?: (e: React.MouseEvent, doc: Doc) => void
}

export function DocumentCard({ doc, chapterId, classeurId, chapterName, classeurName, establishment, sortableDisabled, onExport, onEdit, onDelete }: DocumentCardProps) {
  const navigate = useNavigate()

  const dragData: DocumentDragData = {
    type: "document",
    docId: doc.id,
    docTitle: doc.title,
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
    id: `document-${doc.id}`,
    data: dragData,
    disabled: sortableDisabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleExportMd = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    exportMarkdown(doc.title, doc.content)
  }, [doc.title, doc.content])

  const handleClick = useCallback(() => {
    navigate(classeurId ? `/classeurs/${classeurId}/chapitres/${chapterId}/documents/${doc.id}` : `/chapitres/${chapterId}/documents/${doc.id}`)
  }, [navigate, chapterId, doc.id, classeurId])

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
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium truncate flex-1">
          {doc.title || "Sans titre"}
        </span>
      </div>

      {/* Miniature + boutons en surimpression */}
      <div className="relative">
        <A4Preview>
          <DocumentPages
            title={doc.title || "Sans titre"}
            subtitle={doc.description ?? ""}
            content={doc.content}
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
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => onExport?.(e, doc)} aria-label="Exporter PDF">
                    <FileDown className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Exporter PDF</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleExportMd} aria-label="Exporter Markdown">
                    <FileOutput className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Exporter Markdown</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => onEdit?.(e, doc)} aria-label="Modifier">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Modifier</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => onDelete?.(e, doc)} aria-label="Supprimer">
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
