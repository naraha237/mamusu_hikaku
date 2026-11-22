//! アプリのデータフォルダ(%APPDATA%\com.naraha237.mamusuhikaku)の中のファイルを読み書きする。
//! インストーラー版・単体版のどちらでも同じ場所を使う。

use std::path::PathBuf;
use tauri::Manager;

/// ファイル名だけを受け付ける(フォルダの外を指せないようにする)
fn data_path(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    let ok = !name.is_empty()
        && !name.starts_with('.')
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.');
    if !ok {
        return Err(format!("使えないファイル名です: {name}"));
    }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(name))
}

#[tauri::command]
pub fn read_data_file(app: tauri::AppHandle, name: String) -> Result<Option<String>, String> {
    let path = data_path(&app, &name)?;
    match std::fs::read_to_string(&path) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// 書きかけで壊れないよう、一時ファイルに書いてから置き換える
#[tauri::command]
pub fn write_data_file(app: tauri::AppHandle, name: String, contents: String) -> Result<(), String> {
    let path = data_path(&app, &name)?;
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, contents).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())
}
