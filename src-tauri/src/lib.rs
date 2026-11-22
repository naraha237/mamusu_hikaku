use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    version: String,
    /// インストーラー版なら true、単体exe版なら false
    installed: bool,
}

/// インストーラー版かどうかを判定する。
/// NSIS でインストールすると、exe と同じフォルダに uninstall.exe が置かれる。
fn is_installed() -> bool {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("uninstall.exe").exists()))
        .unwrap_or(false)
}

#[tauri::command]
fn app_info(app: tauri::AppHandle) -> AppInfo {
    AppInfo {
        version: app.package_info().version.to_string(),
        installed: is_installed(),
    }
}

/// 既定の設定(resources/default-config.json)の中身を返す。
/// 単体exe版でも使えるよう、ビルド時に exe に埋め込む。
#[tauri::command]
fn default_config() -> Result<serde_json::Value, String> {
    serde_json::from_str(include_str!("../resources/default-config.json")).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![app_info, default_config])
        .run(tauri::generate_context!())
        .expect("アプリの起動に失敗しました");
}
