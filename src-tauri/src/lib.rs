#[cfg(windows)]
pub mod capture;
mod datafiles;
mod files;
mod net;
pub mod ocr;
pub mod screenshot;
mod share;

use std::sync::Mutex;

use serde::Serialize;
use tauri::{Emitter, Manager};

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

/// 起動するときに渡された .umacmp(ダブルクリックで開いたとき)
#[derive(Default)]
struct PendingOpen(Mutex<Option<String>>);

fn umacmp_arg(args: &[String]) -> Option<String> {
    args.iter().skip(1).find(|a| a.to_lowercase().ends_with(".umacmp")).cloned()
}

/// 起動のときに渡された .umacmp を1回だけ受け取る
#[tauri::command]
fn take_open_file(state: tauri::State<'_, PendingOpen>) -> Option<String> {
    state.0.lock().unwrap().take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // アプリがもう開いているときに .umacmp をダブルクリックしたら、開いている窓で読み込む
        // (2つ目のアプリは起動しない)
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(path) = umacmp_arg(&argv) {
                let _ = app.emit("open-file", path);
            }
            // このアプリ自身の窓を手前に出す(ゲームの窓は操作しない)
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .manage(PendingOpen(Mutex::new(umacmp_arg(&std::env::args().collect::<Vec<_>>()))))
        .setup(|app| {
            share::install_panic_hook(app.handle().clone());
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(capture::CaptureState::default())
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
            files::skill_icon,
            capture::capture_find_windows,
            capture::capture_thumbnail,
            capture::capture_pick,
            capture::capture_start,
            capture::capture_stop,
            take_open_file,
            share::write_umacmp,
            share::read_umacmp,
            share::list_backups,
            share::write_backup,
            share::data_folder,
            share::write_log,
            share::export_logs
        ])
        .run(tauri::generate_context!())
        .expect("アプリの起動に失敗しました");
}
