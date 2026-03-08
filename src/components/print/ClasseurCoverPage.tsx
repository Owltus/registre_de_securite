import {
  PAGE_WIDTH_MM,
  PAGE_HEIGHT_MM,
  MARGIN_TOP_MM,
  MARGIN_BOTTOM_MM,
  MARGIN_X_MM,
} from "@/lib/print/constants"
import { DEFAULT_REGISTRY_NAME } from "@/lib/navigation"

interface ClasseurCoverPageProps {
  classeurName?: string
  themed?: boolean
}

/** Page de garde générale du classeur — nom centré, sans header ni footer */
export function ClasseurCoverPage({ classeurName = DEFAULT_REGISTRY_NAME, themed }: ClasseurCoverPageProps) {
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
      </div>
    </div>
  )
}
