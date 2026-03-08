import { useState, useEffect, useRef } from "react"
import { Link } from "react-router-dom"
import { Pencil, BookOpen, FileText, ClipboardList, PenLine } from "lucide-react"
import { Input } from "@/components/ui/input"
import { DEFAULT_REGISTRY_NAME, getChapterIcon, type ChapterRow } from "@/lib/navigation"
import { usePreference } from "@/lib/hooks/usePreference"
import { useQuery } from "@/lib/hooks/useQuery"
import { sqliteAdapter } from "@/lib/db/sqlite"
import { emit, on, CHAPTERS_CHANGED, REGISTRY_NAME_CHANGED } from "@/lib/events"

interface CountRow {
  count: number
}

export default function DashboardPage() {
  const [registryName, setRegistryName] = usePreference("registry_name", DEFAULT_REGISTRY_NAME)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  // Chapitres
  const { data: chapters, refetch: refetchChapters } = useQuery<ChapterRow>("chapters")
  useEffect(() => on(CHAPTERS_CHANGED, refetchChapters), [refetchChapters])

  const sortedChapters = [...chapters].sort((a, b) => a.sort_order - b.sort_order)

  // Compteurs
  const [docCount, setDocCount] = useState(0)
  const [trackingCount, setTrackingCount] = useState(0)
  const [signatureCount, setSignatureCount] = useState(0)

  useEffect(() => {
    const fetchCounts = async () => {
      const [docs] = await sqliteAdapter.query<CountRow>("SELECT COUNT(*) as count FROM documents")
      const [sheets] = await sqliteAdapter.query<CountRow>("SELECT COUNT(*) as count FROM tracking_sheets")
      const [sigs] = await sqliteAdapter.query<CountRow>("SELECT COUNT(*) as count FROM signature_sheets")
      setDocCount(docs?.count ?? 0)
      setTrackingCount(sheets?.count ?? 0)
      setSignatureCount(sigs?.count ?? 0)
    }
    fetchCounts()
  }, [chapters])

  // Édition inline du nom
  const startEditing = () => {
    setEditValue(registryName)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const saveEdit = async () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== registryName) {
      await setRegistryName(trimmed)
      emit(REGISTRY_NAME_CHANGED)
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") saveEdit()
    if (e.key === "Escape") setEditing(false)
  }

  const stats = [
    { label: "Chapitres", value: chapters.length, icon: BookOpen },
    { label: "Documents", value: docCount, icon: FileText },
    { label: "Fiches de suivi", value: trackingCount, icon: ClipboardList },
    { label: "Fiches de signature", value: signatureCount, icon: PenLine },
  ]

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* En-tête avec nom éditable */}
      <div className="flex items-center gap-3 mb-8">
        {editing ? (
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            className="text-2xl font-bold h-auto py-1 max-w-md"
            autoFocus
          />
        ) : (
          <>
            <h1 className="text-2xl font-bold">{registryName}</h1>
            <button
              onClick={startEditing}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              title="Modifier le nom du registre"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Grille de statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="rounded-lg border bg-card p-4 flex flex-col items-center gap-2"
            >
              <Icon className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{stat.value}</span>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
          )
        })}
      </div>

      {/* Liste des chapitres */}
      <h2 className="text-lg font-semibold mb-4">Chapitres</h2>
      {sortedChapters.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun chapitre pour l'instant. Créez-en un depuis la sidebar.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {sortedChapters.map((ch) => {
            const Icon = getChapterIcon(ch.icon)
            return (
              <Link
                key={ch.id}
                to={`/chapitres/${ch.id}`}
                className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-accent transition-colors"
              >
                <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium">{ch.label}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
