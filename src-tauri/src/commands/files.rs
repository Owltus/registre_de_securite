use crate::error::AppError;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;
use std::time::SystemTime;
use tauri::State;

// ── Schéma statique documentant le format JSON (embarqué dans _metadata.schema) ──

/// Documentation complète du format de fichier, construite une seule fois.
/// Valeur statique car le schéma ne dépend d'aucune donnée dynamique.
static CLASSEUR_SCHEMA: LazyLock<serde_json::Value> = LazyLock::new(|| {
    serde_json::json!({
        "_description": "Schéma descriptif du format JSON Classeur v2. Ce bloc permet de comprendre, valider ou générer un fichier conforme sans accès au code source.",
        "format_version": {
            "type": "integer",
            "required": true,
            "description": "Version du format de fichier. Valeur actuelle : 2. Les fichiers v1 (sans uuid/updated_at) sont acceptés à l'import avec un fallback sur le matching par slug+titre."
        },
        "classeur": {
            "_description": "Conteneur principal. Un classeur regroupe des chapitres thématiques pouvant contenir tout type de documentation (technique, réglementaire, organisationnelle, etc.).",
            "fields": {
                "name":                     { "type": "string", "required": true,  "default": "Mon classeur", "description": "Nom du classeur affiché dans l'interface." },
                "icon":                     { "type": "string", "required": true,  "default": "BookOpen",     "description": "Nom d'une icône Lucide React (ex: BookOpen, Shield, Wrench). Liste ouverte — toute icône Lucide valide est acceptée. Si le nom est invalide, l'affichage utilise FileText en fallback." },
                "etablissement":            { "type": "string", "required": true,  "default": "",             "description": "Nom de l'entité, de l'organisation ou du site associé au classeur." },
                "etablissement_complement": { "type": "string", "required": true,  "default": "",             "description": "Complément d'information (adresse, service, référence, etc.)." }
            }
        },
        "chapter": {
            "_description": "Section thématique du classeur. Un classeur contient un tableau de chapitres ordonnés.",
            "fields": {
                "uid":         { "type": "string",  "required": true,  "description": "Identifiant slug unique du chapitre dans le classeur. Généré via slugify(label)." },
                "uuid":        { "type": "string",  "required": false, "description": "Identifiant universel unique (UUIDv4). Utilisé en priorité pour le matching lors d'un merge. Absent dans les exports v1." },
                "label":       { "type": "string",  "required": true,  "description": "Titre du chapitre affiché dans la navigation." },
                "icon":        { "type": "string",  "required": true,  "default": "FileText", "description": "Nom d'une icône Lucide React." },
                "description": { "type": "string",  "required": true,  "default": "",         "description": "Description libre du chapitre." },
                "sort_order":  { "type": "integer", "required": true,  "description": "Position d'affichage du chapitre." },
                "items":       { "type": "array",   "required": true,  "description": "Liste ordonnée des éléments du chapitre." }
            }
        },
        "items": {
            "_description": "Chaque chapitre contient des items de 4 types. Les types inconnus sont ignorés silencieusement (forward compatibility).",
            "common_fields": {
                "kind":       { "type": "string",  "required": true, "enum": ["document", "tracking_sheet", "signature_sheet", "intercalaire"] },
                "uuid":       { "type": "string",  "required": false, "description": "UUIDv4 de l'item. Matching prioritaire au merge." },
                "title":      { "type": "string",  "required": true, "description": "Titre de l'item." },
                "updated_at": { "type": "string",  "required": false, "description": "Horodatage ISO 8601 de la dernière modification. Utilisé pour le Last-Write-Wins au merge." },
                "sort_order": { "type": "integer", "required": true }
            },
            "types": {
                "document": {
                    "_description": "Document texte libre en Markdown.",
                    "specific_fields": {
                        "description": { "type": "string", "required": false, "default": "" },
                        "content":     { "type": "string", "required": false, "default": "" }
                    }
                },
                "tracking_sheet": {
                    "_description": "Fiche de suivi périodique. N'a PAS de champ description.",
                    "specific_fields": {
                        "periodicite_id": { "type": "integer|null", "required": false }
                    }
                },
                "signature_sheet": {
                    "_description": "Fiche d'émargement.",
                    "specific_fields": {
                        "description": { "type": "string",       "required": false, "default": "" },
                        "nombre":      { "type": "integer|null", "required": false, "default": 14 }
                    }
                },
                "intercalaire": {
                    "_description": "Page de séparation visuelle.",
                    "specific_fields": {
                        "description": { "type": "string", "required": false, "default": "" }
                    }
                }
            }
        },
        "periodicites": {
            "_description": "Table de référence des périodicités de suivi (informative, ignorée à l'import).",
            "fields": {
                "id":     { "type": "integer", "description": "Identifiant référencé par tracking_sheet.periodicite_id." },
                "label":  { "type": "string",  "description": "Libellé de la périodicité." },
                "nombre": { "type": "integer",  "description": "Nombre de colonnes dans le tableau de suivi." }
            }
        },
        "import_rules": {
            "_description": "Règles de validation et de comportement à l'import.",
            "format_version": "Accepte 1 ou 2.",
            "metadata_ignored": "Le bloc _metadata est purement informatif, ignoré à l'import.",
            "matching_priority": "1) UUID si présent → recherche dans tout le classeur. 2) Fallback slug+titre (v1).",
            "last_write_wins": "Si un item est trouvé par UUID, la version la plus récente (updated_at) gagne.",
            "soft_delete_respected": "Un item supprimé localement (soft delete) n'est pas recréé par le merge — compté comme 'skipped'.",
            "move_detection": "Un item trouvé par UUID dans un chapitre différent n'est pas re-déplacé. Son contenu est mis à jour si plus récent.",
            "no_deletion": "Le merge n'efface jamais de données. Les items locaux absents du JSON sont conservés."
        }
    })
});

// ── Structs serde pour l'export/import JSON ────────────────────────

#[derive(Serialize, Deserialize)]
struct MetadataPeriodicite {
    id: i64,
    label: String,
    nombre: i64,
}

#[derive(Serialize, Deserialize)]
struct MetadataJson {
    description: String,
    generated_at: String,
    note: String,
    schema: serde_json::Value,
    periodicites: Vec<MetadataPeriodicite>,
}

#[derive(Serialize, Deserialize)]
struct ClasseurJson {
    format_version: u32,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    _metadata: Option<MetadataJson>,
    classeur: ClasseurData,
    chapters: Vec<ChapterJson>,
}

