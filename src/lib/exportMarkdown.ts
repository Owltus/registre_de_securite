import { save, open } from "@tauri-apps/plugin-dialog"
import { invoke } from "@tauri-apps/api/core"
import JSZip from "jszip"

/**
 * Exporte du contenu markdown vers un fichier .md via le dialogue "Enregistrer sous".
 * Retourne le chemin du fichier créé, ou null si l'utilisateur a annulé.
 */
export async function exportMarkdown(title: string, content: string): Promise<string | null> {
  const filename = sanitizeFilename(title || "Sans titre") + ".md"

  const path = await save({
    defaultPath: filename,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  })

  if (!path) return null

  await invoke("write_file", { path, content })
  return path
}

/** Données d'un chapitre pour l'export zip */
export interface ExportChapter {
  label: string
  sortOrder: number
  documents: { title: string; content: string }[]
}

/**
 * Exporte un classeur complet en .zip :
 * un dossier par chapitre, un fichier .md par document.
 */
export async function exportClasseurZip(classeurName: string, chapters: ExportChapter[]): Promise<string | null> {
  const zipName = sanitizeFilename(classeurName || "Classeur") + ".zip"

  const path = await save({
    defaultPath: zipName,
    filters: [{ name: "Archive ZIP", extensions: ["zip"] }],
  })

  if (!path) return null

  const zip = new JSZip()

  for (const ch of chapters) {
    const folderName = sanitizeFilename(`${ch.sortOrder} - ${ch.label}`)
    const folder = zip.folder(folderName)!

    for (const doc of ch.documents) {
      const fileName = sanitizeFilename(doc.title || "Sans titre") + ".md"
      folder.file(fileName, doc.content)
    }
  }

  const blob = await zip.generateAsync({ type: "uint8array" })

  // Convertir en tableau de nombres pour passer via invoke
  await invoke("write_file_binary", { path, data: Array.from(blob) })
  return path
}

/**
 * Exporte la base de données SQLite via le dialogue "Enregistrer sous".
 * Le checkpoint WAL est exécuté côté Rust avant la copie pour garantir
 * que les fichiers -wal et -shm sont consolidés dans le .db.
 */
export async function exportDatabase(classeurName: string, classeurId: number): Promise<string | null> {
  const filename = sanitizeFilename(classeurName || "Classeur") + ".db"

  const path = await save({
    defaultPath: filename,
    filters: [{ name: "Base de données SQLite", extensions: ["db"] }],
  })

  if (!path) return null

  await invoke("export_database", { dest: path, classeurId })
  return path
}

/**
 * Importe un classeur depuis un fichier .db exporté.
 * Retourne l'ID du nouveau classeur, ou null si l'utilisateur a annulé.
 */
export async function importDatabase(): Promise<number | null> {
  const selected = await open({
    filters: [{ name: "Base de données SQLite", extensions: ["db"] }],
    multiple: false,
  })

  if (!selected) return null

  const path = typeof selected === "string" ? selected : String(selected)
  const newId = await invoke<number>("import_database", { source: path })
  return newId
}

/**
 * Importe un classeur depuis des octets bruts (drag-and-drop).
 * Retourne l'ID du nouveau classeur, ou null en cas d'erreur.
 */
export async function importDatabaseFromBytes(data: ArrayBuffer): Promise<number | null> {
  const bytes = Array.from(new Uint8Array(data))
  const newId = await invoke<number>("import_database_from_bytes", { data: bytes })
  return newId
}

/** Nettoie un titre pour en faire un nom de fichier valide */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200)
}
