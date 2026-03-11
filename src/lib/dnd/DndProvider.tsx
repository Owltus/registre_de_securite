import { createElement, useCallback, useRef, useState } from "react"
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type UniqueIdentifier,
  type CollisionDetection,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import { FileText, Columns3, PenLine, BookMarked } from "lucide-react"
import { getChapterIcon } from "@/lib/navigation"
import { DndRegistryContext, type DragData, type DragHandler, type DndRegistryValue } from "./useDndRegistry"
import type { ChapterDragData, ClasseurDragData } from "./useDndRegistry"

/** Overlay en forme de carte chapitre (items A4) : header (icône+titre) + rectangle A4 placeholder */
function CardOverlay({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex flex-col rounded-lg border border-primary/50 bg-card shadow-lg overflow-hidden w-[220px]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium truncate flex-1">{title}</span>
      </div>
      <div className="bg-muted/30" style={{ aspectRatio: "210 / 297" }} />
    </div>
  )
}

/** Overlay pour un chapitre de la sidebar */
function ChapterOverlay({ data }: { data: ChapterDragData }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card border shadow-lg max-w-[14rem]">
      {createElement(getChapterIcon(data.icon), { className: "h-5 w-5 text-muted-foreground shrink-0" })}
      <span className="text-sm truncate">{data.label}</span>
    </div>
  )
}

/** Overlay pour un classeur */
function ClasseurOverlay({ data }: { data: ClasseurDragData }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card px-5 py-4 shadow-lg max-w-md w-[28rem]">
      {createElement(getChapterIcon(data.icon), { className: "h-5 w-5 text-muted-foreground shrink-0" })}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1 min-h-[2.5rem] justify-center">
        <span className="text-sm font-medium truncate">{data.title || "Sans titre"}</span>
        {data.subtitle && <span className="text-xs text-muted-foreground truncate">{data.subtitle}</span>}
      </div>
    </div>
  )
}

export function DndProvider({ children }: { children: React.ReactNode }) {
  const handlersRef = useRef<Record<string, DragHandler>>({})
  const [activeDragType, setActiveDragType] = useState<string | null>(null)
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null)
  const [activeOverId, setActiveOverId] = useState<UniqueIdentifier | null>(null)

  // Ref pour accéder au type actif dans la collision detection (pas de re-render)
  const activeDragTypeRef = useRef<string | null>(null)

  const registerHandler = useCallback((type: string, handler: DragHandler) => {
    handlersRef.current[type] = handler
  }, [])

  const unregisterHandler = useCallback((type: string) => {
    delete handlersRef.current[type]
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined
    const type = data?.type ?? null
    setActiveDragType(type)
    setActiveDragData(data ?? null)
    activeDragTypeRef.current = type
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setActiveOverId(event.over?.id ?? null)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const data = event.active.data.current as DragData | undefined
    const type = data?.type
    if (type && handlersRef.current[type]) {
      handlersRef.current[type](event)
    }
    setActiveDragType(null)
    setActiveDragData(null)
    setActiveOverId(null)
    activeDragTypeRef.current = null
  }, [])

  const handleDragCancel = useCallback(() => {
    setActiveDragType(null)
    setActiveDragData(null)
    setActiveOverId(null)
    activeDragTypeRef.current = null
  }, [])

  // Collision detection adaptative :
  // - chapitres (tri) → closestCenter (meilleur pour le réordonnancement)
  // - documents (cross-container) → pointerWithin (meilleur pour le drop sur cible)
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      if (activeDragTypeRef.current === "document" || activeDragTypeRef.current === "tracking_sheet") {
        return pointerWithin(args)
      }
      return closestCenter(args)
    },
    []
  )

  // Modifiers conditionnels : contrainte verticale pour les listes ordonnées
  const modifiers = (activeDragType === "chapter" || activeDragType === "classeur")
    ? [restrictToVerticalAxis]
    : []

  const registryValue: DndRegistryValue = {
    registerHandler,
    unregisterHandler,
    activeDragType,
    activeDragData,
    activeOverId,
  }

  return (
    <DndRegistryContext.Provider value={registryValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        modifiers={modifiers}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {activeDragData?.type === "chapter" && <ChapterOverlay data={activeDragData} />}
          {activeDragData?.type === "document" && <CardOverlay icon={FileText} title={activeDragData.docTitle || "Sans titre"} />}
          {activeDragData?.type === "tracking_sheet" && <CardOverlay icon={Columns3} title={activeDragData.sheetTitle || "Sans titre"} />}
          {activeDragData?.type === "signature_sheet" && <CardOverlay icon={PenLine} title={activeDragData.sheetTitle || "Sans titre"} />}
          {activeDragData?.type === "intercalaire" && <CardOverlay icon={BookMarked} title={activeDragData.pageTitle || "Sans titre"} />}
          {activeDragData?.type === "classeur" && <ClasseurOverlay data={activeDragData} />}
        </DragOverlay>
      </DndContext>
    </DndRegistryContext.Provider>
  )
}
