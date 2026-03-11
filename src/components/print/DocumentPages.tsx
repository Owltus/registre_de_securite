import React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { usePagination, getContentWidthPx } from "@/lib/print/usePagination"
import { preprocessPageBreaks, PAGEBREAK_MARKER } from "@/lib/print/preprocessPageBreaks"
import { MermaidBlock } from "@/components/MermaidBlock"
import { A4Page } from "./A4Page"

interface DocumentPagesProps {
  title: string
  subtitle?: string
  content: string
  chapterName?: string
  classeurName?: string
  establishment?: string
  /** Masquer la numérotation des pages (pour impression de masse) */
  hidePagination?: boolean
  /** Utiliser les CSS custom properties du thème (pour l'aperçu éditeur) */
  themed?: boolean
}

/** Vérifie si tous les enfants textuels d'un nœud React sont vides */
function isEmptyHeader(children: React.ReactNode): boolean {
  const arr = React.Children.toArray(children)
  return arr.every((child) => {
    if (typeof child === "string" || typeof child === "number") return String(child).trim() === ""
    if (React.isValidElement<{ children?: React.ReactNode }>(child)) return isEmptyHeader(child.props.children)
    return true
  })
}

/** Composants custom pour ReactMarkdown (sauts de page + Mermaid + thead vide) */
const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => {
    const text = React.Children.toArray(children)
    if (text.length === 1 && typeof text[0] === "string" && text[0].trim() === PAGEBREAK_MARKER) {
      return <div data-page-break="true" />
    }
    return <p>{children}</p>
  },
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    if (className === "language-mermaid") {
      return <MermaidBlock code={String(children).trim()} />
    }
    return <code className={className}>{children}</code>
  },
  thead: ({ children }: { children?: React.ReactNode }) => {
    if (isEmptyHeader(children)) return null
    return <thead>{children}</thead>
  },
}

/**
 * Rend un document Markdown en N pages A4.
 * Phase 1 : mesure dans un conteneur caché → découpage en pages.
 * Phase 2 : rendu du HTML extrait de chaque page dans un <A4Page>.
 */
export function DocumentPages({ title, subtitle, content, chapterName, classeurName, establishment, hidePagination, themed }: DocumentPagesProps) {
  const processedContent = preprocessPageBreaks(content)
  const { pages, measuring, measureRef } = usePagination(processedContent)

  const contentWidthPx = getContentWidthPx()

  return (
    <>
      {/* Conteneur de mesure caché — même styles que pdf-prose, même largeur */}
      <div
        ref={measureRef}
        className="pdf-prose"
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          width: `${contentWidthPx}px`,
          visibility: "hidden",
          fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
          fontSize: "9pt",
          lineHeight: 1.6,
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>
          {processedContent}
        </ReactMarkdown>
      </div>

      {/* Pages A4 */}
      {!measuring && pages.map((page, i) => (
        <A4Page
          key={i}
          title={title}
          subtitle={subtitle}
          pageNumber={hidePagination ? undefined : i + 1}
          totalPages={hidePagination ? undefined : pages.length}
          chapterName={chapterName}
          classeurName={classeurName}
          establishment={establishment}
          themed={themed}
        >
          <div dangerouslySetInnerHTML={{ __html: page.html }} />
        </A4Page>
      ))}

      {/* Spinner pendant la mesure */}
      {measuring && (
        <div className="flex items-center justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      )}
    </>
  )
}
