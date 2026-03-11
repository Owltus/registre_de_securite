use crate::error::AppError;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;

// ── Structs serde pour l'export/import JSON ────────────────────────

#[derive(Serialize, Deserialize)]
struct ClasseurJson {
    format_version: u32,
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

#[derive(Serialize, Deserialize)]
struct ChapterJson {
    uid: String,
    label: String,
    icon: String,
    description: String,
    sort_order: i64,
    items: Vec<ItemJson>,
}

#[derive(Serialize, Deserialize)]
struct ItemJson {
    kind: String,
    title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    periodicite_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    nombre: Option<i64>,
    sort_order: i64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MergeResult {
    pub inserted: u32,
    pub updated: u32,
    pub unchanged: u32,
}

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

/// Lit le contenu d'un fichier texte
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, AppError> {
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| AppError::FileError(format!("{}: {}", path, e)))
}

/// Écrit du contenu dans un fichier texte
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), AppError> {
    tokio::fs::write(&path, &content)
        .await
        .map_err(|e| AppError::FileError(format!("{}: {}", path, e)))
}

/// Écrit des données binaires dans un fichier
#[tauri::command]
pub async fn write_file_binary(path: String, data: Vec<u8>) -> Result<(), AppError> {
    tokio::fs::write(&path, &data)
        .await
        .map_err(|e| AppError::FileError(format!("{}: {}", path, e)))
}

