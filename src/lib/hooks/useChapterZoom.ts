import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePreference } from "./usePreference"

const MIN_COLUMNS = 1
const DEFAULT_COLUMNS = 0 // 0 = auto (calcul basé sur la largeur)
const AUTO_CARD_TARGET = 280 // largeur cible en mode auto
const MIN_CARD_WIDTH = 150 // largeur min pour calculer le max de colonnes

/** Résout le nombre de colonnes courant quand on est en mode auto (0) */
function resolveColumns(colCount: number, maxColumns: number): number {
  if (colCount !== 0) return colCount
  return Math.max(MIN_COLUMNS, Math.round(maxColumns * AUTO_CARD_TARGET / (AUTO_CARD_TARGET + MIN_CARD_WIDTH)))
}

function parseSaved(raw: string): number {
  const n = Number(raw)
  return isNaN(n) ? DEFAULT_COLUMNS : n
}

export function useChapterZoom() {
  const [savedValue, setSavedValue] = usePreference("chapter_col_count", String(DEFAULT_COLUMNS))

  // Override local : null = utiliser la valeur SQLite, number = valeur utilisateur
  const [localOverride, setLocalOverride] = useState<number | null>(null)
  const colCount = localOverride ?? parseSaved(savedValue)

  const [maxColumns, setMaxColumns] = useState(6)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nodeRef = useRef<HTMLElement | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)

  // Persister en SQLite avec debounce
  const persistValue = useCallback(
    (value: number) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => setSavedValue(String(value)), 400)
    },
    [setSavedValue]
  )

  // Attacher/détacher le ResizeObserver via le callback ref
  const attachObserver = useCallback((node: HTMLElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
    if (!node) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width
        const gap = 16 // gap-4 = 1rem = 16px
        const max = Math.max(MIN_COLUMNS, Math.floor((width + gap) / (MIN_CARD_WIDTH + gap)))
        setMaxColumns((prev) => prev === max ? prev : max)
      }
    })
    observer.observe(node)
    observerRef.current = observer
  }, [])

  // Zoom : ±1 colonne (clamp sur maxColumns pour éviter les pas fantômes après resize)
  const zoom = useCallback(
    (direction: 1 | -1) => {
      setLocalOverride((prev) => {
        const raw = prev ?? parseSaved(savedValue)
        const clamped = raw !== 0 ? Math.min(raw, maxColumns) : raw
        const current = resolveColumns(clamped, maxColumns)
        const next = direction === 1
          ? Math.max(current - 1, MIN_COLUMNS)
          : Math.min(current + 1, maxColumns)
        persistValue(next)
        return next
      })
    },
    [maxColumns, persistValue, savedValue]
  )

  const reset = useCallback(() => {
    setLocalOverride(DEFAULT_COLUMNS)
    persistValue(DEFAULT_COLUMNS)
  }, [persistValue])

  // Valeur effective + style mémoisé
  const effectiveColumns = colCount === 0 ? undefined : Math.min(colCount, maxColumns)

  const gridStyle = useMemo<React.CSSProperties>(
    () => effectiveColumns
      ? { gridTemplateColumns: `repeat(${effectiveColumns}, minmax(0, 1fr))` }
      : { gridTemplateColumns: `repeat(auto-fill, minmax(${AUTO_CARD_TARGET}px, 1fr))` },
    [effectiveColumns]
  )

  // Refs stables pour les handlers
  const zoomRef = useRef(zoom)
  const resetRef = useRef(reset)
  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { resetRef.current = reset }, [reset])

  // Ctrl+molette : écoute globale (pas besoin de hover sur la grille)
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey) return
      e.preventDefault()
      zoomRef.current(e.deltaY > 0 ? -1 : 1)
    }
    window.addEventListener("wheel", onWheel, { passive: false })
    return () => window.removeEventListener("wheel", onWheel)
  }, [])

  // Ref callback : ResizeObserver uniquement
  const containerRef = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node
    attachObserver(node)
  }, [attachObserver])

  // Raccourcis clavier : Ctrl+Plus/Minus/0
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey) return
      if (e.key === "=" || e.key === "+") {
        e.preventDefault()
        zoomRef.current(1)
      } else if (e.key === "-") {
        e.preventDefault()
        zoomRef.current(-1)
      } else if (e.key === "0") {
        e.preventDefault()
        resetRef.current()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  return { gridStyle, containerRef }
}
