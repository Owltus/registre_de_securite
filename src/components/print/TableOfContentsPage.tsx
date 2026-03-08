import {
  PAGE_WIDTH_MM,
  PAGE_HEIGHT_MM,
  MARGIN_TOP_MM,
  MARGIN_BOTTOM_MM,
  MARGIN_X_MM,
  GAP_MM,
} from "@/lib/print/constants"
import { DEFAULT_REGISTRY_NAME, getChapterIcon } from "@/lib/navigation"

export interface ChapterEntry {
  number: number
  label: string
  icon: string
  items: string[]
}

interface TableOfContentsPageProps {
  chapters: ChapterEntry[]
  classeurName?: string
  themed?: boolean
}

/** Page sommaire du classeur — chapitres numérotés avec contenus, en deux colonnes */
export function TableOfContentsPage({ chapters, classeurName = DEFAULT_REGISTRY_NAME, themed }: TableOfContentsPageProps) {
  // Répartir en 2 colonnes équilibrées selon le poids visuel (1 par chapitre + 1 par item)
  const weights = chapters.map((ch) => 1 + ch.items.length)
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  let acc = 0
  let splitIndex = chapters.length
  for (let i = 0; i < chapters.length; i++) {
    acc += weights[i]
    if (acc >= totalWeight / 2) {
      splitIndex = i + 1
      break
    }
  }

  const left = chapters.slice(0, splitIndex)
  const right = chapters.slice(splitIndex)

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
      {/* Titre */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          gap: "1.5mm",
          paddingTop: "2mm",
          paddingBottom: "2mm",
        }}
      >
        <span
          style={{
            fontSize: "14pt",
            fontWeight: 700,
            letterSpacing: "0.03em",
            textTransform: "uppercase",
          }}
        >
          Sommaire
        </span>
        <span
          style={{
            fontSize: "9pt",
            fontWeight: 400,
            color: themed ? "hsl(var(--muted-foreground))" : "#666",
          }}
        >
          {classeurName}
        </span>
      </div>

      {/* Filet sous le titre */}
      <div
        style={{
          height: "0.3mm",
          backgroundColor: themed ? "hsl(var(--border))" : "#000",
          flexShrink: 0,
        }}
      />

      {/* Gap */}
      <div style={{ height: `${GAP_MM * 2}mm`, flexShrink: 0 }} />

      {/* Contenu en 2 colonnes */}
      <div
        style={{
          flex: 1,
          display: "flex",
          gap: "8mm",
        }}
      >
        <Column entries={left} themed={themed} />
        <Column entries={right} themed={themed} />
      </div>
    </div>
  )
}

function Column({ entries, themed }: { entries: ChapterEntry[]; themed?: boolean }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6mm" }}>
      {entries.map((ch) => (
        <div
          key={ch.number}
          style={{
            display: "flex",
            gap: "4mm",
          }}
        >
          {/* Numéro */}
          <span
            style={{
              fontSize: "18pt",
              fontWeight: 700,
              lineHeight: 1,
              color: themed ? "hsl(var(--muted-foreground))" : "#888",
              flexShrink: 0,
              width: "10mm",
              textAlign: "right",
              paddingTop: "0.5mm",
            }}
          >
            {String(ch.number).padStart(2, "0")}
          </span>

          {/* Séparateur vertical */}
          <div
            style={{
              width: "0.3mm",
              alignSelf: "stretch",
              backgroundColor: themed ? "hsl(var(--border))" : "#ccc",
              flexShrink: 0,
            }}
          />

          {/* Label + items */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5mm", minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "2mm" }}>
              {(() => {
                const Icon = getChapterIcon(ch.icon)
                return <Icon width={14} height={14} style={{ flexShrink: 0, color: themed ? "hsl(var(--muted-foreground))" : "#666" }} />
              })()}
              <span
                style={{
                  fontSize: "10pt",
                  fontWeight: 600,
                  lineHeight: 1.3,
                }}
              >
                {ch.label}
              </span>
            </div>

            {ch.items.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1mm", paddingLeft: "2mm" }}>
                {ch.items.map((title, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      gap: "2mm",
                      fontSize: "8pt",
                      lineHeight: 1.4,
                      color: themed ? "hsl(var(--muted-foreground))" : "#555",
                    }}
                  >
                    <span style={{ flexShrink: 0, color: themed ? "hsl(var(--muted-foreground))" : "#888" }}>
                      –
                    </span>
                    <span>{title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
