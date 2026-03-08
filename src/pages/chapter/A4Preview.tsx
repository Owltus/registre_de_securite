import { useRef, useState, useEffect, useCallback, type ReactNode } from "react"

/** Dimensions réelles d'une page A4 en px (96 DPI : 1mm = 3.7795275591px) */
const PAGE_WIDTH_PX = 210 * 3.7795275591
const PAGE_HEIGHT_PX = 297 * 3.7795275591

interface A4PreviewProps {
  /** Composant d'impression réel (DocumentPages, TrackingSheetPage, SignatureSheetPage) */
  children: ReactNode
}

/**
 * Conteneur miniature qui rend un composant d'impression réel à l'échelle.
 * Le contenu est rendu à taille réelle (210×297mm) puis réduit via CSS transform
 * pour tenir dans la largeur disponible. Le ratio A4 est toujours respecté.
 * Un ResizeObserver recalcule le scale au redimensionnement de la fenêtre.
 */
export function A4Preview({ children }: A4PreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  const handleResize = useCallback((entries: ResizeObserverEntry[]) => {
    const entry = entries[0]
    if (!entry) return
    const w = entry.contentRect.width
    if (w > 0) setScale(w / PAGE_WIDTH_PX)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const ro = new ResizeObserver(handleResize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [handleResize])

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden a4-miniature"
      style={{ aspectRatio: "210 / 297" }}
    >
      {scale > 0 && (
        <div
          style={{
            transformOrigin: "top left",
            transform: `scale(${scale})`,
            width: `${PAGE_WIDTH_PX}px`,
            height: `${PAGE_HEIGHT_PX}px`,
            overflow: "hidden",
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
