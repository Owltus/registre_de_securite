use crate::error::AppError;
use crate::state::AppState;
use tauri::State;

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

/// Exporte un classeur unique vers un fichier SQLite destination.
/// 1. Checkpoint WAL pour consolider -wal et -shm
/// 2. Copie le .db vers la destination
/// 3. Purge les données des autres classeurs
/// 4. VACUUM pour réduire la taille
#[tauri::command]
pub async fn export_database(
    state: State<'_, AppState>,
    dest: String,
    classeur_id: i64,
) -> Result<(), AppError> {
    let db_url = &state.db_url;
    let db_path = db_url.strip_prefix("sqlite:").unwrap_or(db_url);

    // Checkpoint WAL — force l'écriture de toutes les données dans le .db
    let path_owned = db_path.to_string();
    let dest_owned = dest.clone();
    tokio::task::spawn_blocking(move || {
        // Checkpoint sur la source
        let src = rusqlite::Connection::open_with_flags(
            &path_owned,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE,
        )
        .map_err(|e| AppError::DatabaseError(format!("ouverture checkpoint : {}", e)))?;
        src.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
            .map_err(|e| AppError::DatabaseError(format!("checkpoint : {}", e)))?;
        drop(src);

        // Copier le .db vers la destination
        std::fs::copy(&path_owned, &dest_owned)
            .map_err(|e| AppError::FileError(format!("copie : {}", e)))?;

        // Ouvrir la copie et purger les autres classeurs
        let conn = rusqlite::Connection::open(&dest_owned)
            .map_err(|e| AppError::DatabaseError(format!("ouverture export : {}", e)))?;

        conn.execute_batch("PRAGMA journal_mode=DELETE;")
            .map_err(|e| AppError::DatabaseError(format!("journal_mode : {}", e)))?;

        let sub = "SELECT id FROM chapters WHERE classeur_id = ?1";
        conn.execute(
            &format!("DELETE FROM intercalaires WHERE chapter_id NOT IN ({sub})"),
            [classeur_id],
        )
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        conn.execute(
            &format!("DELETE FROM signature_sheets WHERE chapter_id NOT IN ({sub})"),
            [classeur_id],
        )
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        conn.execute(
            &format!("DELETE FROM tracking_sheets WHERE chapter_id NOT IN ({sub})"),
            [classeur_id],
        )
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        conn.execute(
            &format!("DELETE FROM documents WHERE chapter_id NOT IN ({sub})"),
            [classeur_id],
        )
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        conn.execute("DELETE FROM chapters WHERE classeur_id != ?1", [classeur_id])
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        conn.execute("DELETE FROM classeurs WHERE id != ?1", [classeur_id])
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        conn.execute_batch("VACUUM;")
            .map_err(|e| AppError::DatabaseError(format!("vacuum : {}", e)))?;

        Ok::<(), AppError>(())
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    Ok(())
}

/// Logique partagée d'import : attache le fichier source, copie le classeur
/// et toutes ses données dans la base principale avec de nouveaux IDs.
fn do_import(db_path: &str, source_path: &str) -> Result<i64, AppError> {
    let conn = rusqlite::Connection::open_with_flags(
        db_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE,
    )
    .map_err(|e| AppError::DatabaseError(format!("ouverture DB : {}", e)))?;

    // Attacher la base importée
    conn.execute("ATTACH DATABASE ?1 AS imported", [source_path])
        .map_err(|e| AppError::DatabaseError(format!("attach : {}", e)))?;

    // Lire le classeur source (on prend le premier)
    let (src_id, name, icon, etablissement, complement): (i64, String, String, String, String) = conn
        .query_row(
            "SELECT id, COALESCE(name,''), COALESCE(icon,'BookOpen'), COALESCE(etablissement,''), COALESCE(etablissement_complement,'') FROM imported.classeurs LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        )
        .map_err(|e| AppError::DatabaseError(format!("lecture classeur importé : {}", e)))?;

    // Prochain sort_order
    let next_order: i64 = conn
        .query_row("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM classeurs", [], |r| r.get(0))
        .unwrap_or(1);

    // Insérer le classeur
    conn.execute(
        "INSERT INTO classeurs (name, icon, etablissement, etablissement_complement, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![name, icon, etablissement, complement, next_order],
    )
    .map_err(|e| AppError::DatabaseError(format!("insert classeur : {}", e)))?;
    let new_classeur_id = conn.last_insert_rowid();

    // Copier les chapitres
    let mut stmt = conn
        .prepare("SELECT id, label, icon, description, sort_order FROM imported.chapters WHERE classeur_id = ?1 ORDER BY sort_order")
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let chapters: Vec<(i64, String, String, String, i64)> = stmt
        .query_map([src_id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)))
        .map_err(|e| AppError::DatabaseError(e.to_string()))?
        .filter_map(|r| r.ok())
        .collect();

    for (old_ch_id, label, ch_icon, description, sort_order) in &chapters {
        conn.execute(
            "INSERT INTO chapters (label, icon, description, sort_order, classeur_id) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![label, ch_icon, description, sort_order, new_classeur_id],
        )
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let new_ch_id = conn.last_insert_rowid();

        // chapter_id est TEXT dans le schéma — convertir les IDs en string
        // pour rester cohérent avec le frontend qui stocke String(chapterId)
        let new_ch_str = new_ch_id.to_string();
        let old_ch_str = old_ch_id.to_string();

        // Documents
        conn.execute(
            "INSERT INTO documents (title, description, content, chapter_id, sort_order, created_at, updated_at) \
             SELECT title, description, content, ?1, sort_order, created_at, updated_at FROM imported.documents WHERE chapter_id = ?2",
            rusqlite::params![new_ch_str, old_ch_str],
        )
        .map_err(|e| AppError::DatabaseError(format!("documents : {}", e)))?;

        // Feuilles de suivi
        conn.execute(
            "INSERT INTO tracking_sheets (title, chapter_id, periodicite_id, sort_order, created_at, updated_at) \
             SELECT title, ?1, periodicite_id, sort_order, created_at, updated_at FROM imported.tracking_sheets WHERE chapter_id = ?2",
            rusqlite::params![new_ch_str, old_ch_str],
        )
        .map_err(|e| AppError::DatabaseError(format!("tracking_sheets : {}", e)))?;

        // Feuilles de signature
        conn.execute(
            "INSERT INTO signature_sheets (title, description, chapter_id, nombre, sort_order, created_at, updated_at) \
             SELECT title, description, ?1, nombre, sort_order, created_at, updated_at FROM imported.signature_sheets WHERE chapter_id = ?2",
            rusqlite::params![new_ch_str, old_ch_str],
        )
        .map_err(|e| AppError::DatabaseError(format!("signature_sheets : {}", e)))?;

        // Intercalaires
        conn.execute(
            "INSERT INTO intercalaires (title, description, chapter_id, sort_order, created_at, updated_at) \
             SELECT title, description, ?1, sort_order, created_at, updated_at FROM imported.intercalaires WHERE chapter_id = ?2",
            rusqlite::params![new_ch_str, old_ch_str],
        )
        .map_err(|e| AppError::DatabaseError(format!("intercalaires : {}", e)))?;
    }

    conn.execute_batch("DETACH DATABASE imported;")
        .map_err(|e| AppError::DatabaseError(format!("detach : {}", e)))?;

    Ok(new_classeur_id)
}

/// Importe un classeur depuis un fichier SQLite exporté (via dialogue fichier).
/// Retourne l'ID du classeur importé.
#[tauri::command]
pub async fn import_database(
    state: State<'_, AppState>,
    source: String,
) -> Result<i64, AppError> {
    let db_url = &state.db_url;
    let db_path = db_url.strip_prefix("sqlite:").unwrap_or(db_url).to_string();
    let source_owned = source.clone();

    let new_id = tokio::task::spawn_blocking(move || {
        do_import(&db_path, &source_owned)
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    Ok(new_id)
}

/// Importe un classeur depuis des octets bruts (drag-and-drop).
/// Écrit les données dans un fichier temporaire, importe, puis nettoie.
/// Retourne l'ID du classeur importé.
#[tauri::command]
pub async fn import_database_from_bytes(
    state: State<'_, AppState>,
    data: Vec<u8>,
) -> Result<i64, AppError> {
    let db_url = &state.db_url;
    let db_path = db_url.strip_prefix("sqlite:").unwrap_or(db_url).to_string();

    let new_id = tokio::task::spawn_blocking(move || {
        // Écrire dans un fichier temporaire
        let temp_dir = std::env::temp_dir();
        let temp_path = temp_dir.join("registre_import_temp.db");
        std::fs::write(&temp_path, &data)
            .map_err(|e| AppError::FileError(format!("écriture temp : {}", e)))?;

        let result = do_import(&db_path, &temp_path.to_string_lossy());

        // Nettoyer le fichier temporaire
        let _ = std::fs::remove_file(&temp_path);

        result
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    Ok(new_id)
}
