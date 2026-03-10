import { useState, useEffect } from "react"
import { Sun, Moon, Palette, Info, X, Database, FolderOpen } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import * as Dialog from "@radix-ui/react-dialog"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { getStoredTheme, setTheme, type Theme } from "@/lib/theme"
import { cn } from "@/lib/utils"

interface AppInfo {
  name: string
  version: string
  os: string
  arch: string
}

const sections = [
  { id: "appearance", label: "Apparence", icon: Palette },
  { id: "data", label: "Données", icon: Database },
  { id: "about", label: "À propos", icon: Info },
] as const

type SectionId = (typeof sections)[number]["id"]

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Breakpoint sm Tailwind (640px) */
const SM_QUERY = "(min-width: 640px)"

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("appearance")
  const [currentTheme, setCurrentTheme] = useState<Theme>(getStoredTheme)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [dbFolder, setDbFolder] = useState("")

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
    }
  }, [open])

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

              {activeSection === "about" && (
                <section>
                  <h2 className="text-base font-semibold">À propos</h2>
                  {info ? (
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                      <dt className="text-muted-foreground">Application</dt>
                      <dd>{info.name}</dd>
                      <dt className="text-muted-foreground">Version</dt>
                      <dd>{info.version}</dd>
                      <dt className="text-muted-foreground">OS</dt>
                      <dd>{info.os}</dd>
                      <dt className="text-muted-foreground">Architecture</dt>
                      <dd>{info.arch}</dd>
                    </dl>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Chargement...</p>
                  )}
                </section>
              )}
            </div>
          </div>

          <Dialog.Description className="sr-only">
            Paramètres de l'application
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
