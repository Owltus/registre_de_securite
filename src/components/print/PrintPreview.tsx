import { useRef, type ReactNode } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X, Printer, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { printViaIframe } from "@/lib/print/printIframe"
import { downloadPdf } from "@/lib/print/downloadPdf"
import { toast } from "sonner"

interface PrintPreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  /** Nom du fichier PDF (sans extension). Par défaut "document". */
  filename?: string
}

/**
 * Modale d'aperçu avant impression.
 * Affiche les pages A4 avec ombre dans un dialog scrollable.
 * L'impression utilise un iframe caché pour contourner les limitations
 * du Dialog Radix (position fixed, flex, overflow).
 */
export function PrintPreview({ open, onOpenChange, children, filename = "document" }: PrintPreviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const handlePrint = async () => {
    if (scrollRef.current) {
      await printViaIframe(scrollRef.current)
    }
  }

  const handleDownload = async () => {
    if (!scrollRef.current) return
    try {
      await downloadPdf(scrollRef.current, `${filename}.pdf`)
      toast.success("PDF enregistré avec succès")
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error("Erreur lors de la génération du PDF", { description: message })
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[95vw] h-[92vh] border bg-background shadow-lg rounded-lg flex flex-col overflow-hidden focus:outline-none"
          style={{ maxWidth: "880px" }}
          aria-describedby={undefined}
        >
          {/* Header */}
          <div className="print-toolbar flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
            <Dialog.Title className="text-sm font-semibold">
              Aperçu avant impression
            </Dialog.Title>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleDownload}
                    aria-label="Télécharger en PDF"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Télécharger en PDF</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handlePrint}
                    aria-label="Imprimer"
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Imprimer</TooltipContent>
              </Tooltip>
              <Dialog.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
          </div>

          {/* Zone scrollable avec les pages A4 */}
          <div ref={scrollRef} className="print-preview-scroll flex-1 overflow-y-auto p-6 bg-muted/50">
            <div className="flex flex-col items-center gap-6">
              {children}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