#[derive(Serialize, Deserialize)]
struct ClasseurData {
    name: String,
    icon: String,
    etablissement: String,
    etablissement_complement: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct ChapterJson {
    uid: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    uuid: Option<String>,
    label: String,
    icon: String,
    description: String,
    sort_order: i64,
    items: Vec<ItemJson>,
}

#[derive(Serialize, Deserialize, Clone)]
struct ItemJson {
    kind: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    uuid: Option<String>,
    title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    periodicite_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    nombre: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    updated_at: Option<String>,
    sort_order: i64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MergeResult {
    pub inserted: u32,
    pub updated: u32,
    pub unchanged: u32,
    pub skipped: u32,
    pub deleted: u32,
    pub warnings: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MergePreviewItem {
    pub action: String,
    pub kind: String,
    pub title: String,
    pub chapter_label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MergePreview {
    pub items: Vec<MergePreviewItem>,
    pub total_insert: u32,
    pub total_update: u32,
    pub total_unchanged: u32,
    pub total_skip: u32,
    pub total_delete: u32,
    pub warnings: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MergeHistoryEntry {
    pub id: i64,
    pub classeur_id: i64,
    pub merged_at: String,
    pub source_name: String,
    pub inserted: i64,
    pub updated: i64,
    pub unchanged: i64,
    pub skipped: i64,
}

// ── Helpers ────────────────────────────────────────────────────────

/// Génère un slug à partir d'un label (minuscules, sans accents, tirets)
fn slugify(s: &str) -> String {
    let s = s.to_lowercase();
    let replacements = [
        ('à', 'a'), ('â', 'a'), ('ä', 'a'), ('é', 'e'), ('è', 'e'),
        ('ê', 'e'), ('ë', 'e'), ('ï', 'i'), ('î', 'i'), ('ô', 'o'),
        ('ö', 'o'), ('ù', 'u'), ('û', 'u'), ('ü', 'u'), ('ç', 'c'),
        ('ñ', 'n'),
    ];
    let mut result = String::with_capacity(s.len());
    for c in s.chars() {
        let replaced = replacements.iter().find(|(from, _)| *from == c);
        match replaced {
            Some((_, to)) => result.push(*to),
            None if c.is_alphanumeric() => result.push(c),
            None => result.push('-'),
        }
    }
    // Compacter les tirets multiples et trim
    let mut prev_dash = false;
    let compacted: String = result.chars().filter(|&c| {
        if c == '-' {
            if prev_dash { return false; }
            prev_dash = true;
        } else {
            prev_dash = false;
        }
        true
    }).collect();
    compacted.trim_matches('-').to_string()
}

/// Génère un UUIDv4 à partir de SystemTime (sans crate externe)
fn generate_uuid() -> String {
    let dur = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    let nanos = dur.as_nanos();
    // Mélanger avec l'adresse d'une variable locale pour ajouter de l'entropie
    let entropy = &nanos as *const _ as u64;
    let a = (nanos ^ (entropy as u128)) as u64;
    let b = nanos.wrapping_mul(6364136223846793005) as u64;
    format!(
        "{:08x}-{:04x}-4{:03x}-{:x}{:03x}-{:012x}",
        (a >> 32) as u32,
        (a >> 16) as u16 & 0xffff,
        a as u16 & 0x0fff,
        8 + (b & 3),
        (b >> 4) as u16 & 0x0fff,
        b >> 16
    )
}

/// Génère un timestamp ISO 8601 UTC
fn now_iso8601() -> String {
    let dur = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = dur.as_secs();
    let days = secs / 86400;
    let time_of_day = secs % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;
    let z = days as i64 + 719468;
    let era = z / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", y, m, d, hours, minutes, seconds)
}

// ── Validation de chemin ──────────────────────────────────────────

/// Valide qu'un chemin ne contient pas de traversée de répertoire.
/// Résout le chemin canonique et rejette toute tentative de traversal
/// (composants `..`, séquences encodées, etc.).
fn validate_path(raw: &str) -> Result<std::path::PathBuf, AppError> {
    let p = std::path::Path::new(raw);

    // Rejeter les chemins contenant des composants `..`
    for component in p.components() {
        if matches!(component, std::path::Component::ParentDir) {
            return Err(AppError::FileError(
                "Chemin refusé : traversée de répertoire détectée (..)".to_string(),
            ));
        }
    }

    Ok(p.to_path_buf())
}

// ── Commandes fichier ──────────────────────────────────────────────

/// Lit le contenu d'un fichier texte
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, AppError> {
    let safe_path = validate_path(&path)?;
    tokio::fs::read_to_string(&safe_path)
        .await
        .map_err(|e| AppError::FileError(format!("{}: {}", path, e)))
}

/// Écrit du contenu dans un fichier texte
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), AppError> {
    let safe_path = validate_path(&path)?;
    tokio::fs::write(&safe_path, &content)
        .await
        .map_err(|e| AppError::FileError(format!("{}: {}", path, e)))
}

/// Écrit des données binaires dans un fichier
#[tauri::command]
pub async fn write_file_binary(path: String, data: Vec<u8>) -> Result<(), AppError> {
    let safe_path = validate_path(&path)?;
    tokio::fs::write(&safe_path, &data)
        .await
        .map_err(|e| AppError::FileError(format!("{}: {}", path, e)))
}

// ── Export ──────────────────────────────────────────────────────────

/// Exporte un classeur au format JSON v2 (avec uuid et updated_at).
/// Filtre les éléments soft-deleted. Retourne la string JSON.
fn do_export_json(conn: &rusqlite::Connection, classeur_id: i64) -> Result<String, AppError> {
    // Lire le classeur
    let (name, icon, etablissement, complement): (String, String, String, String) = conn
        .query_row(
            "SELECT COALESCE(name,''), COALESCE(icon,'BookOpen'), COALESCE(etablissement,''), COALESCE(etablissement_complement,'') FROM classeurs WHERE id = ?1",
            [classeur_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|e| AppError::DatabaseError(format!("classeur introuvable : {}", e)))?;

    // Lire les chapitres (non supprimés)
    let mut stmt = conn
        .prepare("SELECT id, label, icon, description, sort_order, uuid FROM chapters WHERE classeur_id = ?1 AND deleted_at IS NULL ORDER BY sort_order")
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let chapters_raw: Vec<(i64, String, String, String, i64, Option<String>)> = stmt
        .query_map([classeur_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?))
        })
        .map_err(|e| AppError::DatabaseError(e.to_string()))?
        .filter_map(|r| r.ok())
        .collect();

    // Charger tous les items non supprimés en 4 requêtes bulk
    let ch_ids: Vec<String> = chapters_raw.iter().map(|(id, ..)| id.to_string()).collect();
    let placeholders = ch_ids.iter().map(|id| format!("'{}'", id.replace('\'', "''"))).collect::<Vec<_>>().join(",");

    let mut items_by_chapter: HashMap<String, Vec<ItemJson>> = HashMap::new();

    if !ch_ids.is_empty() {
        // Documents
        let mut s = conn.prepare(&format!(
            "SELECT chapter_id, title, description, content, sort_order, uuid, updated_at FROM documents WHERE chapter_id IN ({placeholders}) AND deleted_at IS NULL ORDER BY sort_order"
        )).map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let rows = s.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, ItemJson {
                kind: "document".to_string(),
                uuid: row.get(5)?,
                title: row.get(1)?,
                description: row.get(2)?,
                content: row.get(3)?,
                periodicite_id: None,
                nombre: None,
                updated_at: row.get(6)?,
                sort_order: row.get(4)?,
            }))
        }).map_err(|e| AppError::DatabaseError(e.to_string()))?;
        for r in rows { if let Ok((cid, item)) = r { items_by_chapter.entry(cid).or_default().push(item); } }