/// Exporte un classeur au format JSON lisible (sans IDs internes).
/// Retourne la string JSON ; le frontend se charge du dialogue de sauvegarde.
#[tauri::command]
pub async fn export_classeur_json(
    state: State<'_, AppState>,
    classeur_id: i64,
) -> Result<String, AppError> {
    let db_path = state.db_path().to_string();

    let json = tokio::task::spawn_blocking(move || {
        let conn = rusqlite::Connection::open_with_flags(
            &db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )
        .map_err(|e| AppError::DatabaseError(format!("ouverture DB : {}", e)))?;

        // Lire le classeur
        let (name, icon, etablissement, complement): (String, String, String, String) = conn
            .query_row(
                "SELECT COALESCE(name,''), COALESCE(icon,'BookOpen'), COALESCE(etablissement,''), COALESCE(etablissement_complement,'') FROM classeurs WHERE id = ?1",
                [classeur_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .map_err(|e| AppError::DatabaseError(format!("classeur introuvable : {}", e)))?;

        // Lire les chapitres
        let mut stmt = conn
            .prepare("SELECT id, label, icon, description, sort_order FROM chapters WHERE classeur_id = ?1 ORDER BY sort_order")
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let chapters_raw: Vec<(i64, String, String, String, i64)> = stmt
            .query_map([classeur_id], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
            })
            .map_err(|e| AppError::DatabaseError(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();

        // Charger tous les items en 4 requêtes bulk, groupés par chapter_id
        let ch_ids: Vec<String> = chapters_raw.iter().map(|(id, ..)| id.to_string()).collect();
        let placeholders = ch_ids.iter().map(|id| format!("'{}'", id.replace('\'', "''"))).collect::<Vec<_>>().join(",");

        let mut items_by_chapter: HashMap<String, Vec<ItemJson>> = HashMap::new();

        if !ch_ids.is_empty() {
            // Documents
            let mut s = conn.prepare(&format!(
                "SELECT chapter_id, title, description, content, sort_order FROM documents WHERE chapter_id IN ({placeholders}) ORDER BY sort_order"
            )).map_err(|e| AppError::DatabaseError(e.to_string()))?;
            let rows = s.query_map([], |row| {
                Ok((row.get::<_, String>(0)?, ItemJson {
                    kind: "document".to_string(),
                    title: row.get(1)?,
                    description: row.get(2)?,
                    content: row.get(3)?,
                    periodicite_id: None,
                    nombre: None,
                    sort_order: row.get(4)?,
                }))
            }).map_err(|e| AppError::DatabaseError(e.to_string()))?;
            for r in rows { if let Ok((cid, item)) = r { items_by_chapter.entry(cid).or_default().push(item); } }

            // Feuilles de suivi
            let mut s = conn.prepare(&format!(
                "SELECT chapter_id, title, periodicite_id, sort_order FROM tracking_sheets WHERE chapter_id IN ({placeholders}) ORDER BY sort_order"
            )).map_err(|e| AppError::DatabaseError(e.to_string()))?;
            let rows = s.query_map([], |row| {
                Ok((row.get::<_, String>(0)?, ItemJson {
                    kind: "tracking_sheet".to_string(),
                    title: row.get(1)?,
                    description: None,
                    content: None,
                    periodicite_id: row.get(2)?,
                    nombre: None,
                    sort_order: row.get(3)?,
                }))
            }).map_err(|e| AppError::DatabaseError(e.to_string()))?;
            for r in rows { if let Ok((cid, item)) = r { items_by_chapter.entry(cid).or_default().push(item); } }

            // Feuilles de signature
            let mut s = conn.prepare(&format!(
                "SELECT chapter_id, title, description, nombre, sort_order FROM signature_sheets WHERE chapter_id IN ({placeholders}) ORDER BY sort_order"
            )).map_err(|e| AppError::DatabaseError(e.to_string()))?;
            let rows = s.query_map([], |row| {
                Ok((row.get::<_, String>(0)?, ItemJson {
                    kind: "signature_sheet".to_string(),
                    title: row.get(1)?,
                    description: row.get(2)?,
                    content: None,
                    periodicite_id: None,
                    nombre: row.get(3)?,
                    sort_order: row.get(4)?,
                }))
            }).map_err(|e| AppError::DatabaseError(e.to_string()))?;
            for r in rows { if let Ok((cid, item)) = r { items_by_chapter.entry(cid).or_default().push(item); } }

            // Intercalaires
            let mut s = conn.prepare(&format!(
                "SELECT chapter_id, title, description, sort_order FROM intercalaires WHERE chapter_id IN ({placeholders}) ORDER BY sort_order"
            )).map_err(|e| AppError::DatabaseError(e.to_string()))?;
            let rows = s.query_map([], |row| {
                Ok((row.get::<_, String>(0)?, ItemJson {
                    kind: "intercalaire".to_string(),
                    title: row.get(1)?,
                    description: row.get(2)?,
                    content: None,
                    periodicite_id: None,
                    nombre: None,
                    sort_order: row.get(3)?,
                }))
            }).map_err(|e| AppError::DatabaseError(e.to_string()))?;
            for r in rows { if let Ok((cid, item)) = r { items_by_chapter.entry(cid).or_default().push(item); } }
        }

        // Assembler les chapitres avec leurs items
        let mut slug_counts: HashMap<String, u32> = HashMap::new();
        let mut chapter_jsons = Vec::new();

        for (ch_id, label, ch_icon, description, sort_order) in &chapters_raw {
            let base_slug = slugify(label);
            let count = slug_counts.entry(base_slug.clone()).or_insert(0);
            *count += 1;
            let uid = if *count == 1 {
                base_slug
            } else {
                format!("{}-{}", base_slug, count)
            };

            let items = items_by_chapter.remove(&ch_id.to_string()).unwrap_or_default();

            chapter_jsons.push(ChapterJson {
                uid,
                label: label.clone(),
                icon: ch_icon.clone(),
                description: description.clone(),
                sort_order: *sort_order,
                items,
            });
        }

        let export = ClasseurJson {
            format_version: 1,
            classeur: ClasseurData { name, icon, etablissement, etablissement_complement: complement },
            chapters: chapter_jsons,
        };

        serde_json::to_string_pretty(&export)
            .map_err(|e| AppError::Unknown(format!("sérialisation JSON : {}", e)))
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    Ok(json)
}

/// Logique partagée d'import JSON en tant que nouveau classeur.
/// Parse le JSON, crée un nouveau classeur et insère chapitres + items.
/// Retourne l'ID du nouveau classeur.
fn do_import_json(db_path: &str, json_content: &str) -> Result<i64, AppError> {
    let data: ClasseurJson = serde_json::from_str(json_content)
        .map_err(|e| AppError::FileError(format!("JSON invalide : {}", e)))?;

    if data.format_version != 1 {
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

    // Prochain sort_order pour le classeur
    let next_order: i64 = conn
        .query_row("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM classeurs", [], |r| r.get(0))
        .unwrap_or(1);

    // Insérer le classeur
    conn.execute(
        "INSERT INTO classeurs (name, icon, etablissement, etablissement_complement, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![data.classeur.name, data.classeur.icon, data.classeur.etablissement, data.classeur.etablissement_complement, next_order],
    )
    .map_err(|e| AppError::DatabaseError(format!("insert classeur : {}", e)))?;
    let new_classeur_id = conn.last_insert_rowid();

    // Insérer les chapitres et leurs items
    for ch_json in &data.chapters {
        conn.execute(
            "INSERT INTO chapters (label, icon, description, sort_order, classeur_id) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![ch_json.label, ch_json.icon, ch_json.description, ch_json.sort_order, new_classeur_id],
        )
        .map_err(|e| AppError::DatabaseError(format!("insert chapter : {}", e)))?;
        let new_ch_id = conn.last_insert_rowid();
        let ch_id_str = new_ch_id.to_string();

        for item in &ch_json.items {
            match item.kind.as_str() {
                "document" => {
                    conn.execute(
                        "INSERT INTO documents (title, description, content, chapter_id, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
                        rusqlite::params![item.title, item.description.as_deref().unwrap_or(""), item.content.as_deref().unwrap_or(""), ch_id_str, item.sort_order],
                    ).map_err(|e| AppError::DatabaseError(format!("documents : {}", e)))?;
                }
                "tracking_sheet" => {
                    conn.execute(
                        "INSERT INTO tracking_sheets (title, chapter_id, periodicite_id, sort_order) VALUES (?1, ?2, ?3, ?4)",
                        rusqlite::params![item.title, ch_id_str, item.periodicite_id, item.sort_order],
                    ).map_err(|e| AppError::DatabaseError(format!("tracking_sheets : {}", e)))?;
                }
                "signature_sheet" => {
                    conn.execute(
                        "INSERT INTO signature_sheets (title, description, chapter_id, nombre, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
                        rusqlite::params![item.title, item.description.as_deref().unwrap_or(""), ch_id_str, item.nombre, item.sort_order],
                    ).map_err(|e| AppError::DatabaseError(format!("signature_sheets : {}", e)))?;
                }
                "intercalaire" => {
                    conn.execute(
                        "INSERT INTO intercalaires (title, description, chapter_id, sort_order) VALUES (?1, ?2, ?3, ?4)",
                        rusqlite::params![item.title, item.description.as_deref().unwrap_or(""), ch_id_str, item.sort_order],
                    ).map_err(|e| AppError::DatabaseError(format!("intercalaires : {}", e)))?;
                }
                _ => {
                    // Kind inconnu — ignorer silencieusement (forward compatibility)
                }
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

/// Importe un fichier JSON dans un classeur existant avec merge intelligent.
/// Insert/update sans suppression. Retourne les compteurs de merge.
#[tauri::command]
pub async fn import_classeur_json(
    state: State<'_, AppState>,
    classeur_id: i64,
    path: String,
) -> Result<MergeResult, AppError> {
    let db_path = state.db_path().to_string();

    let result = tokio::task::spawn_blocking(move || {
        // Lire et désérialiser le fichier JSON
        let content = std::fs::read_to_string(&path)
            .map_err(|e| AppError::FileError(format!("{}: {}", path, e)))?;
        let data: ClasseurJson = serde_json::from_str(&content)
            .map_err(|e| AppError::FileError(format!("JSON invalide : {}", e)))?;

        if data.format_version != 1 {
            return Err(AppError::FileError(format!(
                "Version de format non supportée : {}",
                data.format_version
            )));
        }

        let conn = rusqlite::Connection::open_with_flags(
            &db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE,
        )
        .map_err(|e| AppError::DatabaseError(format!("ouverture DB : {}", e)))?;

        conn.execute_batch("BEGIN")
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let mut result = MergeResult { inserted: 0, updated: 0, unchanged: 0 };

        // Charger les chapitres existants du classeur → HashMap<slug, (id, label, icon, description)>
        let mut existing_chapters: HashMap<String, (i64, String, String, String)> = HashMap::new();
        {
            let mut stmt = conn
                .prepare("SELECT id, label, icon, description FROM chapters WHERE classeur_id = ?1")
                .map_err(|e| AppError::DatabaseError(e.to_string()))?;
            let rows = stmt
                .query_map([classeur_id], |row| {
                    Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?, row.get::<_, String>(3)?))
                })
                .map_err(|e| AppError::DatabaseError(e.to_string()))?;
            for r in rows {
                if let Ok((id, label, icon, desc)) = r {
                    existing_chapters.insert(slugify(&label), (id, label, icon, desc));
                }
            }
        }

        // Prochain sort_order pour les nouveaux chapitres
        let mut next_ch_order: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM chapters WHERE classeur_id = ?1",
                [classeur_id],
                |r| r.get(0),
            )
            .unwrap_or(1);

        for ch_json in &data.chapters {
            let slug = slugify(&ch_json.label);
            let ch_id: i64;

            if let Some((existing_id, existing_label, existing_icon, existing_desc)) = existing_chapters.get(&slug) {
                ch_id = *existing_id;
                if *existing_label != ch_json.label || *existing_icon != ch_json.icon || *existing_desc != ch_json.description {
                    conn.execute(
                        "UPDATE chapters SET label = ?1, icon = ?2, description = ?3 WHERE id = ?4",
                        rusqlite::params![ch_json.label, ch_json.icon, ch_json.description, ch_id],
                    )
                    .map_err(|e| AppError::DatabaseError(e.to_string()))?;
                    result.updated += 1;
                } else {
                    result.unchanged += 1;
                }
            } else {
                conn.execute(
                    "INSERT INTO chapters (label, icon, description, sort_order, classeur_id) VALUES (?1, ?2, ?3, ?4, ?5)",
                    rusqlite::params![ch_json.label, ch_json.icon, ch_json.description, next_ch_order, classeur_id],
                )
                .map_err(|e| AppError::DatabaseError(e.to_string()))?;
                ch_id = conn.last_insert_rowid();
                next_ch_order += 1;
                result.inserted += 1;
            }

            let ch_id_str = ch_id.to_string();

            for item in &ch_json.items {
                match item.kind.as_str() {
                    "document" => {
                        let existing: Option<(i64, String, String)> = conn
                            .query_row(
                                "SELECT id, COALESCE(description,''), COALESCE(content,'') FROM documents WHERE chapter_id = ?1 AND title = ?2",
                                rusqlite::params![ch_id_str, item.title],
                                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                            )
                            .ok();
                        if let Some((doc_id, old_desc, old_content)) = existing {
                            let new_desc = item.description.as_deref().unwrap_or("");
                            let new_content = item.content.as_deref().unwrap_or("");
                            if old_desc != new_desc || old_content != new_content {
                                conn.execute(
                                    "UPDATE documents SET description = ?1, content = ?2, updated_at = datetime('now') WHERE id = ?3",
                                    rusqlite::params![new_desc, new_content, doc_id],
                                ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                                result.updated += 1;
                            } else {
                                result.unchanged += 1;
                            }
                        } else {
                            conn.execute(
                                "INSERT INTO documents (title, description, content, chapter_id, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
                                rusqlite::params![item.title, item.description.as_deref().unwrap_or(""), item.content.as_deref().unwrap_or(""), ch_id_str, item.sort_order],
                            ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                            result.inserted += 1;
                        }
                    }
                    "tracking_sheet" => {
                        let existing: Option<(i64, Option<i64>)> = conn
                            .query_row(
                                "SELECT id, periodicite_id FROM tracking_sheets WHERE chapter_id = ?1 AND title = ?2",
                                rusqlite::params![ch_id_str, item.title],
                                |row| Ok((row.get(0)?, row.get(1)?)),
                            )
                            .ok();
                        if let Some((ts_id, old_perio)) = existing {
                            if old_perio != item.periodicite_id {
                                conn.execute(
                                    "UPDATE tracking_sheets SET periodicite_id = ?1, updated_at = datetime('now') WHERE id = ?2",
                                    rusqlite::params![item.periodicite_id, ts_id],
                                ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                                result.updated += 1;
                            } else {
                                result.unchanged += 1;
                            }
                        } else {
                            conn.execute(
                                "INSERT INTO tracking_sheets (title, chapter_id, periodicite_id, sort_order) VALUES (?1, ?2, ?3, ?4)",
                                rusqlite::params![item.title, ch_id_str, item.periodicite_id, item.sort_order],
                            ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                            result.inserted += 1;
                        }
                    }
                    "signature_sheet" => {
                        let existing: Option<(i64, String, Option<i64>)> = conn
                            .query_row(
                                "SELECT id, COALESCE(description,''), nombre FROM signature_sheets WHERE chapter_id = ?1 AND title = ?2",
                                rusqlite::params![ch_id_str, item.title],
                                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                            )
                            .ok();
                        if let Some((ss_id, old_desc, old_nombre)) = existing {
                            let new_desc = item.description.as_deref().unwrap_or("");
                            if old_desc != new_desc || old_nombre != item.nombre {
                                conn.execute(
                                    "UPDATE signature_sheets SET description = ?1, nombre = ?2, updated_at = datetime('now') WHERE id = ?3",
                                    rusqlite::params![new_desc, item.nombre, ss_id],
                                ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                                result.updated += 1;
                            } else {
                                result.unchanged += 1;
                            }
                        } else {
                            conn.execute(
                                "INSERT INTO signature_sheets (title, description, chapter_id, nombre, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
                                rusqlite::params![item.title, item.description.as_deref().unwrap_or(""), ch_id_str, item.nombre, item.sort_order],
                            ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                            result.inserted += 1;
                        }
                    }
                    "intercalaire" => {
                        let existing: Option<(i64, String)> = conn
                            .query_row(
                                "SELECT id, COALESCE(description,'') FROM intercalaires WHERE chapter_id = ?1 AND title = ?2",
                                rusqlite::params![ch_id_str, item.title],
                                |row| Ok((row.get(0)?, row.get(1)?)),
                            )
                            .ok();
                        if let Some((int_id, old_desc)) = existing {
                            let new_desc = item.description.as_deref().unwrap_or("");
                            if old_desc != new_desc {
                                conn.execute(
                                    "UPDATE intercalaires SET description = ?1, updated_at = datetime('now') WHERE id = ?2",
                                    rusqlite::params![new_desc, int_id],
                                ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                                result.updated += 1;
                            } else {
                                result.unchanged += 1;
                            }
                        } else {
                            conn.execute(
                                "INSERT INTO intercalaires (title, description, chapter_id, sort_order) VALUES (?1, ?2, ?3, ?4)",
                                rusqlite::params![item.title, item.description.as_deref().unwrap_or(""), ch_id_str, item.sort_order],
                            ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
                            result.inserted += 1;
                        }
                    }
                    _ => {
                        // Kind inconnu — ignorer silencieusement (forward compatibility)
                    }
                }
            }
        }

        conn.execute_batch("COMMIT")
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok::<MergeResult, AppError>(result)
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    Ok(result)
}
