import type { ChapterStatus } from "@/lib/navigation"

export interface Doc {
  id: number
  title: string
  description: string
  content: string
  chapter_id: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Periodicite {
  id: number
  label: string
  nombre: number
  sort_order: number
}

export interface TrackingSheet {
  id: number
  title: string
  chapter_id: string
  periodicite_id: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SignatureSheet {
  id: number
  title: string
  description: string
  chapter_id: string
  nombre: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Intercalaire {
  id: number
  title: string
  description: string
  chapter_id: string
  sort_order: number
  created_at: string
  updated_at: string
}

export type ChapterItem =
  | { kind: "document"; data: Doc }
  | { kind: "tracking_sheet"; data: TrackingSheet }
  | { kind: "signature_sheet"; data: SignatureSheet }
  | { kind: "intercalaire"; data: Intercalaire }

/** Calcule le statut d'un chapitre selon le nombre de documents */
export function computeStatus(docCount: number): ChapterStatus {
  return docCount >= 1 ? "conforme" : "a_verifier"
}

/** Configuration d'affichage des statuts */
export const statusConfig: Record<ChapterStatus, { label: string; className: string }> = {
  conforme:     { label: "Conforme",     className: "bg-status-success-bg text-status-success" },
  a_verifier:   { label: "À vérifier",   className: "bg-status-warning-bg text-status-warning" },
  non_conforme: { label: "Non conforme", className: "bg-status-danger-bg text-status-danger"   },
}

/** Formate une date en français court */
export function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch {
    return dateStr
  }
}