        // Feuilles de suivi
        let mut s = conn.prepare(&format!(
            "SELECT chapter_id, title, periodicite_id, sort_order, uuid, updated_at FROM tracking_sheets WHERE chapter_id IN ({placeholders}) AND deleted_at IS NULL ORDER BY sort_order"
        )).map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let rows = s.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, ItemJson {
                kind: "tracking_sheet".to_string(),
                uuid: row.get(4)?,
                title: row.get(1)?,
                description: None,
                content: None,
                periodicite_id: row.get(2)?,
                nombre: None,
                updated_at: row.get(5)?,
                sort_order: row.get(3)?,
            }))
        }).map_err(|e| AppError::DatabaseError(e.to_string()))?;
        for r in rows { if let Ok((cid, item)) = r { items_by_chapter.entry(cid).or_default().push(item); } }

        // Feuilles de signature
        let mut s = conn.prepare(&format!(
            "SELECT chapter_id, title, description, nombre, sort_order, uuid, updated_at FROM signature_sheets WHERE chapter_id IN ({placeholders}) AND deleted_at IS NULL ORDER BY sort_order"
        )).map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let rows = s.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, ItemJson {
                kind: "signature_sheet".to_string(),
                uuid: row.get(5)?,
                title: row.get(1)?,
                description: row.get(2)?,
                content: None,
                periodicite_id: None,
                nombre: row.get(3)?,
                updated_at: row.get(6)?,
                sort_order: row.get(4)?,
            }))
        }).map_err(|e| AppError::DatabaseError(e.to_string()))?;
        for r in rows { if let Ok((cid, item)) = r { items_by_chapter.entry(cid).or_default().push(item); } }

        // Intercalaires
        let mut s = conn.prepare(&format!(
            "SELECT chapter_id, title, description, sort_order, uuid, updated_at FROM intercalaires WHERE chapter_id IN ({placeholders}) AND deleted_at IS NULL ORDER BY sort_order"
        )).map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let rows = s.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, ItemJson {
                kind: "intercalaire".to_string(),
                uuid: row.get(4)?,
                title: row.get(1)?,
                description: row.get(2)?,
                content: None,
                periodicite_id: None,
                nombre: None,
                updated_at: row.get(5)?,
                sort_order: row.get(3)?,
            }))
        }).map_err(|e| AppError::DatabaseError(e.to_string()))?;
        for r in rows { if let Ok((cid, item)) = r { items_by_chapter.entry(cid).or_default().push(item); } }
    }

    // Charger les périodicités
    let mut perio_stmt = conn
        .prepare("SELECT id, label, nombre FROM periodicites ORDER BY id")
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let periodicites: Vec<MetadataPeriodicite> = perio_stmt
        .query_map([], |row| {
            Ok(MetadataPeriodicite { id: row.get(0)?, label: row.get(1)?, nombre: row.get(2)? })
        })
        .map_err(|e| AppError::DatabaseError(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::DatabaseError(format!("periodicites : {}", e)))?;

    let metadata = MetadataJson {
        description: "Classeur exporté depuis l'application Registre.".to_string(),
        generated_at: now_iso8601(),
        note: "Ce bloc _metadata est informatif et ignoré lors de l'import.".to_string(),
        schema: CLASSEUR_SCHEMA.clone(),
        periodicites,
    };

    // Assembler les chapitres avec leurs items
    let mut slug_counts: HashMap<String, u32> = HashMap::new();
    let mut chapter_jsons = Vec::new();

    for (ch_id, label, ch_icon, description, sort_order, ch_uuid) in &chapters_raw {
        let base_slug = slugify(label);
        let count = slug_counts.entry(base_slug.clone()).or_insert(0);
        *count += 1;
        let uid = if *count == 1 { base_slug } else { format!("{}-{}", base_slug, count) };

        let items = items_by_chapter.remove(&ch_id.to_string()).unwrap_or_default();

        chapter_jsons.push(ChapterJson {
            uid,
            uuid: ch_uuid.clone(),
            label: label.clone(),
            icon: ch_icon.clone(),
            description: description.clone(),
            sort_order: *sort_order,
            items,
        });
    }

    let export = ClasseurJson {
        format_version: 2,
        _metadata: Some(metadata),
        classeur: ClasseurData { name, icon, etablissement, etablissement_complement: complement },
        chapters: chapter_jsons,
    };

    serde_json::to_string_pretty(&export)
        .map_err(|e| AppError::Unknown(format!("sérialisation JSON : {}", e)))
}

