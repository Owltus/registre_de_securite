import { useMemo, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X, Plus, RefreshCw, Minus, Equal, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { MergePreview, MergePreviewItem } from "@/lib/exportMarkdown"

interface MergePreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preview: MergePreview | null
  loading?: boolean
  onConfirm: () => void
}

const ACTION_CONFIG: Record<string, { label: string; icon: typeof Plus; className: string }> = {
  insert:    { label: "Ajout",    icon: Plus,      className: "text-status-success" },
  update:    { label: "Mise à jour", icon: RefreshCw, className: "text-status-warning" },
  skip:      { label: "Ignoré",   icon: Minus,     className: "text-status-danger" },
  unchanged: { label: "Inchangé", icon: Equal,      className: "text-muted-foreground" },
}

const KIND_LABELS: Record<string, string> = {
  document: "Document",
  tracking_sheet: "Fiche de suivi",
  signature_sheet: "Fiche d'émargement",
  intercalaire: "Intercalaire",
}

export function MergePreviewDialog({ open, onOpenChange, preview, loading, onConfirm }: MergePreviewDialogProps) {
  const [actionFilter, setActionFilter] = useState<string | null>(null)

  // Grouper par chapitre, avec filtre par action
  const grouped = useMemo(() => {
    if (!preview) return []
    const filtered = actionFilter
      ? preview.items.filter(item => item.action === actionFilter)
      : preview.items
    const map = new Map<string, MergePreviewItem[]>()
    for (const item of filtered) {
      const key = item.chapter_label || "Sans chapitre"
      const list = map.get(key)
      if (list) list.push(item)
      else map.set(key, [item])
    }
    return Array.from(map.entries())
  }, [preview, actionFilter])

  const hasChanges = preview ? (preview.total_insert + preview.total_update) > 0 : false

  const toggleFilter = (action: string) => {
    setActionFilter(prev => prev === action ? null : action)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-2xl h-[80vh] border bg-background shadow-lg rounded-lg flex flex-col overflow-hidden focus:outline-none">

          {/* En-tête */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <Dialog.Title className="text-lg font-semibold">
              Prévisualisation du merge
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Fermer</span>
            </Dialog.Close>
          </div>

          {/* Warnings */}
          {preview && preview.warnings.length > 0 && (
            <div className="mx-6 mt-3 rounded-md border border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/30 px-4 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                  {preview.warnings.length} avertissement(s)
                </span>
              </div>
              <ul className="text-xs text-orange-600 dark:text-orange-400 space-y-0.5 ml-6">
                {preview.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Résumé — badges cliquables pour filtrer */}
          {preview && (
            <div className="flex gap-2 px-6 py-3 border-b text-sm flex-wrap">
              <button
                type="button"
                onClick={() => toggleFilter("insert")}
                className={`font-medium px-2 py-0.5 rounded-md transition-colors text-status-success ${
                  actionFilter === "insert" ? "bg-status-success/15 ring-1 ring-status-success/40" : "hover:bg-accent"
                }`}
              >
                {preview.total_insert} ajout(s)
              </button>
              <button
                type="button"
                onClick={() => toggleFilter("update")}
                className={`font-medium px-2 py-0.5 rounded-md transition-colors text-status-warning ${
                  actionFilter === "update" ? "bg-status-warning/15 ring-1 ring-status-warning/40" : "hover:bg-accent"
                }`}
              >
                {preview.total_update} mise(s) à jour
              </button>
              <button
                type="button"
                onClick={() => toggleFilter("unchanged")}
                className={`font-medium px-2 py-0.5 rounded-md transition-colors text-muted-foreground ${
                  actionFilter === "unchanged" ? "bg-muted ring-1 ring-border" : "hover:bg-accent"
                }`}
              >
                {preview.total_unchanged} inchangé(s)
              </button>
              {preview.total_skip > 0 && (
                <button
                  type="button"
                  onClick={() => toggleFilter("skip")}
                  className={`font-medium px-2 py-0.5 rounded-md transition-colors text-status-danger ${
                    actionFilter === "skip" ? "bg-status-danger/15 ring-1 ring-status-danger/40" : "hover:bg-accent"
                  }`}
                >
                  {preview.total_skip} ignoré(s)
                </button>
              )}
              {actionFilter && (
                <button
                  type="button"
                  onClick={() => setActionFilter(null)}
                  className="text-xs text-muted-foreground hover:text-foreground ml-auto"
                >
                  Tout afficher
                </button>
              )}
            </div>
          )}

          {/* Liste des items groupés par chapitre */}
          <div className="flex-1 overflow-auto px-6 py-4">
            {!preview ? (
              <p className="text-sm text-muted-foreground">Chargement de la prévisualisation...</p>
            ) : preview.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun élément dans le fichier importé.</p>
            ) : grouped.length === 0 && actionFilter ? (
              <p className="text-sm text-muted-foreground">Aucun élément pour ce filtre.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {grouped.map(([chapterLabel, items]) => (
                  <div key={chapterLabel}>
                    <h3 className="text-sm font-semibold mb-2">{chapterLabel}</h3>
                    <div className="flex flex-col gap-1">
                      {items.map((item, i) => {
                        const config = ACTION_CONFIG[item.action] ?? ACTION_CONFIG.unchanged
                        const Icon = config.icon
                        return (
                          <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-accent/50 text-sm">
                            <Icon className={`h-4 w-4 shrink-0 ${config.className}`} />
                            <span className="font-medium truncate">{item.title || "Sans titre"}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {KIND_LABELS[item.kind] ?? item.kind}
                            </span>
                            {item.detail && (
                              <span className="text-xs text-muted-foreground ml-auto truncate max-w-[200px]">
                                {item.detail}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pied de page */}
          <div className="flex justify-end gap-2 border-t px-6 py-4">
            <Dialog.Close asChild>
              <Button variant="outline">Annuler</Button>
            </Dialog.Close>
            <Button
              onClick={onConfirm}
              disabled={!preview || loading || !hasChanges}
            >
              {loading ? "Import en cours..." : hasChanges ? "Confirmer l'import" : "Rien à importer"}
            </Button>
          </div>

          <Dialog.Description className="sr-only">
            Prévisualisation des changements avant import
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
