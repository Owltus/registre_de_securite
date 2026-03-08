import { useState, useEffect } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { Library, Menu, Minus, Square, X } from "lucide-react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Sidebar } from "@/components/Sidebar"
import { SettingsDialog } from "@/features/settings/SettingsDialog"
import { AppLogo } from "@/components/AppLogo"
import { getChapterIcon } from "@/lib/navigation"
import { sqliteAdapter } from "@/lib/db/sqlite"
import { on, CLASSEURS_CHANGED } from "@/lib/events"
import { DndProvider } from "@/lib/dnd/DndProvider"

/** Icône « restaurer » Windows : deux carrés superposés */
function RestoreIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      {/* Carré arrière (décalé haut-droite) */}
      <rect x="3" y="0.5" width="6.5" height="6.5" rx="0.5" />
      {/* Carré avant (décalé bas-gauche) */}
      <rect x="0.5" y="3" width="6.5" height="6.5" rx="0.5" fill="var(--background, white)" />
    </svg>
  )
}

/** Extrait le classeurId depuis le pathname */
function extractClasseurId(pathname: string): string | null {
  const match = pathname.match(/\/classeurs\/(\d+)/)
  return match ? match[1] : null
}

export function RootLayout() {
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const location = useLocation()
  const classeurId = extractClasseurId(location.pathname)
  const isClasseurList = location.pathname === "/"
  const [displayName, setDisplayName] = useState("Mes classeurs")
  const [displayIcon, setDisplayIcon] = useState<string | null>(null)
  const [displayEtablissement, setDisplayEtablissement] = useState("")
  const [displayComplement, setDisplayComplement] = useState("")
  const appWindow = getCurrentWindow()

  // Charger le nom et l'icône du classeur actif
  useEffect(() => {
    if (!classeurId) {
      setDisplayName("Mes classeurs")
      setDisplayIcon(null)
      setDisplayEtablissement("")
      setDisplayComplement("")
      return
    }
    sqliteAdapter
      .get("classeurs", classeurId)
      .then((row) => {
        if (row && typeof row === "object" && "name" in row) {
          const r = row as { name: string; icon?: string; etablissement?: string; etablissement_complement?: string }
          setDisplayName(r.name)
          setDisplayIcon(r.icon ?? null)
          setDisplayEtablissement(r.etablissement ?? "")
          setDisplayComplement(r.etablissement_complement ?? "")
        }
      })
  }, [classeurId])

  // Écouter les changements de classeurs
  useEffect(() => on(CLASSEURS_CHANGED, () => {
    if (!classeurId) return
    sqliteAdapter
      .get("classeurs", classeurId)
      .then((row) => {
        if (row && typeof row === "object" && "name" in row) {
          const r = row as { name: string; icon?: string; etablissement?: string; etablissement_complement?: string }
          setDisplayName(r.name)
          setDisplayIcon(r.icon ?? null)
          setDisplayEtablissement(r.etablissement ?? "")
          setDisplayComplement(r.etablissement_complement ?? "")
        }
      })
  }), [classeurId])

  // Suivre l'état maximisé (couvre bouton, double-clic, Aero Snap, raccourcis)
  useEffect(() => {
    appWindow.isMaximized().then(setMaximized)
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setMaximized)
    })
    return () => { unlisten.then(fn => fn()) }
  }, [])

  return (
    <div className="flex h-screen flex-col">
      {/* Titlebar — zone de drag + contrôles */}
      <header
        data-tauri-drag-region
        className="flex select-none items-center border-b px-4 py-2"
      >
        {/* Gauche : icône classeur + nom — cliquable pour revenir à la liste des classeurs */}
        {(() => {
          const ClasseurIcon = displayIcon ? getChapterIcon(displayIcon) : null
          const subtitle = [displayEtablissement, displayComplement].filter(Boolean).join(" · ")
          return isClasseurList ? (
            <div className="pointer-events-none flex items-center gap-2">
              <Library className="h-5 w-5" />
              <span className="text-sm font-semibold">Mes classeurs</span>
            </div>
          ) : (
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 rounded-md px-1 -ml-1 hover:bg-accent transition-colors"
            >
              {ClasseurIcon ? <ClasseurIcon className="h-5 w-5" /> : <AppLogo size={20} />}
              <span className="text-sm font-semibold">{displayName}</span>
              {subtitle && <span className="text-xs text-muted-foreground">· {subtitle}</span>}
            </button>
          )
        })()}

        {/* Droite : hamburger (mobile) + boutons fenêtre */}
        <div className="ml-auto flex items-center gap-1">
          {!isClasseurList && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setMobileOpen(true)}
                  className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground md:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Menu</TooltipContent>
            </Tooltip>
          )}

          {/* Boutons de contrôle fenêtre — masqués en mobile */}
          <div className="hidden md:flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => appWindow.minimize()}
                  aria-label="Réduire"
                  className="inline-flex h-8 w-10 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <Minus className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Réduire</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => appWindow.toggleMaximize()}
                  aria-label={maximized ? "Restaurer" : "Agrandir"}
                  className="inline-flex h-8 w-10 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  {maximized ? (
                    <RestoreIcon className="h-4 w-4" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>{maximized ? "Restaurer" : "Agrandir"}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => appWindow.close()}
                  aria-label="Fermer"
                  className="inline-flex h-8 w-10 items-center justify-center rounded-sm text-muted-foreground hover:bg-red-500 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Fermer</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>

      {/* Contenu : sidebar + page */}
      <div className="flex flex-1 overflow-hidden">
        {/* DndProvider partagé entre sidebar desktop et contenu */}
        <DndProvider>
          {/* Sidebar desktop — masquée sur la page liste des classeurs */}
          {!isClasseurList && <Sidebar onOpenSettings={() => setSettingsOpen(true)} />}

          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </DndProvider>

        {/* Sidebar mobile (drawer) — masquée sur la page liste des classeurs */}
        {!isClasseurList && <Sidebar mobile open={mobileOpen} onClose={() => setMobileOpen(false)} onOpenSettings={() => setSettingsOpen(true)} />}
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