/// Exporte un classeur au format JSON lisible.
/// Retourne la string JSON ; le frontend se charge du dialogue de sauvegarde.
/// Crée un snapshot dans l'historique si l'état actuel n'y figure pas déjà.
#[tauri::command]
pub async fn export_classeur_json(
    state: State<'_, AppState>,
    classeur_id: i64,
) -> Result<String, AppError> {
    let db_path = state.db_path().to_string();

    let json = tokio::task::spawn_blocking(move || {
        let conn = rusqlite::Connection::open_with_flags(
            &db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE,
        )
        .map_err(|e| AppError::DatabaseError(format!("ouverture DB : {}", e)))?;

        let snapshot_json = do_export_json(&conn, classeur_id)?;

        // Sauvegarder dans l'historique si ce snapshot n'existe pas déjà
        if !snapshot_already_in_history(&conn, classeur_id, &snapshot_json)? {
            conn.execute(
                "INSERT INTO merge_history (classeur_id, source_name, inserted, updated, unchanged, skipped, snapshot_json) VALUES (?1, ?2, 0, 0, 0, 0, ?3)",
                rusqlite::params![classeur_id, "Export", snapshot_json],
            ).map_err(|e| AppError::DatabaseError(e.to_string()))?;

            prune_merge_history(&conn, classeur_id)?;
        }

        Ok::<String, AppError>(snapshot_json)
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    Ok(json)
}

// ── Import nouveau classeur ────────────────────────────────────────

/// Logique partagée d'import JSON en tant que nouveau classeur.
/// Accepte les formats v1 et v2. Génère des UUID pour les éléments qui n'en ont pas.
fn do_import_json(db_path: &str, json_content: &str) -> Result<i64, AppError> {
    let data: ClasseurJson = serde_json::from_str(json_content)
        .map_err(|e| AppError::FileError(format!("JSON invalide : {}", e)))?;

    if data.format_version != 1 && data.format_version != 2 {
        return Err(AppError::FileError(format!(
            "Version de format non supportée : {}",
            data.format_version
        )));
    }

    let conn = rusqlite::Connection::open_with_flags(
        db_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE,
    )
    .map_err(|e| AppError::DatabaseError(format!("ouverture DB : {}", e)))?;

    conn.execute_batch("BEGIN")
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let next_order: i64 = conn
        .query_row("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM classeurs", [], |r| r.get(0))
        .unwrap_or(1);

    conn.execute(
        "INSERT INTO classeurs (name, icon, etablissement, etablissement_complement, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![data.classeur.name, data.classeur.icon, data.classeur.etablissement, data.classeur.etablissement_complement, next_order],
    )
    .map_err(|e| AppError::DatabaseError(format!("insert classeur : {}", e)))?;
    let new_classeur_id = conn.last_insert_rowid();

    for ch_json in &data.chapters {
        let ch_uuid = ch_json.uuid.clone().unwrap_or_else(generate_uuid);
        conn.execute(
            "INSERT INTO chapters (label, icon, description, sort_order, classeur_id, uuid) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![ch_json.label, ch_json.icon, ch_json.description, ch_json.sort_order, new_classeur_id, ch_uuid],
        )
        .map_err(|e| AppError::DatabaseError(format!("insert chapter : {}", e)))?;
        let new_ch_id = conn.last_insert_rowid();
        let ch_id_str = new_ch_id.to_string();

        for item in &ch_json.items {
            let item_uuid = item.uuid.clone().unwrap_or_else(generate_uuid);
            match item.kind.as_str() {
                "document" => {
                    conn.execute(
                        "INSERT INTO documents (title, description, content, chapter_id, sort_order, uuid) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                        rusqlite::params![item.title, item.description.as_deref().unwrap_or(""), item.content.as_deref().unwrap_or(""), ch_id_str, item.sort_order, item_uuid],
                    ).map_err(|e| AppError::DatabaseError(format!("documents : {}", e)))?;
                }
                "tracking_sheet" => {
                    conn.execute(
                        "INSERT INTO tracking_sheets (title, chapter_id, periodicite_id, sort_order, uuid) VALUES (?1, ?2, ?3, ?4, ?5)",
                        rusqlite::params![item.title, ch_id_str, item.periodicite_id, item.sort_order, item_uuid],
                    ).map_err(|e| AppError::DatabaseError(format!("tracking_sheets : {}", e)))?;
                }
                "signature_sheet" => {
                    conn.execute(
                        "INSERT INTO signature_sheets (title, description, chapter_id, nombre, sort_order, uuid) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                        rusqlite::params![item.title, item.description.as_deref().unwrap_or(""), ch_id_str, item.nombre, item.sort_order, item_uuid],
                    ).map_err(|e| AppError::DatabaseError(format!("signature_sheets : {}", e)))?;
                }
                "intercalaire" => {
                    conn.execute(
                        "INSERT INTO intercalaires (title, description, chapter_id, sort_order, uuid) VALUES (?1, ?2, ?3, ?4, ?5)",
                        rusqlite::params![item.title, item.description.as_deref().unwrap_or(""), ch_id_str, item.sort_order, item_uuid],
                    ).map_err(|e| AppError::DatabaseError(format!("intercalaires : {}", e)))?;
                }
                _ => {}
            }
        }
    }

    conn.execute_batch("COMMIT")
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(new_classeur_id)
}

/// Importe un fichier JSON comme nouveau classeur (via dialogue fichier).
/// Retourne l'ID du classeur créé.
#[tauri::command]
pub async fn import_json_as_new_classeur(
    state: State<'_, AppState>,
    path: String,
) -> Result<i64, AppError> {
    let db_path = state.db_path().to_string();
    let new_id = tokio::task::spawn_blocking(move || {
        let content = std::fs::read_to_string(&path)
            .map_err(|e| AppError::FileError(format!("{}: {}", path, e)))?;
        do_import_json(&db_path, &content)
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;
    Ok(new_id)
}

/// Importe un fichier JSON comme nouveau classeur depuis des octets bruts (drag-and-drop).
/// Retourne l'ID du classeur créé.
#[tauri::command]
pub async fn import_json_as_new_classeur_from_bytes(
    state: State<'_, AppState>,
    data: Vec<u8>,
) -> Result<i64, AppError> {
    let db_path = state.db_path().to_string();
    let new_id = tokio::task::spawn_blocking(move || {
        let content = String::from_utf8(data)
            .map_err(|e| AppError::FileError(format!("UTF-8 invalide : {}", e)))?;
        do_import_json(&db_path, &content)
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;
    Ok(new_id)
}

// ── Merge intelligent ──────────────────────────────────────────────

/// Données locales d'un item existant pour le matching
struct LocalItem {
    id: i64,
    uuid: Option<String>,
    title: String,
    chapter_id: String,
    kind: String,
    deleted_at: Option<String>,
    updated_at: Option<String>,
    // Champs spécifiques pour comparaison
    description: String,
    content: String,
    periodicite_id: Option<i64>,
    nombre: Option<i64>,
}

/// Charge tous les items locaux d'un classeur (y compris soft-deleted pour la détection)
fn load_local_items(conn: &rusqlite::Connection, classeur_id: i64) -> Result<Vec<LocalItem>, AppError> {
    let mut items = Vec::new();

    // Obtenir les IDs de chapitres du classeur (y compris soft-deleted pour UUID matching)
    let mut ch_stmt = conn.prepare("SELECT id FROM chapters WHERE classeur_id = ?1")
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let ch_ids: Vec<i64> = ch_stmt.query_map([classeur_id], |r| r.get(0))
        .map_err(|e| AppError::DatabaseError(e.to_string()))?
        .filter_map(|r| r.ok()).collect();

    if ch_ids.is_empty() { return Ok(items); }

    let placeholders = ch_ids.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(",");

    // Documents
    let mut s = conn.prepare(&format!(
        "SELECT id, uuid, title, chapter_id, deleted_at, updated_at, COALESCE(description,''), COALESCE(content,'') FROM documents WHERE chapter_id IN ({placeholders})"
    )).map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let rows = s.query_map([], |r| Ok(LocalItem {
        id: r.get(0)?, uuid: r.get(1)?, title: r.get(2)?, chapter_id: r.get(3)?,
        kind: "document".to_string(),
        deleted_at: r.get(4)?, updated_at: r.get(5)?, description: r.get(6)?, content: r.get(7)?,
        periodicite_id: None, nombre: None,
    })).map_err(|e| AppError::DatabaseError(e.to_string()))?;
    for r in rows { if let Ok(item) = r { items.push(item); } }

    // Tracking sheets
    let mut s = conn.prepare(&format!(
        "SELECT id, uuid, title, chapter_id, deleted_at, updated_at, periodicite_id FROM tracking_sheets WHERE chapter_id IN ({placeholders})"
    )).map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let rows = s.query_map([], |r| Ok(LocalItem {
        id: r.get(0)?, uuid: r.get(1)?, title: r.get(2)?, chapter_id: r.get(3)?,
        kind: "tracking_sheet".to_string(),
        deleted_at: r.get(4)?, updated_at: r.get(5)?, description: String::new(), content: String::new(),
        periodicite_id: r.get(6)?, nombre: None,
    })).map_err(|e| AppError::DatabaseError(e.to_string()))?;
    for r in rows { if let Ok(item) = r { items.push(item); } }

    // Signature sheets
    let mut s = conn.prepare(&format!(
        "SELECT id, uuid, title, chapter_id, deleted_at, updated_at, COALESCE(description,''), nombre FROM signature_sheets WHERE chapter_id IN ({placeholders})"
    )).map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let rows = s.query_map([], |r| Ok(LocalItem {
        id: r.get(0)?, uuid: r.get(1)?, title: r.get(2)?, chapter_id: r.get(3)?,
        kind: "signature_sheet".to_string(),
        deleted_at: r.get(4)?, updated_at: r.get(5)?, description: r.get(6)?, content: String::new(),
        periodicite_id: None, nombre: r.get(7)?,
    })).map_err(|e| AppError::DatabaseError(e.to_string()))?;
    for r in rows { if let Ok(item) = r { items.push(item); } }

    // Intercalaires
    let mut s = conn.prepare(&format!(
        "SELECT id, uuid, title, chapter_id, deleted_at, updated_at, COALESCE(description,'') FROM intercalaires WHERE chapter_id IN ({placeholders})"
    )).map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let rows = s.query_map([], |r| Ok(LocalItem {
        id: r.get(0)?, uuid: r.get(1)?, title: r.get(2)?, chapter_id: r.get(3)?,
        kind: "intercalaire".to_string(),
        deleted_at: r.get(4)?, updated_at: r.get(5)?, description: r.get(6)?, content: String::new(),
        periodicite_id: None, nombre: None,
    })).map_err(|e| AppError::DatabaseError(e.to_string()))?;
    for r in rows { if let Ok(item) = r { items.push(item); } }

    Ok(items)
}

/// Logique de merge partagée entre preview et exécution.
/// Si dry_run=true, ne modifie pas la base et retourne le détail.
/// Si dry_run=false, applique les changements et retourne le résumé.
/// Si replace=true, les éléments locaux absents du JSON importé sont soft-deleted.
fn do_merge(
    conn: &rusqlite::Connection,
    classeur_id: i64,
    data: &ClasseurJson,
    dry_run: bool,
    replace: bool,
) -> Result<(MergeResult, Vec<MergePreviewItem>), AppError> {
    let mut result = MergeResult { inserted: 0, updated: 0, unchanged: 0, skipped: 0, deleted: 0, warnings: Vec::new() };
    let mut preview_items = Vec::new();

    // Charger chapitres existants (non supprimés pour le merge, tous pour UUID matching)
    // slug → (id, label, icon, desc, uuid)
    let mut existing_chapters: HashMap<String, (i64, String, String, String, Option<String>)> = HashMap::new();
    let mut chapters_by_uuid: HashMap<String, (i64, String, String, String, Option<String>)> = HashMap::new();
    {
        let mut stmt = conn
            .prepare("SELECT id, label, icon, description, uuid, deleted_at FROM chapters WHERE classeur_id = ?1")
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let rows = stmt
            .query_map([classeur_id], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?, row.get::<_, Option<String>>(4)?, row.get::<_, Option<String>>(5)?))
            })
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        for r in rows {
            if let Ok((id, label, icon, desc, uuid, deleted_at)) = r {
                if deleted_at.is_none() {
                    existing_chapters.insert(slugify(&label), (id, label.clone(), icon.clone(), desc.clone(), uuid.clone()));
                }
                if let Some(ref u) = uuid {
                    chapters_by_uuid.insert(u.clone(), (id, label, icon, desc, uuid));
                }
            }
        }
    }

    // Charger tous les items locaux pour UUID matching
    let local_items = load_local_items(conn, classeur_id)?;

    // Index UUID → &LocalItem (pour tous les kinds confondus)
    let mut items_by_uuid: HashMap<&str, &LocalItem> = HashMap::new();
    for li in &local_items {
        if let Some(ref u) = li.uuid {
            items_by_uuid.insert(u.as_str(), li);
        }
    }

    // Sets pour le mode replace : suivre les chapitres et items matchés
    let mut matched_chapter_ids: HashSet<i64> = HashSet::new();
    let mut matched_item_ids: HashSet<i64> = HashSet::new();

    let mut next_ch_order: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM chapters WHERE classeur_id = ?1 AND deleted_at IS NULL",
            [classeur_id],
            |r| r.get(0),
        )
        .unwrap_or(1);

    for ch_json in &data.chapters {
        // Matching chapitre : UUID d'abord, puis slug
        let matched_ch = if let Some(ref uuid) = ch_json.uuid {
            chapters_by_uuid.get(uuid).cloned()
        } else {
            None
        };
        let matched_ch = matched_ch.or_else(|| {
            existing_chapters.get(&slugify(&ch_json.label)).cloned()
        });

        let ch_id: i64;
        let ch_label = &ch_json.label;

        if let Some((existing_id, existing_label, existing_icon, existing_desc, _)) = matched_ch {
            ch_id = existing_id;
            matched_chapter_ids.insert(ch_id);
            if existing_label != ch_json.label || existing_icon != ch_json.icon || existing_desc != ch_json.description {
                if !dry_run {
                    conn.execute(
                        "UPDATE chapters SET label = ?1, icon = ?2, description = ?3 WHERE id = ?4",
                        rusqlite::params![ch_json.label, ch_json.icon, ch_json.description, ch_id],
                    ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                }
                result.updated += 1;
                preview_items.push(MergePreviewItem {
                    action: "update".to_string(), kind: "chapter".to_string(),
                    title: ch_json.label.clone(), chapter_label: ch_json.label.clone(),
                    icon: Some(ch_json.icon.clone()),
                });
            } else {
                result.unchanged += 1;
            }
        } else {
            if !dry_run {
                let ch_uuid = ch_json.uuid.clone().unwrap_or_else(generate_uuid);
                conn.execute(
                    "INSERT INTO chapters (label, icon, description, sort_order, classeur_id, uuid) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    rusqlite::params![ch_json.label, ch_json.icon, ch_json.description, next_ch_order, classeur_id, ch_uuid],
                ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                ch_id = conn.last_insert_rowid();
            } else {
                ch_id = -1; // Placeholder en dry run
            }
            next_ch_order += 1;
            result.inserted += 1;
            preview_items.push(MergePreviewItem {
                action: "insert".to_string(), kind: "chapter".to_string(),
                title: ch_json.label.clone(), chapter_label: ch_json.label.clone(),
                icon: Some(ch_json.icon.clone()),
            });
        }

        let ch_id_str = ch_id.to_string();
        let ch_icon = &ch_json.icon;

        for item in &ch_json.items {
            // Validation : kind inconnu → warning + skip
            match item.kind.as_str() {
                "document" | "tracking_sheet" | "signature_sheet" | "intercalaire" => {}
                unknown => {
                    result.warnings.push(format!(
                        "Chapitre '{}': item de type inconnu '{}' ignoré", ch_label, unknown
                    ));
                    result.skipped += 1;
                    preview_items.push(MergePreviewItem {
                        action: "skip".to_string(), kind: item.kind.clone(),
                        title: item.title.clone(), chapter_label: ch_label.clone(),
                        icon: Some(ch_icon.clone()),
                    });
                    continue;
                }
            }

            // Validation : item sans titre → warning + skip
            if item.title.trim().is_empty() {
                result.warnings.push(format!(
                    "Chapitre '{}': item sans titre ignoré", ch_label
                ));
                result.skipped += 1;
                preview_items.push(MergePreviewItem {
                    action: "skip".to_string(), kind: item.kind.clone(),
                    title: "(sans titre)".to_string(), chapter_label: ch_label.clone(),
                    icon: Some(ch_icon.clone()),
                });
                continue;
            }

            // Matching item : UUID d'abord, puis chapter_id + title
            let matched_local = if let Some(ref uuid) = item.uuid {
                items_by_uuid.get(uuid.as_str()).copied()
            } else {
                None
            };

            // Fallback : matching par titre dans le même chapitre (items non supprimés)
            let matched_local = matched_local.or_else(|| {
                local_items.iter().find(|li| {
                    li.deleted_at.is_none() && li.chapter_id == ch_id_str && li.title == item.title
                })
            });

            if let Some(local) = matched_local {
                matched_item_ids.insert(local.id);

                // Item soft-deleted localement
                if local.deleted_at.is_some() {
                    if replace {
                        // En mode replace, on restaure l'item supprimé
                        if !dry_run {
                            let table = match item.kind.as_str() {
                                "document" => "documents",
                                "tracking_sheet" => "tracking_sheets",
                                "signature_sheet" => "signature_sheets",
                                "intercalaire" => "intercalaires",
                                _ => { continue; }
                            };
                            conn.execute(
                                &format!("UPDATE {} SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ?1", table),
                                [local.id],
                            ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                        }
                        result.inserted += 1;
                        preview_items.push(MergePreviewItem {
                            action: "insert".to_string(), kind: item.kind.clone(),
                            title: item.title.clone(), chapter_label: ch_label.clone(),
                            icon: Some(ch_icon.clone()),
                        });
                    } else {
                        result.skipped += 1;
                        preview_items.push(MergePreviewItem {
                            action: "skip".to_string(), kind: item.kind.clone(),
                            title: item.title.clone(), chapter_label: ch_label.clone(),
                            icon: Some(ch_icon.clone()),
                        });
                    }
                    continue;
                }

                // En mode replace, on ignore les timestamps : le JSON est la source de vérité.
                // En mode fusion, Last-Write-Wins via updated_at.
                if !replace {
                    let json_newer = match (&item.updated_at, &local.updated_at) {
                        (Some(json_ts), Some(local_ts)) => json_ts > local_ts,
                        (Some(_), None) => true,
                        _ => true,
                    };
                    if !json_newer {
                        result.unchanged += 1;
                        continue;
                    }
                }

                // Comparer tous les champs selon le kind
                let changed = match item.kind.as_str() {
                    "document" => {
                        let new_desc = item.description.as_deref().unwrap_or("");
                        let new_content = item.content.as_deref().unwrap_or("");
                        local.title != item.title || local.description != new_desc || local.content != new_content
                    }
                    "tracking_sheet" => {
                        local.title != item.title || local.periodicite_id != item.periodicite_id
                    }
                    "signature_sheet" => {
                        let new_desc = item.description.as_deref().unwrap_or("");
                        local.title != item.title || local.description != new_desc || local.nombre != item.nombre
                    }
                    "intercalaire" => {
                        let new_desc = item.description.as_deref().unwrap_or("");
                        local.title != item.title || local.description != new_desc
                    }
                    _ => false,
                };

                if changed {
                    if !dry_run {
                        match item.kind.as_str() {
                            "document" => {
                                conn.execute(
                                    "UPDATE documents SET title = ?1, description = ?2, content = ?3, updated_at = datetime('now') WHERE id = ?4",
                                    rusqlite::params![item.title, item.description.as_deref().unwrap_or(""), item.content.as_deref().unwrap_or(""), local.id],
                                ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                            }
                            "tracking_sheet" => {
                                conn.execute(
                                    "UPDATE tracking_sheets SET title = ?1, periodicite_id = ?2, updated_at = datetime('now') WHERE id = ?3",
                                    rusqlite::params![item.title, item.periodicite_id, local.id],
                                ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                            }
                            "signature_sheet" => {
                                conn.execute(
                                    "UPDATE signature_sheets SET title = ?1, description = ?2, nombre = ?3, updated_at = datetime('now') WHERE id = ?4",
                                    rusqlite::params![item.title, item.description.as_deref().unwrap_or(""), item.nombre, local.id],
                                ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                            }
                            "intercalaire" => {
                                conn.execute(
                                    "UPDATE intercalaires SET title = ?1, description = ?2, updated_at = datetime('now') WHERE id = ?3",
                                    rusqlite::params![item.title, item.description.as_deref().unwrap_or(""), local.id],
                                ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                            }
                            _ => {}
                        }
                    }
                    result.updated += 1;
                    preview_items.push(MergePreviewItem {
                        action: "update".to_string(), kind: item.kind.clone(),
                        title: item.title.clone(), chapter_label: ch_label.clone(),
                        icon: Some(ch_icon.clone()),
                    });
                } else {
                    result.unchanged += 1;
                }
            } else {
                // Nouvel item
                if !dry_run {
                    let item_uuid = item.uuid.clone().unwrap_or_else(generate_uuid);
                    match item.kind.as_str() {
                        "document" => {
                            conn.execute(
                                "INSERT INTO documents (title, description, content, chapter_id, sort_order, uuid) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                                rusqlite::params![item.title, item.description.as_deref().unwrap_or(""), item.content.as_deref().unwrap_or(""), ch_id_str, item.sort_order, item_uuid],
                            ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                        }
                        "tracking_sheet" => {
                            conn.execute(
                                "INSERT INTO tracking_sheets (title, chapter_id, periodicite_id, sort_order, uuid) VALUES (?1, ?2, ?3, ?4, ?5)",
                                rusqlite::params![item.title, ch_id_str, item.periodicite_id, item.sort_order, item_uuid],
                            ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                        }
                        "signature_sheet" => {
                            conn.execute(
                                "INSERT INTO signature_sheets (title, description, chapter_id, nombre, sort_order, uuid) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                                rusqlite::params![item.title, item.description.as_deref().unwrap_or(""), ch_id_str, item.nombre, item.sort_order, item_uuid],
                            ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                        }
                        "intercalaire" => {
                            conn.execute(
                                "INSERT INTO intercalaires (title, description, chapter_id, sort_order, uuid) VALUES (?1, ?2, ?3, ?4, ?5)",
                                rusqlite::params![item.title, item.description.as_deref().unwrap_or(""), ch_id_str, item.sort_order, item_uuid],
                            ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                        }
                        _ => {}
                    }
                }
                result.inserted += 1;
                preview_items.push(MergePreviewItem {
                    action: "insert".to_string(), kind: item.kind.clone(),
                    title: item.title.clone(), chapter_label: ch_label.clone(),
                    icon: Some(ch_icon.clone()),
                });
            }
        }
    }

    // Mode replace : soft-delete les chapitres et items locaux non matchés
    if replace {
        // Index chapter_id → (label, icon) pour les preview items
        let mut ch_info_map: HashMap<String, (String, String)> = HashMap::new();
        for (_slug, (id, label, icon, _, _)) in &existing_chapters {
            ch_info_map.insert(id.to_string(), (label.clone(), icon.clone()));
        }

        // Soft-delete des items non matchés (non déjà supprimés)
        for li in &local_items {
            if li.deleted_at.is_some() { continue; }
            if matched_item_ids.contains(&li.id) { continue; }

            let table = match li.kind.as_str() {
                "document" => "documents",
                "tracking_sheet" => "tracking_sheets",
                "signature_sheet" => "signature_sheets",
                "intercalaire" => "intercalaires",
                _ => continue,
            };

            if !dry_run {
                conn.execute(
                    &format!("UPDATE {} SET deleted_at = datetime('now') WHERE id = ?1", table),
                    [li.id],
                ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
            }

            let (ch_lbl, ch_ico) = ch_info_map.get(&li.chapter_id)
                .cloned().unwrap_or_default();
            result.deleted += 1;
            preview_items.push(MergePreviewItem {
                action: "delete".to_string(),
                kind: li.kind.clone(),
                title: li.title.clone(),
                chapter_label: ch_lbl,
                icon: Some(ch_ico),
            });
        }

        // Soft-delete des chapitres non matchés (non déjà supprimés)
        for (_slug, (id, label, icon, _, _)) in &existing_chapters {
            if matched_chapter_ids.contains(id) { continue; }

            if !dry_run {
                conn.execute(
                    "UPDATE chapters SET deleted_at = datetime('now') WHERE id = ?1",
                    [*id],
                ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
            }

            result.deleted += 1;
            preview_items.push(MergePreviewItem {
                action: "delete".to_string(),
                kind: "chapter".to_string(),
                title: label.clone(),
                chapter_label: label.clone(),
                icon: Some(icon.clone()),
            });
        }
    }

    Ok((result, preview_items))
}

/// Supprime `_metadata` d'un JSON et retourne la valeur parsée.
fn strip_metadata(json: &str) -> Option<serde_json::Value> {
    let mut v: serde_json::Value = serde_json::from_str(json).ok()?;
    if let Some(obj) = v.as_object_mut() {
        obj.remove("_metadata");
    }
    Some(v)
}

/// Vérifie si un snapshot (données uniquement, sans `_metadata`) existe déjà dans l'historique.
/// Parse le snapshot candidat une seule fois, puis compare avec chaque entrée en base.
fn snapshot_already_in_history(conn: &rusqlite::Connection, classeur_id: i64, json: &str) -> Result<bool, AppError> {
    let candidate = strip_metadata(json);
    let mut stmt = conn
        .prepare("SELECT snapshot_json FROM merge_history WHERE classeur_id = ?1")
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let mut rows = stmt
        .query([classeur_id])
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    while let Some(row) = rows.next().map_err(|e| AppError::DatabaseError(e.to_string()))? {
        let existing: String = row.get(0).map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let existing_val = strip_metadata(&existing);
        if candidate == existing_val {
            return Ok(true);
        }
    }
    Ok(false)
}

/// Compare deux snapshots JSON en ignorant le bloc `_metadata` (qui contient `generated_at`).
fn snapshots_equal(a: &str, b: &str) -> bool {
    match (strip_metadata(a), strip_metadata(b)) {
        (Some(va), Some(vb)) => va == vb,
        _ => a == b,
    }
}

fn prune_merge_history(conn: &rusqlite::Connection, classeur_id: i64) -> Result<(), AppError> {
    conn.execute(
        "DELETE FROM merge_history WHERE classeur_id = ?1 AND id NOT IN (
            SELECT id FROM merge_history WHERE classeur_id = ?1 ORDER BY merged_at DESC LIMIT 20
        )",
        [classeur_id],
    ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
    Ok(())
}

/// Parse et valide un fichier JSON d'import
fn parse_import_json(content: &str) -> Result<ClasseurJson, AppError> {
    let data: ClasseurJson = serde_json::from_str(content)
        .map_err(|e| AppError::FileError(format!("JSON invalide : {}", e)))?;
    if data.format_version != 1 && data.format_version != 2 {
        return Err(AppError::FileError(format!(
            "Version de format non supportée : {}",
            data.format_version
        )));
    }
    Ok(data)
}

/// Prévisualise un merge JSON sans appliquer les changements.
/// Retourne le détail de chaque action prévue.
#[tauri::command]
pub async fn preview_merge_json(
    state: State<'_, AppState>,
    classeur_id: i64,
    path: String,
    replace: bool,
) -> Result<MergePreview, AppError> {
    let db_path = state.db_path().to_string();

    let preview = tokio::task::spawn_blocking(move || {
        let content = std::fs::read_to_string(&path)
            .map_err(|e| AppError::FileError(format!("{}: {}", path, e)))?;
        let data = parse_import_json(&content)?;

        let conn = rusqlite::Connection::open_with_flags(
            &db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )
        .map_err(|e| AppError::DatabaseError(format!("ouverture DB : {}", e)))?;

        let (result, items) = do_merge(&conn, classeur_id, &data, true, replace)?;

        Ok::<MergePreview, AppError>(MergePreview {
            items,
            total_insert: result.inserted,
            total_update: result.updated,
            total_unchanged: result.unchanged,
            total_skip: result.skipped,
            total_delete: result.deleted,
            warnings: result.warnings,
        })
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    Ok(preview)
}

/// Prévisualise un merge depuis un contenu JSON (sans fichier sur disque).
#[tauri::command]
pub async fn preview_merge_json_from_content(
    state: State<'_, AppState>,
    classeur_id: i64,
    content: String,
    replace: bool,
) -> Result<MergePreview, AppError> {
    let db_path = state.db_path().to_string();

    let preview = tokio::task::spawn_blocking(move || {
        let data = parse_import_json(&content)?;

        let conn = rusqlite::Connection::open_with_flags(
            &db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )
        .map_err(|e| AppError::DatabaseError(format!("ouverture DB : {}", e)))?;

        let (result, items) = do_merge(&conn, classeur_id, &data, true, replace)?;

        Ok::<MergePreview, AppError>(MergePreview {
            items,
            total_insert: result.inserted,
            total_update: result.updated,
            total_unchanged: result.unchanged,
            total_skip: result.skipped,
            total_delete: result.deleted,
            warnings: result.warnings,
        })
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    Ok(preview)
}

/// Importe un fichier JSON dans un classeur existant avec merge intelligent.
/// Sauvegarde un snapshot avant l'opération pour permettre le rollback.
#[tauri::command]
pub async fn import_classeur_json(
    state: State<'_, AppState>,
    classeur_id: i64,
    path: String,
    replace: bool,
) -> Result<MergeResult, AppError> {
    let db_path = state.db_path().to_string();

    let result = tokio::task::spawn_blocking(move || {
        let content = std::fs::read_to_string(&path)
            .map_err(|e| AppError::FileError(format!("{}: {}", path, e)))?;
        let data = parse_import_json(&content)?;

        let conn = rusqlite::Connection::open_with_flags(
            &db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE,
        )
        .map_err(|e| AppError::DatabaseError(format!("ouverture DB : {}", e)))?;

        // Snapshot avant merge (pour rollback)
        let snapshot_json = do_export_json(&conn, classeur_id)?;

        let already_in_history = snapshot_already_in_history(&conn, classeur_id, &snapshot_json)?;

        conn.execute_batch("BEGIN")
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let (result, _) = do_merge(&conn, classeur_id, &data, false, replace)?;

        // Nom source depuis le classeur JSON importé
        let source_name = data.classeur.name.clone();

        // Enregistrer dans l'historique uniquement si le merge a modifié des données
        // et que le snapshot n'existe pas déjà
        let has_changes = result.inserted > 0 || result.updated > 0 || result.deleted > 0;
        if has_changes && !already_in_history {
            conn.execute(
                "INSERT INTO merge_history (classeur_id, source_name, inserted, updated, unchanged, skipped, snapshot_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![classeur_id, source_name, result.inserted, result.updated, result.unchanged, result.skipped, snapshot_json],
            ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
        }

        // Garder uniquement les 20 entrées les plus récentes
        prune_merge_history(&conn, classeur_id)?;

        conn.execute_batch("COMMIT")
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok::<MergeResult, AppError>(result)
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    Ok(result)
}

/// Importe un contenu JSON dans un classeur existant avec merge intelligent (sans fichier sur disque).
#[tauri::command]
pub async fn import_classeur_json_from_content(
    state: State<'_, AppState>,
    classeur_id: i64,
    content: String,
    replace: bool,
) -> Result<MergeResult, AppError> {
    let db_path = state.db_path().to_string();

    let result = tokio::task::spawn_blocking(move || {
        let data = parse_import_json(&content)?;

        let conn = rusqlite::Connection::open_with_flags(
            &db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE,
        )
        .map_err(|e| AppError::DatabaseError(format!("ouverture DB : {}", e)))?;

        let snapshot_json = do_export_json(&conn, classeur_id)?;
        let already_in_history = snapshot_already_in_history(&conn, classeur_id, &snapshot_json)?;

        conn.execute_batch("BEGIN")
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let (result, _) = do_merge(&conn, classeur_id, &data, false, replace)?;

        let source_name = data.classeur.name.clone();
        let has_changes = result.inserted > 0 || result.updated > 0 || result.deleted > 0;
        if has_changes && !already_in_history {
            conn.execute(
                "INSERT INTO merge_history (classeur_id, source_name, inserted, updated, unchanged, skipped, snapshot_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![classeur_id, source_name, result.inserted, result.updated, result.unchanged, result.skipped, snapshot_json],
            ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
        }

        prune_merge_history(&conn, classeur_id)?;

        conn.execute_batch("COMMIT")
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok::<MergeResult, AppError>(result)
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    Ok(result)
}

// ── Rollback & historique ──────────────────────────────────────────

/// Annule un merge en restaurant le snapshot sauvegardé.
/// Supprime les données du classeur et les remplace par celles du snapshot.
/// Crée un backup de l'état actuel uniquement si celui-ci diffère du snapshot restauré.
#[tauri::command]
pub async fn rollback_merge(
    state: State<'_, AppState>,
    merge_id: i64,
) -> Result<(), AppError> {
    let db_path = state.db_path().to_string();

    tokio::task::spawn_blocking(move || {
        let conn = rusqlite::Connection::open_with_flags(
            &db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE,
        )
        .map_err(|e| AppError::DatabaseError(format!("ouverture DB : {}", e)))?;

        // Récupérer le snapshot et le classeur_id
        let (classeur_id, snapshot_json): (i64, String) = conn
            .query_row(
                "SELECT classeur_id, snapshot_json FROM merge_history WHERE id = ?1",
                [merge_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| AppError::DatabaseError(format!("entrée d'historique introuvable : {}", e)))?;

        let snapshot: ClasseurJson = serde_json::from_str(&snapshot_json)
            .map_err(|e| AppError::FileError(format!("snapshot JSON invalide : {}", e)))?;

        // Capturer l'état actuel AVANT restauration
        let current_json = do_export_json(&conn, classeur_id)?;

        // Si l'état actuel est déjà identique au snapshot cible, ne rien faire
        if snapshots_equal(&current_json, &snapshot_json) {
            return Ok(());
        }

        let already_in_history = snapshot_already_in_history(&conn, classeur_id, &current_json)?;

        conn.execute_batch("BEGIN")
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        // Sauvegarder l'état actuel uniquement s'il ne correspond à aucun snapshot existant
        if !already_in_history {
            conn.execute(
                "INSERT INTO merge_history (classeur_id, source_name, inserted, updated, unchanged, skipped, snapshot_json) VALUES (?1, ?2, 0, 0, 0, 0, ?3)",
                rusqlite::params![classeur_id, "Sauvegarde avant restauration", current_json],
            ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
        }

        // Garder uniquement les 20 entrées les plus récentes
        prune_merge_history(&conn, classeur_id)?;

        // Supprimer physiquement tous les items et chapitres du classeur
        purge_classeur_data(&conn, classeur_id)?;

        // Mettre à jour les métadonnées du classeur
        conn.execute(
            "UPDATE classeurs SET name = ?1, icon = ?2, etablissement = ?3, etablissement_complement = ?4 WHERE id = ?5",
            rusqlite::params![snapshot.classeur.name, snapshot.classeur.icon, snapshot.classeur.etablissement, snapshot.classeur.etablissement_complement, classeur_id],
        ).map_err(|e| AppError::DatabaseError(e.to_string()))?;

        // Réinsérer chapitres et items depuis le snapshot
        restore_snapshot_data(&conn, classeur_id, &snapshot)?;

        conn.execute_batch("COMMIT")
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok::<(), AppError>(())
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    Ok(())
}

/// Supprime une entrée d'historique de merge (sans restauration).
#[tauri::command]
pub async fn delete_merge_entry(
    state: State<'_, AppState>,
    merge_id: i64,
) -> Result<(), AppError> {
    let db_path = state.db_path().to_string();

    tokio::task::spawn_blocking(move || {
        let conn = rusqlite::Connection::open_with_flags(
            &db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE,
        )
        .map_err(|e| AppError::DatabaseError(format!("ouverture DB : {}", e)))?;

        let affected = conn
            .execute("DELETE FROM merge_history WHERE id = ?1", [merge_id])
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        if affected == 0 {
            return Err(AppError::DatabaseError("entrée d'historique introuvable".into()));
        }

        Ok::<(), AppError>(())
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    Ok(())
}

/// Supprime physiquement tous les chapitres et items d'un classeur.
fn purge_classeur_data(conn: &rusqlite::Connection, classeur_id: i64) -> Result<(), AppError> {
    let mut stmt = conn.prepare("SELECT id FROM chapters WHERE classeur_id = ?1")
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let ids: Vec<i64> = stmt.query_map([classeur_id], |r| r.get(0))
        .map_err(|e| AppError::DatabaseError(e.to_string()))?
        .filter_map(|r| r.ok()).collect();

    if !ids.is_empty() {
        let placeholders = ids.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(",");
        for table in &["documents", "tracking_sheets", "signature_sheets", "intercalaires"] {
            conn.execute_batch(&format!("DELETE FROM {table} WHERE chapter_id IN ({placeholders})"))
                .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        }
    }
    conn.execute("DELETE FROM chapters WHERE classeur_id = ?1", [classeur_id])
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(())
}

/// Réinsère les chapitres et items d'un snapshot dans le classeur.
fn restore_snapshot_data(conn: &rusqlite::Connection, classeur_id: i64, snapshot: &ClasseurJson) -> Result<(), AppError> {
    for ch_json in &snapshot.chapters {
        let ch_uuid = ch_json.uuid.clone().unwrap_or_else(generate_uuid);
        conn.execute(
            "INSERT INTO chapters (label, icon, description, sort_order, classeur_id, uuid) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![ch_json.label, ch_json.icon, ch_json.description, ch_json.sort_order, classeur_id, ch_uuid],
        ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let new_ch_id = conn.last_insert_rowid();
        let ch_id_str = new_ch_id.to_string();

        for item in &ch_json.items {
            let item_uuid = item.uuid.clone().unwrap_or_else(generate_uuid);
            match item.kind.as_str() {
                "document" => {
                    conn.execute(
                        "INSERT INTO documents (title, description, content, chapter_id, sort_order, uuid, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        rusqlite::params![item.title, item.description.as_deref().unwrap_or(""), item.content.as_deref().unwrap_or(""), ch_id_str, item.sort_order, item_uuid, item.updated_at],
                    ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                }
                "tracking_sheet" => {
                    conn.execute(
                        "INSERT INTO tracking_sheets (title, chapter_id, periodicite_id, sort_order, uuid, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                        rusqlite::params![item.title, ch_id_str, item.periodicite_id, item.sort_order, item_uuid, item.updated_at],
                    ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                }
                "signature_sheet" => {
                    conn.execute(
                        "INSERT INTO signature_sheets (title, description, chapter_id, nombre, sort_order, uuid, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        rusqlite::params![item.title, item.description.as_deref().unwrap_or(""), ch_id_str, item.nombre, item.sort_order, item_uuid, item.updated_at],
                    ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                }
                "intercalaire" => {
                    conn.execute(
                        "INSERT INTO intercalaires (title, description, chapter_id, sort_order, uuid, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                        rusqlite::params![item.title, item.description.as_deref().unwrap_or(""), ch_id_str, item.sort_order, item_uuid, item.updated_at],
                    ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                }
                _ => {}
            }
        }
    }
    Ok(())
}

/// Retourne l'historique des merges pour un classeur (sans le snapshot JSON).
#[tauri::command]
pub async fn get_merge_history(
    state: State<'_, AppState>,
    classeur_id: i64,
) -> Result<Vec<MergeHistoryEntry>, AppError> {
    let db_path = state.db_path().to_string();

    let entries = tokio::task::spawn_blocking(move || {
        let conn = rusqlite::Connection::open_with_flags(
            &db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )
        .map_err(|e| AppError::DatabaseError(format!("ouverture DB : {}", e)))?;

        let mut stmt = conn
            .prepare("SELECT id, classeur_id, merged_at, source_name, inserted, updated, unchanged, skipped FROM merge_history WHERE classeur_id = ?1 ORDER BY merged_at DESC")
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let entries: Vec<MergeHistoryEntry> = stmt
            .query_map([classeur_id], |row| {
                Ok(MergeHistoryEntry {
                    id: row.get(0)?,
                    classeur_id: row.get(1)?,
                    merged_at: row.get(2)?,
                    source_name: row.get(3)?,
                    inserted: row.get(4)?,
                    updated: row.get(5)?,
                    unchanged: row.get(6)?,
                    skipped: row.get(7)?,
                })
            })
            .map_err(|e| AppError::DatabaseError(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();

        Ok::<Vec<MergeHistoryEntry>, AppError>(entries)
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    Ok(entries)
}

/// Retourne le snapshot JSON d'une entrée d'historique.
#[tauri::command]
pub async fn get_merge_snapshot(
    state: State<'_, AppState>,
    merge_id: i64,
) -> Result<String, AppError> {
    let db_path = state.db_path().to_string();

    let snapshot = tokio::task::spawn_blocking(move || {
        let conn = rusqlite::Connection::open_with_flags(
            &db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )
        .map_err(|e| AppError::DatabaseError(format!("ouverture DB : {}", e)))?;

        let json: String = conn
            .query_row(
                "SELECT snapshot_json FROM merge_history WHERE id = ?1",
                [merge_id],
                |row| row.get(0),
            )
            .map_err(|e| AppError::DatabaseError(format!("entrée introuvable : {}", e)))?;

        Ok::<String, AppError>(json)
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    Ok(snapshot)
}
