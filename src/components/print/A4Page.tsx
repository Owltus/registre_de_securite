import type { ReactNode } from "react"
import {
  PAGE_WIDTH_MM,
  PAGE_HEIGHT_MM,
  MARGIN_TOP_MM,
  MARGIN_BOTTOM_MM,
  MARGIN_X_MM,
  GAP_MM,
  SUBTITLE_HEIGHT_MM,
} from "@/lib/print/constants"
import { PageHeader } from "./PageHeader"
import { PageFooter } from "./PageFooter"

interface A4PageProps {
  title: string
  subtitle?: string
  children: ReactNode
  pageNumber?: number
  totalPages?: number
  chapterName?: string
  classeurName?: string
  establishment?: string
  /** Utiliser les CSS custom properties du thème (pour l'aperçu éditeur) */
  themed?: boolean
}

/**
 * Page A4 unique avec header, zone contenu et footer.
 * Marges : 10mm sur les 4 côtés.
 * Gap uniforme de 3mm entre chaque zone.
 * Le contenu ne peut jamais chevaucher le footer grâce au flex layout.
 */
export function A4Page({
  title,
  subtitle,
  children,
  pageNumber,
  totalPages,
  chapterName,
  classeurName,
  establishment,
  themed,
}: A4PageProps) {
  return (
    <div
      className={themed ? "a4-page a4-page-themed bg-card text-card-foreground" : "a4-page"}
      style={{
        width: `${PAGE_WIDTH_MM}mm`,
        height: `${PAGE_HEIGHT_MM}mm`,
        padding: `${MARGIN_TOP_MM}mm ${MARGIN_X_MM}mm ${MARGIN_BOTTOM_MM}mm`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        ...(themed ? {} : { backgroundColor: "white", color: "#000" }),
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        fontSize: "9pt",
        lineHeight: 1.6,
        boxSizing: "border-box",
      }}
    >
      <PageHeader title={title} />

      {/* Sous-titre — toujours présent si la prop est définie (même vide) */}
      {subtitle !== undefined && (
        <div
          className="dbg-subtitle"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: `${SUBTITLE_HEIGHT_MM}mm`,
            fontSize: "10pt",
            color: themed ? "hsl(var(--muted-foreground))" : "#555",
            flexShrink: 0,
          }}
        >
          {subtitle}
        </div>
      )}

      {/* Gap header → contenu */}
      <div className="dbg-gap" style={{ height: `${GAP_MM}mm`, flexShrink: 0 }} />

      {/* Zone contenu */}
      <div
        className="pdf-prose dbg-content"
        style={{
          flex: 1,
        }}
      >
        {children}
      </div>

      {/* Gap contenu → footer */}
      <div className="dbg-gap" style={{ height: `${GAP_MM}mm`, flexShrink: 0 }} />

      <PageFooter
        establishment={establishment}
        chapterName={chapterName}
        classeurName={classeurName}
        pageNumber={pageNumber}
        totalPages={totalPages}
        themed={themed}
      />
    </div>
  )
}
