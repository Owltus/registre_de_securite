import { useState, useEffect } from "react"
import { Sun, Moon, Palette, Info, X, Database, FolderOpen, History, RotateCcw, Trash2, Download } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import * as Dialog from "@radix-ui/react-dialog"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { getStoredTheme, setTheme, type Theme } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { emit, CHAPTERS_CHANGED } from "@/lib/events"
import { getMergeHistory, rollbackMerge, deleteMergeEntry, downloadMergeSnapshot, type MergeHistoryEntry } from "@/lib/exportMarkdown"

interface AppInfo {
  name: string
  version: string
  os: string
  arch: string
}

const BASE_SECTIONS = [
  { id: "appearance", label: "Apparence", icon: Palette },
  { id: "data", label: "Données", icon: Database },
  { id: "history", label: "Historique", icon: History },
  { id: "about", label: "À propos", icon: Info },
] as const

type SectionId = (typeof BASE_SECTIONS)[number]["id"]

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  classeurId?: number
  classeurName?: string
}

/** Breakpoint sm Tailwind (640px) */
const SM_QUERY = "(min-width: 640px)"

export function SettingsDialog({ open, onOpenChange, classeurId, classeurName }: SettingsDialogProps) {
  const sections = BASE_SECTIONS.filter((s) => s.id !== "history" || classeurId)
  const [activeSection, setActiveSection] = useState<SectionId>("appearance")
  const [currentTheme, setCurrentTheme] = useState<Theme>(getStoredTheme)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [dbFolder, setDbFolder] = useState("")
  const [mergeHistory, setMergeHistory] = useState<MergeHistoryEntry[]>([])
  const [busy, setBusy] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MergeHistoryEntry | null>(null)

  // Détecte si la nav interne est rétractée (icônes seules)
  const [isCollapsed, setIsCollapsed] = useState(() => !window.matchMedia(SM_QUERY).matches)

  useEffect(() => {
    const mq = window.matchMedia(SM_QUERY)
    const handler = (e: MediaQueryListEvent) => setIsCollapsed(!e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  useEffect(() => {
    setTheme(currentTheme)
  }, [currentTheme])

  const refreshHistory = () => {
    if (classeurId) getMergeHistory(classeurId).then(setMergeHistory)
  }

  useEffect(() => {
    if (open) {
      invoke<AppInfo>("get_app_info").then(setInfo)
      invoke<string>("get_db_url").then((url) => {
        // url = "sqlite:C:\...\sqlite\registre.db" → extraire le dossier parent
        const path = url.replace(/^sqlite:/, "")
        const sep = path.includes("\\") ? "\\" : "/"
        const folder = path.substring(0, path.lastIndexOf(sep))
        setDbFolder(folder)
      })
      refreshHistory()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, classeurId])

  const handleRestore = async (entry: MergeHistoryEntry) => {
    setBusy(entry.id)
    try {
      await rollbackMerge(entry.id)
      toast.warning("Restauration effectuée")
      emit(CHAPTERS_CHANGED)
      refreshHistory()
    } catch {
      toast.error("Erreur lors de la restauration de la sauvegarde")
    } finally {
      setBusy(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setBusy(deleteTarget.id)
    try {
      await deleteMergeEntry(deleteTarget.id)
      toast.error("Sauvegarde supprimée")
      refreshHistory()
    } catch {
      toast.error("Erreur lors de la suppression de la sauvegarde")
    } finally {
      setBusy(null)
      setDeleteTarget(null)
    }
  }

  const getEntryLabel = (entry: MergeHistoryEntry) => {
    const isAuto = entry.source_name === "Sauvegarde avant restauration"
    const isExport = entry.source_name === "Export"
    return {
      title: isAuto ? "Sauvegarde" : isExport ? "Export" : "Import",
      description: isAuto
        ? "Sauvegarde automatique avant retour en arrière"
        : isExport
          ? "Sauvegarde au moment de l'export"
          : "Fusion depuis un fichier externe",
      hasCounters: !isAuto && !isExport,
    }
  }

  const handleDownload = async (entry: MergeHistoryEntry) => {
    setBusy(entry.id)
    try {
      const { title } = getEntryLabel(entry)
      const date = new Date(entry.merged_at).toISOString().slice(0, 10)
      const name = classeurName || "Classeur"
      const result = await downloadMergeSnapshot(entry.id, `${name} ${title.toLowerCase()} ${date}`)
      if (result) toast.info("Fichier enregistré")
      else toast.warning("Téléchargement annulé")
    } catch {
      toast.error("Erreur lors du téléchargement de la sauvegarde")
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-3xl h-[75vh] border bg-background shadow-lg rounded-lg flex flex-col overflow-hidden focus:outline-none">

          {/* En-tête */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <Dialog.Title className="text-lg font-semibold">
              Paramètres
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Fermer</span>
            </Dialog.Close>
          </div>

          {/* Corps : navigation + contenu */}
          <div className="flex flex-1 overflow-hidden">
            {/* Navigation latérale */}
            <nav className={cn(
              "shrink-0 border-r p-2 flex flex-col gap-1 overflow-y-auto transition-[width] duration-200",
              isCollapsed ? "w-16" : "w-44"
            )}>
              {sections.map((section) => {
                const Icon = section.icon
                return (
                  <Tooltip key={section.id} open={isCollapsed ? undefined : false}>
                    <TooltipTrigger asChild>
                      <div>
                        <button
                          onClick={() => setActiveSection(section.id)}
                          className={cn(
                            "flex items-center rounded-lg py-2 transition-colors w-full",
                            activeSection === section.id
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          <span className="flex items-center justify-center w-12 shrink-0">
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className={cn(
                            "text-sm whitespace-nowrap transition-opacity duration-200",
                            isCollapsed && "opacity-0"
                          )}>
                            {section.label}
                          </span>
                        </button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">{section.label}</TooltipContent>
                  </Tooltip>
                )
              })}
            </nav>

            {/* Contenu de la section active */}
            <div className="flex-1 overflow-auto p-6">
              {activeSection === "appearance" && (
                <section>
                  <h2 className="text-base font-semibold">Apparence</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choisir le thème de l'application.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant={currentTheme === "light" ? "default" : "outline"}
                      onClick={() => setCurrentTheme("light")}
                    >
                      <Sun className="mr-2 h-4 w-4" />
                      Clair
                    </Button>
                    <Button
                      variant={currentTheme === "dark" ? "default" : "outline"}
                      onClick={() => setCurrentTheme("dark")}
                    >
                      <Moon className="mr-2 h-4 w-4" />
                      Sombre
                    </Button>
                    <Button
                      variant={currentTheme === "system" ? "default" : "outline"}
                      onClick={() => setCurrentTheme("system")}
                    >
                      Système
                    </Button>
                  </div>
                </section>
              )}

              {activeSection === "data" && (
                <section>
                  <h2 className="text-base font-semibold">Données</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Les données de l'application sont stockées localement dans une base SQLite.
                  </p>
                  <div className="mt-4 flex flex-col gap-3">
                    <p className="text-xs text-muted-foreground font-mono break-all">
                      {dbFolder || "Chargement…"}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => invoke("open_db_folder")}
                      disabled={!dbFolder}
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Ouvrir le dossier
                    </Button>
                  </div>
                </section>
              )}

              {activeSection === "history" && classeurId && (
                <section>
                  <h2 className="text-base font-semibold">Historique des imports</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Chaque import crée une sauvegarde automatique. Vous pouvez restaurer un état précédent ou supprimer une sauvegarde devenue inutile.
                  </p>
                  {mergeHistory.length === 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">Aucune sauvegarde enregistrée.</p>
                  ) : (
                    <div className="mt-4 flex flex-col gap-2">
                      {mergeHistory.map((entry) => {
                        const isBusy = busy === entry.id
                        const { title, description, hasCounters } = getEntryLabel(entry)
                        return (
                          <div key={entry.id} className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
                            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                              <span className="font-medium truncate">
                                {title}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {description}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(entry.merged_at).toLocaleString("fr-FR")}
                                {hasCounters && (
                                  <>
                                    {" — "}
                                    {entry.inserted} ajouté(s), {entry.updated} mis à jour, {entry.unchanged} inchangé(s)
                                    {entry.skipped > 0 && `, ${entry.skipped} ignoré(s)`}
                                  </>
                                )}
                              </span>
                            </div>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0 h-8 w-8"
                                  disabled={busy !== null}
                                  onClick={() => handleRestore(entry)}
                                >
                                  <RotateCcw className={cn("h-4 w-4", isBusy && "animate-spin")} />
                                  <span className="sr-only">Restaurer</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Restaurer cette sauvegarde</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0 h-8 w-8"
                                  disabled={busy !== null}
                                  onClick={() => handleDownload(entry)}
                                >
                                  <Download className="h-4 w-4" />
                                  <span className="sr-only">Télécharger</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Télécharger le JSON</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                                  disabled={busy !== null}
                                  onClick={() => setDeleteTarget(entry)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Supprimer</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Supprimer cette sauvegarde</TooltipContent>
                            </Tooltip>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              )}

              {activeSection === "about" && (
                <section>
                  <h2 className="text-base font-semibold">À propos</h2>
                  {info ? (
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                      <dt className="text-muted-foreground">Application</dt>
                      <dd>{info.name}</dd>
                      <dt className="text-muted-foreground">Version</dt>
                      <dd>{info.version}</dd>
                      <dt className="text-muted-foreground">Auteur</dt>
                      <dd>Owltus</dd>
                    </dl>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Chargement...</p>
                  )}
                  <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                    Application portable sans installation, Registre vous permet de constituer et maintenir vos classeurs réglementaires en toute simplicité. Pensé pour les registres de sécurité, carnets sanitaires et archives techniques liés aux ERP, il structure vos documents, fiches de suivi et feuilles de signature par chapitres. Imprimez, exportez et partagez vos classeurs en quelques clics.
                  </p>
                  <a href="https://github.com/Owltus/Registre" className="mt-4 inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                    Voir sur GitHub
                  </a>
                </section>
              )}
            </div>
          </div>

          <Dialog.Description className="sr-only">
            Paramètres de l'application
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>

      {/* Dialog de confirmation de suppression */}
      <Dialog.Root open={deleteTarget !== null} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/60" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-sm border bg-background shadow-lg rounded-lg flex flex-col overflow-hidden focus:outline-none">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <Dialog.Title className="text-lg font-semibold">
                Supprimer la sauvegarde
              </Dialog.Title>
              <Dialog.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                <X className="h-4 w-4" />
                <span className="sr-only">Fermer</span>
              </Dialog.Close>
            </div>

            <div className="px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Voulez-vous vraiment supprimer la sauvegarde{" "}
                <span className="font-medium text-foreground">
                  {deleteTarget ? getEntryLabel(deleteTarget).title : ""}
                </span>{" "}
                du {deleteTarget ? new Date(deleteTarget.merged_at).toLocaleString("fr-FR") : ""} ?
                Cette action est irréversible.
              </p>
            </div>

            <div className="flex justify-end gap-2 px-6 pb-4">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={busy !== null}>
                <Trash2 className="h-4 w-4 mr-1.5" />
                Supprimer
              </Button>
            </div>

            <Dialog.Description className="sr-only">
              Confirmer la suppression de la sauvegarde
            </Dialog.Description>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Dialog.Root>
  )
}
