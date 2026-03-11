import { icons, type LucideIcon } from "lucide-react"

/** Nom par défaut du classeur — modifiable par l'utilisateur via les préférences */
export const DEFAULT_REGISTRY_NAME = "Mon classeur"

/** Item de navigation générique — utilisé par le composant NavItem */
export interface NavItemData {
  id: string
  path: string
  label: string
  icon: LucideIcon
  /** Nom de l'icône (string) — utilisé pour le DragOverlay */
  iconName: string
}

/** Statut de conformité d'un chapitre */
export type ChapterStatus = "conforme" | "a_verifier" | "non_conforme"

/** Ligne de la table `classeurs` en base de données */
export interface ClasseurRow {
  id: number
  name: string
  icon: string
  etablissement: string
  etablissement_complement: string
  sort_order: number
  created_at: string
}

/** Ligne de la table `chapters` en base de données */
export interface ChapterRow {
  id: number
  label: string
  icon: string
  description: string
  sort_order: number
  classeur_id: number
  created_at: string
}

/** Bibliothèque complète des icônes Lucide (1600+) */
export const iconMap = icons as Record<string, LucideIcon>

/** Liste des entrées [nom, composant] — calculée une seule fois */
export const iconEntries = Object.entries(iconMap) as [string, LucideIcon][]

/** Récupère le composant Lucide correspondant au nom, avec fallback sur FileText */
export function getChapterIcon(name: string): LucideIcon {
  return iconMap[name] ?? icons.FileText
}

/** Construit la string d'établissement pour le footer d'impression */
export function buildEstablishment(classeur: ClasseurRow | null | undefined): string {
  if (!classeur) return ""
  const lines = [classeur.etablissement, classeur.etablissement_complement].filter(Boolean)
  return lines.join("\n")
}
