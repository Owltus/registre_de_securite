import { createContext, useContext } from "react"
import type { DragEndEvent, UniqueIdentifier } from "@dnd-kit/core"

// --- Types ---

export interface ChapterDragData {
  type: "chapter"
  chapterId: string
}

export interface DocumentDragData {
  type: "document"
  docId: number
  docTitle: string
  sourceChapterId: string
}

export interface TrackingSheetDragData {
  type: "tracking_sheet"
  sheetId: number
  sheetTitle: string
  sourceChapterId: string
}

export interface SignatureSheetDragData {
  type: "signature_sheet"
  sheetId: number
  sheetTitle: string
  sourceChapterId: string
}

export interface IntercalaireDragData {
  type: "intercalaire"
  pageId: number
  pageTitle: string
  sourceChapterId: string
}

export type DragData = ChapterDragData | DocumentDragData | TrackingSheetDragData | SignatureSheetDragData | IntercalaireDragData

export type DragHandler = (event: DragEndEvent) => void

// --- Registry Context ---

export interface DndRegistryValue {
  registerHandler: (type: string, handler: DragHandler) => void
  unregisterHandler: (type: string) => void
  activeDragType: string | null
  activeDragData: DragData | null
  /** ID de l'élément droppable survolé (pour feedback visuel) */
  activeOverId: UniqueIdentifier | null
}

export const DndRegistryContext = createContext<DndRegistryValue | null>(null)

const defaultValue: DndRegistryValue = {
  registerHandler: () => {},
  unregisterHandler: () => {},
  activeDragType: null,
  activeDragData: null,
  activeOverId: null,
}

/** Retourne le contexte DnD partagé, ou des valeurs par défaut si hors DndProvider (ex: sidebar mobile) */
export function useDndRegistry(): DndRegistryValue {
  return useContext(DndRegistryContext) ?? defaultValue
}
