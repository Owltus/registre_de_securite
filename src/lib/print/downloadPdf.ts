import { save } from "@tauri-apps/plugin-dialog"
import { invoke } from "@tauri-apps/api/core"
import { buildPrintHtml } from "./buildPrintHtml"

/**
 * Génère un vrai PDF vectoriel (texte sélectionnable) via Edge/Chrome headless.
 * 1. Dialogue de sauvegarde natif
 * 2. Construction du HTML autonome
 * 3. Appel au backend Rust qui délègue à Edge headless --print-to-pdf
 */
export async function downloadPdf(
  scrollContainer: HTMLElement,
  filename = "document.pdf",
): Promise<void> {
  // Dialogue de sauvegarde natif
  const outputPath = await save({
    defaultPath: filename,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  })
  if (!outputPath) return // annulé par l'utilisateur

  // Construire le HTML complet
  const html = await buildPrintHtml(scrollContainer)

  // Générer le PDF via le backend Rust
  await invoke("generate_pdf", { html, outputPath })
}
