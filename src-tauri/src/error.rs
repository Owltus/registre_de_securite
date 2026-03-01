use serde::Serialize;

/// Type d'erreur uniforme sérialisable vers le frontend
#[derive(Debug, thiserror::Error, Serialize)]
#[allow(dead_code)]
pub enum AppError {
    #[error("Erreur fichier : {0}")]
    FileError(String),

    #[error("Erreur base de données : {0}")]
    DatabaseError(String),

    #[error("Erreur inattendue : {0}")]
    Unknown(String),
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::FileError(err.to_string())
    }
}
