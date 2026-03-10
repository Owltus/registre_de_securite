import {
  PAGE_WIDTH_MM,
  PAGE_HEIGHT_MM,
  MARGIN_TOP_MM,
  MARGIN_BOTTOM_MM,
  MARGIN_X_MM,
} from "@/lib/print/constants"
import { createElement } from "react"
import { DEFAULT_REGISTRY_NAME, getChapterIcon } from "@/lib/navigation"

interface ClasseurCoverPageProps {
  classeurName?: string
  classeurIcon?: string
  etablissement?: string
  etablissementComplement?: string
  themed?: boolean
}

/** Page de garde générale du classeur — icône, nom, établissement, centré */
export function ClasseurCoverPage({
  classeurName = DEFAULT_REGISTRY_NAME,
  classeurIcon,
  etablissement,
  etablissementComplement,
  themed,
}: ClasseurCoverPageProps) {
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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10mm" }}>
        {/* Icône du classeur */}
        {classeurIcon && createElement(getChapterIcon(classeurIcon), {
          width: 72,
          height: 72,
          style: { color: themed ? "hsl(var(--muted-foreground))" : "#666" },
        })}

        {/* Nom du classeur */}
        <span
          style={{
            fontSize: "36pt",
            fontWeight: 700,
            lineHeight: 1.2,
            maxWidth: "160mm",
          }}
        >
          {classeurName}
        </span>

        {/* Filet décoratif */}
        <div
          style={{
            width: "80mm",
            height: "0.3mm",
            backgroundColor: themed ? "hsl(var(--border))" : "#999",
          }}
        />

        {/* Établissement */}
        {etablissement && (
          <span
            style={{
              fontSize: "14pt",
              fontWeight: 400,
              color: themed ? "hsl(var(--muted-foreground))" : "#555",
              maxWidth: "140mm",
              lineHeight: 1.5,
            }}
          >
            {etablissement}
          </span>
        )}

        {/* Complément */}
        {etablissementComplement && (
          <span
            style={{
              fontSize: "11pt",
              fontWeight: 400,
              color: themed ? "hsl(var(--muted-foreground))" : "#777",
              maxWidth: "140mm",
              lineHeight: 1.5,
            }}
          >
            {etablissementComplement}
          </span>
        )}
      </div>
    </div>
  )
}
