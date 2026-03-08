mod commands;
mod error;
mod state;

use state::AppState;
use tauri::Manager;

/// Résout le dossier de données selon le mode d'exécution :
/// - Dev : `<racine du projet>/sqlite/` (via CARGO_MANIFEST_DIR)
/// - Production portable : `<dossier de l'exe>/sqlite/` (si fichier `portable` présent à côté de l'exe)
/// - Production installée : `<AppData>/com.registre.securite/sqlite/`
fn resolve_db_path() -> String {
    let base_dir = if cfg!(debug_assertions) {
        // Dev : CARGO_MANIFEST_DIR pointe vers src-tauri/, on remonte à la racine
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("impossible de résoudre la racine du projet")
            .to_path_buf()
    } else {
        let exe_dir = std::env::current_exe()
            .expect("impossible de résoudre le chemin de l'exécutable")
            .parent()
            .expect("impossible de résoudre le dossier parent")
            .to_path_buf();

        if exe_dir.join("portable").exists() {
            // Mode portable : données à côté de l'exécutable
            exe_dir
        } else {
            // Mode installé : données dans AppData
            dirs::data_dir()
                .expect("impossible de résoudre le dossier AppData")
                .join("com.registre.securite")
        }
    };

    let sqlite_dir = base_dir.join("sqlite");
    std::fs::create_dir_all(&sqlite_dir).expect("impossible de créer le dossier sqlite");
    let db_path = sqlite_dir.join("classeur.db");
    format!("sqlite:{}", db_path.display())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_url = resolve_db_path();

    tauri::Builder::default()
        .manage(AppState::new(db_url.clone()))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    &db_url,
                    vec![
                        tauri_plugin_sql::Migration {
                            version: 1,
                            description: "initialisation de la base de données",
                            sql: include_str!("../sql/schema.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 2,
                            description: "feuilles de signature",
                            sql: include_str!("../sql/v2_signature_sheets.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 3,
                            description: "support multi-classeurs",
                            sql: include_str!("../sql/v3_classeurs.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 4,
                            description: "établissement sur le classeur",
                            sql: include_str!("../sql/v4_etablissement.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                    ],
                )
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::app::get_app_info,
            commands::app::get_db_url,
            commands::files::read_file,
            commands::files::write_file,
        ])
        .setup(|app| {
            // Définir l'icône de la fenêtre (visible en dev et en build)
            if let Some(window) = app.get_webview_window("main") {
                let icon_bytes = include_bytes!("../icons/icon.png");
                let img = image::load_from_memory(icon_bytes).expect("invalid icon");
                let rgba = img.to_rgba8();
                let (w, h) = rgba.dimensions();
                let tauri_icon = tauri::image::Image::new_owned(rgba.into_raw(), w, h);
                let _ = window.set_icon(tauri_icon);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
