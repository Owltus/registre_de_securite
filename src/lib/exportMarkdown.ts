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
 * Importe un classeur depuis un fichier .json (dialogue fichier).
 * Retourne l'ID du nouveau classeur, ou null si l'utilisateur a annulé.
 */
export async function importClasseur(): Promise<number | null> {
  const selected = await open({
    filters: [{ name: "JSON", extensions: ["json"] }],
    multiple: false,
  })

  if (!selected) return null

  const path = typeof selected === "string" ? selected : String(selected)
  return await invoke<number>("import_json_as_new_classeur", { path })
}

/**
 * Importe un fichier JSON comme nouveau classeur depuis des octets bruts (drag-and-drop).
 * Retourne l'ID du nouveau classeur.
 */
export async function importJsonAsNewClasseurFromBytes(data: ArrayBuffer): Promise<number> {
  const bytes = Array.from(new Uint8Array(data))
  return await invoke<number>("import_json_as_new_classeur_from_bytes", { data: bytes })
}

/** Résultat du merge JSON (miroir du struct Rust) */
export interface MergeResult {
  inserted: number
  updated: number
  unchanged: number
  skipped: number
}

/** Item de prévisualisation de merge */
export interface MergePreviewItem {
  action: "insert" | "update" | "unchanged" | "skip"
  kind: string
  title: string
  chapter_label: string
  detail: string
}

/** Résultat complet de la prévisualisation */
export interface MergePreview {
  items: MergePreviewItem[]
  total_insert: number
  total_update: number
  total_unchanged: number
  total_skip: number
  warnings: string[]
}

/** Entrée d'historique de merge */
export interface MergeHistoryEntry {
  id: number
  classeur_id: number
  merged_at: string
  source_name: string
  inserted: number
  updated: number
  unchanged: number
  skipped: number
}

/**
 * Ouvre un dialogue "Enregistrer sous" pour un fichier JSON, écrit le contenu, et retourne le chemin.
 * Retourne null si l'utilisateur a annulé.
 */
async function saveJsonToFile(defaultName: string, fetchContent: () => Promise<string>): Promise<string | null> {
  const filename = sanitizeFilename(defaultName) + ".json"

  const path = await save({
    defaultPath: filename,
    filters: [{ name: "JSON", extensions: ["json"] }],
  })

  if (!path) return null

  const content = await fetchContent()
  await invoke("write_file", { path, content })
  return path
}

/**
 * Exporte un classeur au format JSON lisible via le dialogue "Enregistrer sous".
 * Retourne le chemin du fichier créé, ou null si l'utilisateur a annulé.
 */
export async function exportClasseurJson(classeurName: string, classeurId: number): Promise<string | null> {
  return saveJsonToFile(classeurName || "Classeur", () => invoke<string>("export_classeur_json", { classeurId }))
}

/**
 * Ouvre un dialogue fichier et retourne le chemin sélectionné, ou null si annulé.
 */
export async function selectJsonFile(): Promise<string | null> {
  const selected = await open({
    filters: [{ name: "JSON", extensions: ["json"] }],
    multiple: false,
  })
  if (!selected) return null
  return typeof selected === "string" ? selected : String(selected)
}

/**
 * Prévisualise un merge JSON sans l'exécuter.
 */
export async function previewMergeJson(classeurId: number, path: string): Promise<MergePreview> {
  return invoke<MergePreview>("preview_merge_json", { classeurId, path })
}

/**
 * Importe un fichier JSON dans un classeur avec merge intelligent.
 */
export async function importClasseurJson(classeurId: number, path: string): Promise<MergeResult> {
  return invoke<MergeResult>("import_classeur_json", { classeurId, path })
}

/**
 * Récupère l'historique des merges d'un classeur.
 */
export async function getMergeHistory(classeurId: number): Promise<MergeHistoryEntry[]> {
  return invoke<MergeHistoryEntry[]>("get_merge_history", { classeurId })
}

/**
 * Restaure un merge en remplaçant les données actuelles par le snapshot.
 * Crée automatiquement un backup de l'état actuel s'il diffère du snapshot.
 */
export async function rollbackMerge(mergeId: number): Promise<void> {
  await invoke("rollback_merge", { mergeId })
}

/**
 * Supprime une entrée d'historique de merge (sans restauration).
 */
export async function deleteMergeEntry(mergeId: number): Promise<void> {
  await invoke("delete_merge_entry", { mergeId })
}

/**
 * Télécharge le snapshot JSON d'une entrée d'historique via un dialogue "Enregistrer sous".
 * Retourne le chemin du fichier créé, ou null si l'utilisateur a annulé.
 */
export async function downloadMergeSnapshot(mergeId: number, defaultName: string): Promise<string | null> {
  return saveJsonToFile(defaultName, () => invoke<string>("get_merge_snapshot", { mergeId }))
}

/** Nettoie un titre pour en faire un nom de fichier valide */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200)
}
