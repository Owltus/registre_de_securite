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
import * as Dialog from "@radix-ui/react-dialog"
import { Settings, Plus, X, Home } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getChapterIcon, type ChapterRow, type NavItemData } from "@/lib/navigation"
import { useQuery } from "@/lib/hooks/useQuery"
import { useMutation } from "@/lib/hooks/useMutation"
import { on, CHAPTERS_CHANGED } from "@/lib/events"
import { useDndRegistry } from "@/lib/dnd/useDndRegistry"
import { useLocation } from "react-router-dom"
import { NavItem } from "./NavItem"
import { IconPicker } from "./IconPicker"

/** Breakpoint lg Tailwind (1024px) */
const LG_QUERY = "(min-width: 1024px)"

interface SidebarProps {
  mobile?: boolean
  open?: boolean
  onClose?: () => void
  onOpenSettings?: () => void
}

export function Sidebar({ mobile = false, open = false, onClose, onOpenSettings }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === "/"

  // Détecte si la sidebar desktop est étendue (lg+)
  const [isExpanded, setIsExpanded] = useState(() => window.matchMedia(LG_QUERY).matches)

  useEffect(() => {
    const mq = window.matchMedia(LG_QUERY)
    const handler = (e: MediaQueryListEvent) => setIsExpanded(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Chargement des chapitres depuis la DB
  const { data: chapters, refetch } = useQuery<ChapterRow>("chapters")
  const { insert, update } = useMutation("chapters")

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
        path: `/chapitres/${ch.id}`,
        label: ch.label,
        icon: getChapterIcon(ch.icon),
      })),
    [localOrder]
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

  // Dialog de création
  const [createOpen, setCreateOpen] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [newIcon, setNewIcon] = useState("FileText")
  const [newDescription, setNewDescription] = useState("")

  const handleCreate = async () => {
    const label = newLabel.trim()
    if (!label) return
    const nextOrder = chapters.length > 0
      ? Math.max(...chapters.map((c) => c.sort_order)) + 1
      : 1
    const newId = await insert({
      label,
      icon: newIcon,
      description: newDescription.trim(),
      sort_order: nextOrder,
    })
    refetch()
    setCreateOpen(false)
    setNewLabel("")
    setNewIcon("FileText")
    setNewDescription("")
    navigate(`/chapitres/${newId}`)
  }

  // Bouton "Ajouter un chapitre" — stylisé comme un NavItem
  const AddChapterButton = ({ responsive }: { responsive?: boolean }) => {
    const showTooltipAdd = responsive && !isExpanded
    return (
      <Tooltip open={showTooltipAdd ? undefined : false}>
        <TooltipTrigger asChild>
          <div>
            <button
              onClick={() => setCreateOpen(true)}
              className={cn(
                "flex items-center rounded-lg py-2 transition-colors w-full text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                !responsive && "gap-3 px-3"
              )}
            >
              {responsive ? (
                <span className="flex items-center justify-center w-12 shrink-0">
                  <Plus className="h-5 w-5" />
                </span>
              ) : (
                <Plus className="h-5 w-5 shrink-0" />
              )}
              <span className={cn(
                "text-sm whitespace-nowrap",
                responsive && "transition-opacity duration-200",
                responsive && !isExpanded && "opacity-0"
              )}>
                Ajouter
              </span>
            </button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">Ajouter un chapitre</TooltipContent>
      </Tooltip>
    )
  }

  // Lien Accueil — stylisé comme un NavItem
  const HomeLink = ({ responsive, onClick: onItemClick }: { responsive?: boolean; onClick?: () => void }) => {
    const showTooltipHome = responsive && !isExpanded
    return (
      <Tooltip open={showTooltipHome ? undefined : false}>
        <TooltipTrigger asChild>
          <div>
            <button
              onClick={() => { navigate("/"); onItemClick?.() }}
              className={cn(
                "flex items-center rounded-lg py-2 transition-colors w-full",
                isHome
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

  // Dialog de création (partagé entre mobile et desktop)
  const CreateDialog = (
    <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-lg border bg-background shadow-lg rounded-lg flex flex-col overflow-hidden focus:outline-none max-h-[85vh]">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <Dialog.Title className="text-lg font-semibold">
              Nouveau chapitre
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Fermer</span>
            </Dialog.Close>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleCreate()
            }}
            className="px-6 py-4 flex flex-col gap-4 overflow-y-auto"
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="chapter-label" className="text-sm font-medium">
                Nom
              </label>
              <Input
                id="chapter-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Nom du chapitre"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">
                Icône
              </label>
              <IconPicker value={newIcon} onChange={setNewIcon} />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="chapter-desc" className="text-sm font-medium">
                Description
              </label>
              <Input
                id="chapter-desc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description (optionnel)"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Annuler
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={!newLabel.trim()}>
                Créer
              </Button>
            </div>
          </form>

          <Dialog.Description className="sr-only">
            Saisir les informations du nouveau chapitre
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )

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
            <AddChapterButton />
          </div>

          <nav className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto">
            <MobileChapterList onItemClick={onClose} />
          </nav>

          <div className="mt-auto border-t p-2 flex flex-col gap-1">
            <button
              onClick={() => { onOpenSettings?.(); onClose?.() }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors w-full"
            >
              <Settings className="h-5 w-5 shrink-0" />
              <span className="text-sm">Paramètres</span>
            </button>
          </div>
        </aside>

        {CreateDialog}
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
          <AddChapterButton responsive />
        </div>

        <nav className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto">
          <DesktopChapterList responsive />
        </nav>

        <div className="mt-auto border-t p-2 flex flex-col gap-1">
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

      {CreateDialog}
    </>
  )
}
