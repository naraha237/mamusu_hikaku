mod datafiles;
mod files;
mod net;
pub mod ocr;
pub mod screenshot;

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

/// データの保存先(%APPDATA%\com.naraha237.mamusuhikaku\mamusu.db)の表の作り方
fn db_migrations() -> Vec<tauri_plugin_sql::Migration> {
    vec![tauri_plugin_sql::Migration {
        version: 1,
        description: "create_umas_and_sets",
        sql: "CREATE TABLE IF NOT EXISTS umas (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
              );
              CREATE TABLE IF NOT EXISTS compare_sets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                uma_ids TEXT NOT NULL,
                updated_at TEXT NOT NULL
              );",
        kind: tauri_plugin_sql::MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:mamusu.db", db_migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            app_info,
            default_config,
            net::http_get,
            datafiles::read_data_file,
            datafiles::write_data_file,
            screenshot::analyze_screenshot,
            files::read_image_file,
            files::list_images_in_folder,
            files::skill_icon
        ])
        .run(tauri::generate_context!())
        .expect("アプリの起動に失敗しました");
}
