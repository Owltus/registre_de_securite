import { useState, useEffect } from "react"
import { NavLink } from "react-router-dom"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { NavItemData } from "@/lib/navigation"
import { useDndRegistry } from "@/lib/dnd/useDndRegistry"

interface NavItemProps {
  item: NavItemData
  /** Masquer le texte en dessous de lg (mode sidebar responsive) */
  responsive?: boolean
  onClick?: () => void
}

/** Breakpoint lg Tailwind (1024px) */
const LG_QUERY = "(min-width: 1024px)"

export function NavItem({ item, responsive = false, onClick }: NavItemProps) {
  const Icon = item.icon

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, data: { type: "chapter", chapterId: item.id, label: item.label, icon: item.iconName } })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  // Feedback visuel : highlight quand un document est survolé sur ce chapitre
  const { activeDragType, activeOverId } = useDndRegistry()
  const isItemOver =
    (activeDragType === "document" || activeDragType === "tracking_sheet")
    && activeOverId === item.id

  // Détecte si la sidebar desktop est rétractée (entre md et lg)
  const [isExpanded, setIsExpanded] = useState(() => window.matchMedia(LG_QUERY).matches)

  useEffect(() => {
    const mq = window.matchMedia(LG_QUERY)
    const handler = (e: MediaQueryListEvent) => setIsExpanded(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Tooltip uniquement quand la sidebar desktop est rétractée (icônes seules)
  const showTooltip = responsive && !isExpanded

  return (
    <Tooltip open={showTooltip ? undefined : false}>
      <TooltipTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          className={cn(
            "touch-none rounded-lg",
            isDragging && "z-50 opacity-30",
            isItemOver && "ring-2 ring-primary bg-primary/10"
          )}
        >
          <NavLink
            to={item.path}
            onClick={onClick}
            className={({ isActive }) =>
              cn(
                "flex items-center rounded-lg py-2 transition-colors min-w-0",
                !responsive && "gap-3 px-3",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                isDragging && "shadow-md"
              )
            }
          >
            {responsive ? (
              <span className="flex items-center justify-center w-12 shrink-0">
                <Icon className="h-5 w-5" />
              </span>
            ) : (
              <Icon className="h-5 w-5 shrink-0" />
            )}
            <span className={cn(
              "text-sm truncate",
              responsive && "transition-opacity duration-200",
              responsive && !isExpanded && "opacity-0"
            )}>
              {item.label}
            </span>
          </NavLink>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}
