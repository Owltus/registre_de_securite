use crate::error::AppError;
use std::path::PathBuf;

/// Génère un PDF vectoriel à partir de HTML en utilisant Edge/Chrome headless.
/// Le navigateur Chromium (Edge ou Chrome) est détecté automatiquement.
#[tauri::command]
pub async fn generate_pdf(html: String, output_path: String) -> Result<(), AppError> {
    let browser = find_chromium_browser().await
        .ok_or_else(|| AppError::FileError(
            "Aucun navigateur compatible trouvé (Microsoft Edge ou Google Chrome). \
             Installez Microsoft Edge ou Google Chrome pour générer des PDF.".into()
        ))?;

    // Fichier temp unique par invocation (pid + timestamp)
    let temp_name = format!(
        "registre_print_{}_{}.html",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );
    let temp_path = std::env::temp_dir().join(temp_name);

    // Assurer le nettoyage du fichier temp même en cas d'erreur
    let result = generate_pdf_inner(&browser, &html, &temp_path, &output_path).await;
    let _ = tokio::fs::remove_file(&temp_path).await;
    result
}

async fn generate_pdf_inner(
    browser: &str,
    html: &str,
    temp_path: &PathBuf,
    output_path: &str,
) -> Result<(), AppError> {
    tokio::fs::write(temp_path, html).await?;

    // Construire l'URL file:// du fichier temporaire
    // Note : temp_dir() ne produit pas de chemins UNC, le replace est sûr ici
    let file_url = format!("file:///{}", temp_path.display().to_string().replace('\\', "/"));

    let output = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        tokio::process::Command::new(browser)
            .arg("--headless")
            .arg("--disable-gpu")
            .arg(format!("--print-to-pdf={}", output_path))
            .arg("--no-pdf-header-footer")
            .arg("--run-all-compositor-stages-before-draw")
            .arg("--disable-extensions")
            .arg("--no-first-run")
            .arg("--disable-default-apps")
            .arg(&file_url)
            .output(),
    )
    .await
    .map_err(|_| AppError::FileError("Délai dépassé : le navigateur n'a pas répondu en 30 secondes.".into()))?
    .map_err(|e| AppError::FileError(format!("Erreur lancement navigateur : {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::FileError(format!(
            "Le navigateur a échoué (code {}) : {}",
            output.status.code().unwrap_or(-1),
            stderr.chars().take(500).collect::<String>()
        )));
    }

    // Vérifier que le PDF a bien été créé et n'est pas vide
    let metadata = tokio::fs::metadata(output_path).await
        .map_err(|_| AppError::FileError(
            "Le PDF n'a pas été créé. Vérifiez que le chemin de destination est accessible.".into()
        ))?;

    if metadata.len() == 0 {
        let _ = tokio::fs::remove_file(output_path).await;
        return Err(AppError::FileError(
            "Le PDF généré est vide. Vérifiez le contenu du document.".into()
        ));
    }

    Ok(())
}

/// Cherche un navigateur Chromium installé sur le système.
async fn find_chromium_browser() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let candidates = [
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ];
        for path in &candidates {
            if std::path::Path::new(path).exists() {
                return Some(path.to_string());
            }
        }
        None
    }

    #[cfg(target_os = "macos")]
    {
        let candidates = [
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ];
        for path in &candidates {
            if std::path::Path::new(path).exists() {
                return Some(path.to_string());
            }
        }
        None
    }

    #[cfg(target_os = "linux")]
    {
        let candidates = [
            "microsoft-edge-stable",
            "google-chrome",
            "google-chrome-stable",
            "chromium-browser",
            "chromium",
        ];
        for name in &candidates {
            let found = tokio::process::Command::new("which")
                .arg(name)
                .output()
                .await
                .map(|o| o.status.success())
                .unwrap_or(false);
            if found {
                return Some(name.to_string());
            }
        }
        None
    }
}
