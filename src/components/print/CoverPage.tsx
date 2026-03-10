import {
  PAGE_WIDTH_MM,
  PAGE_HEIGHT_MM,
  MARGIN_TOP_MM,
  MARGIN_BOTTOM_MM,
  MARGIN_X_MM,
} from "@/lib/print/constants"
import { createElement } from "react"
import { DEFAULT_REGISTRY_NAME, getChapterIcon } from "@/lib/navigation"

interface CoverPageProps {
  chapterLabel: string
  chapterDescription?: string
  chapterIcon?: string
  classeurName?: string
  themed?: boolean
}

/** Page de garde du chapitre — pas de header ni footer, contenu centré */
export function CoverPage({ chapterLabel, chapterDescription, chapterIcon, classeurName = DEFAULT_REGISTRY_NAME, themed }: CoverPageProps) {
  return (
    <div
      className={themed ? "a4-page a4-page-themed bg-card text-card-foreground" : "a4-page"}
      style={{
        width: `${PAGE_WIDTH_MM}mm`,
        height: `${PAGE_HEIGHT_MM}mm`,
        padding: `${MARGIN_TOP_MM}mm ${MARGIN_X_MM}mm ${MARGIN_BOTTOM_MM}mm`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        ...(themed ? {} : { backgroundColor: "white", color: "#000" }),
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        boxSizing: "border-box",
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12mm" }}>
        {/* Logo */}
        {chapterIcon && createElement(getChapterIcon(chapterIcon), {
          width: 64,
          height: 64,
          style: { color: themed ? "hsl(var(--muted-foreground))" : "#666" },
        })}

        {/* Nom du classeur */}
        <span
          style={{
            fontSize: "14pt",
            fontWeight: 400,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: themed ? "hsl(var(--muted-foreground))" : "#666",
          }}
        >
          {classeurName}
        </span>

        {/* Filet décoratif */}
        <div
          style={{
            width: "60mm",
            height: "0.3mm",
            backgroundColor: themed ? "hsl(var(--border))" : "#999",
          }}
        />

        {/* Nom du chapitre */}
        <span
          style={{
            fontSize: "28pt",
            fontWeight: 700,
            lineHeight: 1.2,
            maxWidth: "160mm",
          }}
        >
          {chapterLabel}
        </span>

        {/* Description */}
        {chapterDescription && (
          <span
            style={{
              fontSize: "12pt",
              fontWeight: 400,
              color: themed ? "hsl(var(--muted-foreground))" : "#555",
              maxWidth: "140mm",
              lineHeight: 1.5,
            }}
          >
            {chapterDescription}
          </span>
        )}
      </div>
    </div>
  )
}
