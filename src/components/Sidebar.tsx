import { useState, useEffect, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers"
import { Settings, Library, Home } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { getChapterIcon, type ChapterRow, type NavItemData } from "@/lib/navigation"
import { useQuery } from "@/lib/hooks/useQuery"
import { useMutation } from "@/lib/hooks/useMutation"
import { on, CHAPTERS_CHANGED } from "@/lib/events"
import { useDndRegistry } from "@/lib/dnd/useDndRegistry"
import { useLocation } from "react-router-dom"
import { NavItem } from "./NavItem"

/** Breakpoint lg Tailwind (1024px) */
const LG_QUERY = "(min-width: 1024px)"

/** Extrait le classeurId depuis le pathname */
function extractClasseurId(pathname: string): string | null {
  const match = pathname.match(/\/classeurs\/(\d+)/)
  return match ? match[1] : null
}

interface SidebarProps {
  mobile?: boolean
  open?: boolean
  onClose?: () => void
  onOpenSettings?: () => void
}

export function Sidebar({ mobile = false, open = false, onClose, onOpenSettings }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const classeurId = extractClasseurId(location.pathname)

  // Détecte si la sidebar desktop est étendue (lg+)
  const [isExpanded, setIsExpanded] = useState(() => window.matchMedia(LG_QUERY).matches)

  useEffect(() => {
    const mq = window.matchMedia(LG_QUERY)
    const handler = (e: MediaQueryListEvent) => setIsExpanded(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Chargement des chapitres depuis la DB — filtrés par classeur si on est dans un classeur
  const chapterFilters = useMemo(
    () => classeurId ? { classeur_id: Number(classeurId) } : undefined,
    [classeurId]
  )
  const { data: chapters, refetch } = useQuery<ChapterRow>("chapters", chapterFilters)
  const { update } = useMutation("chapters")

  // Rafraîchir quand un autre composant modifie les chapitres
  useEffect(() => on(CHAPTERS_CHANGED, refetch), [refetch])

  // Chapitres triés par sort_order (source DB)
  const dbSorted = useMemo(
    () => [...chapters].sort((a, b) => a.sort_order - b.sort_order),
    [chapters]
  )

  // État local optimiste — mis à jour instantanément au drop
  const [localOrder, setLocalOrder] = useState<ChapterRow[]>([])

  // Synchroniser l'état local quand la DB change (chargement initial, refetch, ajout)
  useEffect(() => {
    setLocalOrder(dbSorted)
  }, [dbSorted])

  // Conversion ChapterRow → NavItemData (depuis l'état local optimiste)
  const navItems: NavItemData[] = useMemo(
    () =>
      localOrder.map((ch) => ({
        id: String(ch.id),
        path: classeurId ? `/classeurs/${classeurId}/chapitres/${ch.id}` : `/chapitres/${ch.id}`,
        label: ch.label,
        icon: getChapterIcon(ch.icon),
      })),
    [localOrder, classeurId]
  )

  // --- Drag and drop ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = localOrder.findIndex((c) => String(c.id) === active.id)
      const newIndex = localOrder.findIndex((c) => String(c.id) === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      // 1. Mise à jour optimiste immédiate (pas de clipping)
      const reordered = [...localOrder]
      const [moved] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, moved)
      setLocalOrder(reordered)

      // 2. Persister en DB en arrière-plan
      Promise.all(
        reordered.map((ch, i) =>
          update(String(ch.id), { sort_order: i + 1 })
        )
      ).then(() => refetch())
    },
    [localOrder, update, refetch]
  )

  // Bouton retour vers la liste des classeurs
  const BackToClasseurs = ({ responsive, onClick: onItemClick }: { responsive?: boolean; onClick?: () => void }) => {
    const showTooltipBack = responsive && !isExpanded
    return (
      <Tooltip open={showTooltipBack ? undefined : false}>
        <TooltipTrigger asChild>
          <div>
            <button
              onClick={() => { navigate("/"); onItemClick?.() }}
              className={cn(
                "flex items-center rounded-lg py-2 transition-colors w-full",
                "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                !responsive && "gap-3 px-3"
              )}
            >
              {responsive ? (
                <span className="flex items-center justify-center w-12 shrink-0">
                  <Library className="h-5 w-5" />
                </span>
              ) : (
                <Library className="h-5 w-5 shrink-0" />
              )}
              <span className={cn(
                "text-sm whitespace-nowrap",
                responsive && "transition-opacity duration-200",
                responsive && !isExpanded && "opacity-0"
              )}>
                Mes classeurs
              </span>
            </button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">Mes classeurs</TooltipContent>
      </Tooltip>
    )
  }

  // Lien Accueil — redirige vers le dashboard du classeur actif
  const HomeLink = ({ responsive, onClick: onItemClick }: { responsive?: boolean; onClick?: () => void }) => {
    const isOnDashboard = classeurId !== null && location.pathname === `/classeurs/${classeurId}`
    const showTooltipHome = responsive && !isExpanded
    return (
      <Tooltip open={showTooltipHome ? undefined : false}>
        <TooltipTrigger asChild>
          <div>
            <button
              onClick={() => { if (classeurId) navigate(`/classeurs/${classeurId}`); onItemClick?.() }}
              className={cn(
                "flex items-center rounded-lg py-2 transition-colors w-full",
                isOnDashboard
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                !responsive && "gap-3 px-3"
              )}
            >
              {responsive ? (
                <span className="flex items-center justify-center w-12 shrink-0">
                  <Home className="h-5 w-5" />
                </span>
              ) : (
                <Home className="h-5 w-5 shrink-0" />
              )}
              <span className={cn(
                "text-sm whitespace-nowrap",
                responsive && "transition-opacity duration-200",
                responsive && !isExpanded && "opacity-0"
              )}>
                Accueil
              </span>
            </button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">Accueil</TooltipContent>
      </Tooltip>
    )
  }

  // Liste sortable des chapitres — version desktop (utilise le DndContext du DndProvider)
  const DesktopChapterList = ({ responsive }: { responsive?: boolean }) => {
    const dndRegistry = useDndRegistry()

    useEffect(() => {
      dndRegistry.registerHandler("chapter", handleDragEnd)
      return () => dndRegistry.unregisterHandler("chapter")
    }, [dndRegistry])

    return (
      <SortableContext
        items={navItems.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        {navItems.map((item) => (
          <NavItem key={item.id} item={item} responsive={responsive} />
        ))}
      </SortableContext>
    )
  }

  // Liste sortable des chapitres — version mobile (DndContext propre)
  const MobileChapterList = ({ onItemClick }: { onItemClick?: () => void }) => (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={navItems.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        {navItems.map((item) => (
          <NavItem key={item.id} item={item} onClick={onItemClick} />
        ))}
      </SortableContext>
    </DndContext>
  )

  // Si on est sur la page d'accueil (liste des classeurs), pas de chapitres à afficher
  const showChapters = classeurId !== null

  // --- Version mobile : drawer + overlay ---
  if (mobile) {
    return (
      <>
        {open && (
          <div
            className="fixed inset-0 z-50 bg-black/40 md:hidden"
            onClick={onClose}
          />
        )}

        <aside
          className={cn(
            "fixed left-0 top-0 z-50 flex h-full w-60 flex-col border-r bg-card transition-transform duration-200 md:hidden",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="border-b p-2 flex flex-col gap-1">
            <HomeLink onClick={onClose} />
          </div>

          {showChapters && (
            <nav className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto">
              <MobileChapterList onItemClick={onClose} />
            </nav>
          )}

          <div className="mt-auto border-t p-2 flex flex-col gap-1">
            <BackToClasseurs onClick={onClose} />
            <button
              onClick={() => { onOpenSettings?.(); onClose?.() }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors w-full"
            >
              <Settings className="h-5 w-5 shrink-0" />
              <span className="text-sm">Paramètres</span>
            </button>
          </div>
        </aside>
      </>
    )
  }

  // --- Version desktop : sidebar fixe ---
  const showTooltip = !isExpanded

  return (
    <>
      <aside
        className={cn(
          "hidden md:flex flex-col border-r bg-card overflow-hidden transition-[width] duration-200",
          isExpanded ? "w-60" : "w-16"
        )}
      >
        <div className="border-b p-2 flex flex-col gap-1">
          <HomeLink responsive />
        </div>

        {showChapters && (
          <nav className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto">
            <DesktopChapterList responsive />
          </nav>
        )}

        <div className="mt-auto border-t p-2 flex flex-col gap-1">
          <BackToClasseurs responsive />
          <Tooltip open={showTooltip ? undefined : false}>
            <TooltipTrigger asChild>
              <div>
                <button
                  onClick={() => onOpenSettings?.()}
                  className="flex items-center rounded-lg py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors w-full"
                >
                  <span className="flex items-center justify-center w-12 shrink-0">
                    <Settings className="h-5 w-5" />
                  </span>
                  <span className={cn(
                    "text-sm whitespace-nowrap transition-opacity duration-200",
                    !isExpanded && "opacity-0"
                  )}>
                    Paramètres
                  </span>
                </button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">Paramètres</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </>
  )
}
