import { buildPrintHtml } from "./buildPrintHtml"

/**
 * Impression via iframe caché.
 * Clone les pages A4 visibles dans l'aperçu dans un iframe temporaire,
 * copie les feuilles de style, puis appelle print() sur l'iframe.
 * Cela contourne les limitations du Dialog Radix (position fixed, flex, overflow)
 * qui empêchent window.print() d'afficher toutes les pages.
 */
export async function printViaIframe(scrollContainer: HTMLElement) {
  // Créer l'iframe caché
  const iframe = document.createElement("iframe")
  iframe.style.position = "fixed"
  iframe.style.left = "-9999px"
  iframe.style.top = "0"
  iframe.style.width = "0"
  iframe.style.height = "0"
  iframe.style.border = "none"
  document.body.appendChild(iframe)

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) return

    // Construire le HTML complet via la fonction partagée
    const html = await buildPrintHtml(scrollContainer)

    // Écrire dans l'iframe
    iframeDoc.open()
    iframeDoc.write(html)
    iframeDoc.close()

    // Attendre le chargement des polices, puis imprimer
    await iframeDoc.fonts.ready

    // Double rAF pour s'assurer que le layout est calculé
    iframe.contentWindow?.requestAnimationFrame(() => {
      iframe.contentWindow?.requestAnimationFrame(() => {
        iframe.contentWindow?.print()

        // Nettoyer après fermeture du dialog d'impression
        setTimeout(() => {
          if (iframe.parentNode) {
            document.body.removeChild(iframe)
          }
        }, 1000)
      })
    })
  } catch {
    // Nettoyer l'iframe en cas d'erreur
    if (iframe.parentNode) {
      document.body.removeChild(iframe)
    }
  }
}
