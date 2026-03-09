/**
 * Constantes de mise en page A4 pour le système d'impression.
 * Toutes les dimensions sont en mm.
 *
 * Layout vertical (297mm) :
 *   Marge haute       10mm
 *   Header (titre)    12mm
 *   Gap                3mm
 *   ── Contenu ──     flex (≈248mm documents, ≈236mm feuilles de suivi)
 *   Gap                3mm
 *   Pagination         3mm
 *   Gap                3mm
 *   Filet              0.15mm
 *   Espacement         2.5mm
 *   Footer (3 cols)    8mm
 *   Marge basse       10mm
 *
 * Layout horizontal (210mm) :
 *   Marge gauche      10mm
 *   ── Contenu ──     190mm
 *   Marge droite      10mm
 */

/** Dimensions de la page A4 */
export const PAGE_WIDTH_MM = 210
export const PAGE_HEIGHT_MM = 297

/** Marges extérieures (identiques sur les 4 côtés) */
export const MARGIN_TOP_MM = 10
export const MARGIN_BOTTOM_MM = 10
export const MARGIN_X_MM = 10

/** Zone de contenu (largeur exploitable) */
export const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_X_MM * 2 // 190mm

/** Header : titre centré */
export const HEADER_HEIGHT_MM = 12

/** Gap uniforme entre les zones */
export const GAP_MM = 3

/** Footer : pagination + filet + espacement + 3 colonnes */
export const FOOTER_RULE_MM = 0.15
export const FOOTER_RULE_GAP_MM = 1.5  // espacement filet → contenu footer
export const FOOTER_HEIGHT_MM = 8
export const PAGINATION_HEIGHT_MM = 3

/** Zone contenu documents (entre header et footer) */
export const CONTENT_HEIGHT_MM =
  PAGE_HEIGHT_MM -
  MARGIN_TOP_MM -
  HEADER_HEIGHT_MM -
  GAP_MM -              // gap header → contenu
  GAP_MM -              // gap contenu → pagination
  PAGINATION_HEIGHT_MM -
  GAP_MM -              // gap pagination → filet
  FOOTER_RULE_MM -
  FOOTER_RULE_GAP_MM -  // espacement filet → contenu footer
  FOOTER_HEIGHT_MM -
  MARGIN_BOTTOM_MM
// ≈ 242.35mm

/** Sous-titre (feuilles de suivi uniquement) */
export const SUBTITLE_HEIGHT_MM = 7

/** Zone contenu feuilles de suivi (réduite par le sous-titre + gap) */
export const TRACKING_CONTENT_HEIGHT_MM =
  CONTENT_HEIGHT_MM - SUBTITLE_HEIGHT_MM - GAP_MM

/** Établissement par défaut */
export const DEFAULT_ESTABLISHMENT = "Okko Hotels\nNantes Centre-ville"
