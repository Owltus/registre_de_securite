use std::sync::Mutex;

/// État global de l'application, partagé entre toutes les commandes Tauri
pub struct AppState {
    pub config: Mutex<AppConfig>,
    pub db_url: String,
}

pub struct AppConfig {
    pub app_name: String,
    pub version: String,
}

impl AppState {
    pub fn new(db_url: String) -> Self {
        Self {
            config: Mutex::new(AppConfig {
                app_name: "Registre".to_string(),
                version: env!("CARGO_PKG_VERSION").to_string(),
            }),
            db_url,
        }
    }

    /// Retourne le chemin du fichier SQLite (sans le préfixe "sqlite:")
    pub fn db_path(&self) -> &str {
        self.db_url.strip_prefix("sqlite:").unwrap_or(&self.db_url)
    }
}
