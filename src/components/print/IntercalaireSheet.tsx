import {
  PAGE_WIDTH_MM,
  PAGE_HEIGHT_MM,
  MARGIN_TOP_MM,
  MARGIN_BOTTOM_MM,
  MARGIN_X_MM,
  GAP_MM,
} from "@/lib/print/constants"
import { DEFAULT_REGISTRY_NAME } from "@/lib/navigation"
import { PageFooter } from "./PageFooter"

interface IntercalaireSheetProps {
  title: string
  description?: string
  chapterName?: string
  classeurName?: string
  establishment?: string
  themed?: boolean
}

/**
 * Intercalaire — page A4 avec titre et description centrés, et footer.
 * Destinée à être placée devant des documents externes dans le classeur physique.
 */
export function IntercalaireSheet({
  title,
  description,
  chapterName,
  classeurName = DEFAULT_REGISTRY_NAME,
  establishment,
  themed,
}: IntercalaireSheetProps) {
  const textColor = themed ? "hsl(var(--card-foreground))" : "#000"
  const mutedColor = themed ? "hsl(var(--muted-foreground))" : "#666"

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
        boxSizing: "border-box",
      }}
    >
      {/* Contenu centré */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: "6mm",
        }}
      >
        <span
          style={{
            fontSize: "22pt",
            fontWeight: 700,
            lineHeight: 1.3,
            maxWidth: "150mm",
            color: textColor,
          }}
        >
          {title}
        </span>

        {description && (
          <span
            style={{
              fontSize: "11pt",
              fontWeight: 400,
              color: mutedColor,
              maxWidth: "130mm",
              lineHeight: 1.6,
              whiteSpace: "pre-line",
            }}
          >
            {description}
          </span>
        )}
      </div>

      {/* Gap contenu → footer */}
      <div style={{ height: `${GAP_MM}mm`, flexShrink: 0 }} />

      <PageFooter
        establishment={establishment}
        chapterName={chapterName}
        classeurName={classeurName}
        themed={themed}
      />
    </div>
  )
}
