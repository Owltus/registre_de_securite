import { useEffect, useState } from "react"
import { renderMermaid, useDarkMode } from "@/lib/mermaid"

/**
 * Nettoie un SVG en supprimant les balises <script> et les attributs
 * d'événements (on*) pour prévenir les attaques XSS.
 */
function sanitizeSvg(raw: string): string {
  // Supprimer les balises <script>...</script> et <script ... />
  let cleaned = raw.replace(/<script[\s\S]*?<\/script\s*>/gi, "")
  cleaned = cleaned.replace(/<script[\s\S]*?\/?>/gi, "")
  // Supprimer les attributs on* (onclick, onerror, onload, etc.)
  cleaned = cleaned.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
  // Supprimer les href/xlink:href javascript:
  cleaned = cleaned.replace(/\s+(href|xlink:href)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, "")
  return cleaned
}

/**
 * Composant qui rend un diagramme Mermaid en SVG.
 * Re-génère le SVG automatiquement quand le thème change.
 * Expose un attribut `data-mermaid-status` pour que la pagination
 * puisse attendre que tous les diagrammes soient prêts.
 */
export function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null)
  const isDark = useDarkMode()

  useEffect(() => {
    let cancelled = false
    renderMermaid(code, isDark)
      .then((result) => { if (!cancelled) setSvg(sanitizeSvg(result)) })
      .catch(() => { if (!cancelled) setSvg(null) })
    return () => { cancelled = true }
  }, [code, isDark])

  if (!svg) {
    return (
      <div
        data-mermaid-status="pending"
        className="flex items-center justify-center py-4"
        role="status"
        aria-label="Chargement"
      >
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    )
  }

  return (
    <div
      data-mermaid-status="rendered"
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{ textAlign: "center" }}
    />
  )
}
