//! ユーザーが選んだ画像ファイルの読み込みと、スキルのアイコンの取得・保存。

use std::path::{Path, PathBuf};

use base64::Engine;
use tauri::Manager;

/// 読み込める画像の拡張子
const IMAGE_EXTS: &[&str] = &["png", "jpg", "jpeg"];
/// これより大きいファイルは読まない(誤って巨大なファイルを選んだとき用)
const MAX_IMAGE_BYTES: u64 = 40 * 1024 * 1024;

fn is_image(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| IMAGE_EXTS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

/// ユーザーが選んだ(ドロップした)画像ファイルを読む
#[tauri::command]
pub fn read_image_file(path: String) -> Result<tauri::ipc::Response, String> {
    let p = PathBuf::from(&path);
    if !is_image(&p) {
        return Err("PNG か JPEG の画像だけを読み込めます".to_string());
    }
    let meta = std::fs::metadata(&p).map_err(|_| "ファイルが見つかりませんでした".to_string())?;
    if meta.len() > MAX_IMAGE_BYTES {
        return Err("画像が大きすぎます".to_string());
    }
    let bytes = std::fs::read(&p).map_err(|_| "ファイルを読めませんでした".to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

/// フォルダの中の画像を、名前の順(撮った順になることが多い)に並べて返す
#[tauri::command]
pub fn list_images_in_folder(path: String) -> Result<Vec<String>, String> {
    let mut files: Vec<PathBuf> = std::fs::read_dir(&path)
        .map_err(|_| "フォルダを開けませんでした".to_string())?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.is_file() && is_image(p))
        .collect();
    files.sort();
    Ok(files.into_iter().map(|p| p.to_string_lossy().to_string()).collect())
}

/// スキルのアイコン(PNG)を data URL で返す。
/// データフォルダの icons に保存しておき、なければ GameTora から取得する。
#[tauri::command]
pub async fn skill_icon(app: tauri::AppHandle, icon_id: u32) -> Result<Option<String>, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("icons");
    let file = dir.join(format!("skill_{icon_id}.png"));
    let bytes = if let Ok(b) = std::fs::read(&file) {
        b
    } else {
        let url = format!("https://gametora.com/images/umamusume/skill_icons/utx_ico_skill_{icon_id}.png");
        let client = reqwest::Client::builder()
            .user_agent(concat!("mamusu_hikaku/", env!("CARGO_PKG_VERSION"), " (+https://github.com/naraha237/mamusu_hikaku)"))
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| e.to_string())?;
        let Ok(res) = client.get(url).send().await else { return Ok(None) };
        if !res.status().is_success() {
            return Ok(None);
        }
        let b = res.bytes().await.map_err(|e| e.to_string())?.to_vec();
        if b.len() < 8 || &b[1..4] != b"PNG" {
            return Ok(None);
        }
        let _ = std::fs::create_dir_all(&dir);
        let _ = std::fs::write(&file, &b);
        b
    };
    Ok(Some(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    )))
}
