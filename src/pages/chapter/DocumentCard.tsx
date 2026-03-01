import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Trash2, FileDown } from "lucide-react"
import type { Doc } from "./types"

interface DocumentCardProps {
  doc: Doc
  chapterId: string
  onExport: (e: React.MouseEvent, doc: Doc) => void
  onDelete: (e: React.MouseEvent, doc: Doc) => void
}

export function DocumentCard({ doc, chapterId, onExport, onDelete }: DocumentCardProps) {
  const navigate = useNavigate()

  const handleClick = useCallback(() => {
    navigate(`/chapitres/${chapterId}/documents/${doc.id}`)
  }, [navigate, chapterId, doc.id])

  return (
    <div
      className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 cursor-pointer hover:border-primary/50 transition-colors"
      onClick={handleClick}
    >
      <h3 className="font-medium truncate flex-1">
        {doc.title || "Sans titre"}
      </h3>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
        onClick={(e) => onExport(e, doc)}
        aria-label="Exporter PDF"
      >
        <FileDown className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
        onClick={(e) => onDelete(e, doc)}
        aria-label="Supprimer"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
