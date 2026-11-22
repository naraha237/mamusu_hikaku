//! 共有・バックアップ用のファイル(.umacmp)と、エラーの記録。
//! .umacmp の中身は zip で、data.json(ウマ娘などのデータ)が入っている。

use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::Manager;

const DATA_ENTRY: &str = "data.json";
/// 自動バックアップを残す数
const KEEP_BACKUPS: usize = 5;
/// これより大きいファイルは読まない
const MAX_FILE_BYTES: u64 = 200 * 1024 * 1024;

fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn write_zip(path: &Path, json: &str) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    {
        let file = std::fs::File::create(&tmp).map_err(|_| "ファイルを作れませんでした。保存先を変えてみてください".to_string())?;
        let mut zip = zip::ZipWriter::new(file);
        let opts = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        zip.start_file(DATA_ENTRY, opts).map_err(|e| e.to_string())?;
        zip.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
        zip.finish().map_err(|e| e.to_string())?;
    }
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())
}

/// .umacmp を書き出す(保存先はユーザーが選んだ場所)
#[tauri::command]
pub fn write_umacmp(path: String, json: String) -> Result<(), String> {
    write_zip(Path::new(&path), &json)
}

/// .umacmp を読む(中の data.json を返す)
#[tauri::command]
pub fn read_umacmp(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    let ok_ext = p.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("umacmp")).unwrap_or(false);
    if !ok_ext {
        return Err("「.umacmp」のファイルを選んでください".to_string());
    }
    let meta = std::fs::metadata(p).map_err(|_| "ファイルが見つかりませんでした".to_string())?;
    if meta.len() > MAX_FILE_BYTES {
        return Err("ファイルが大きすぎます".to_string());
    }
    let file = std::fs::File::open(p).map_err(|_| "ファイルを開けませんでした".to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|_| "このアプリのファイルではないか、壊れています".to_string())?;
    let mut entry = zip.by_name(DATA_ENTRY).map_err(|_| "このアプリのファイルではないか、壊れています".to_string())?;
    let mut s = String::new();
    entry.read_to_string(&mut s).map_err(|_| "ファイルを読めませんでした".to_string())?;
    Ok(s)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    name: String,
    path: String,
    size: u64,
    /// 作った日時(UNIX 秒)
    modified: u64,
}

fn backups_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = data_dir(app)?.join("backups");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn list(dir: &Path) -> Vec<BackupInfo> {
    let mut items: Vec<BackupInfo> = std::fs::read_dir(dir)
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|x| x.to_str()) == Some("umacmp"))
        .filter_map(|e| {
            let meta = e.metadata().ok()?;
            let modified = meta.modified().ok()?.duration_since(std::time::UNIX_EPOCH).ok()?.as_secs();
            Some(BackupInfo {
                name: e.file_name().to_string_lossy().to_string(),
                path: e.path().to_string_lossy().to_string(),
                size: meta.len(),
                modified,
            })
        })
        .collect();
    items.sort_by(|a, b| b.modified.cmp(&a.modified));
    items
}

/// データフォルダの backups にある自動バックアップの一覧(新しい順)
#[tauri::command]
pub fn list_backups(app: tauri::AppHandle) -> Result<Vec<BackupInfo>, String> {
    Ok(list(&backups_dir(&app)?))
}

/// 自動バックアップを作り、古いものを消して直近5つを残す
#[tauri::command]
pub fn write_backup(app: tauri::AppHandle, json: String, stamp: String) -> Result<String, String> {
    let dir = backups_dir(&app)?;
    let safe: String = stamp.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-').collect();
    let path = dir.join(format!("backup-{safe}.umacmp"));
    write_zip(&path, &json)?;
    for old in list(&dir).into_iter().skip(KEEP_BACKUPS) {
        let _ = std::fs::remove_file(old.path);
    }
    Ok(path.to_string_lossy().to_string())
}

/// データフォルダの場所(「フォルダを開く」用)
#[tauri::command]
pub fn data_folder(app: tauri::AppHandle) -> Result<String, String> {
    Ok(data_dir(&app)?.to_string_lossy().to_string())
}

// ---------- エラーの記録 ----------

fn log_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_data_dir().ok()?.join("logs");
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

/// ログに1行足す(画面で起きたエラーなど)。1MB を超えたら古いものと入れ替える
pub fn append_log(app: &tauri::AppHandle, line: &str) {
    let Some(dir) = log_dir(app) else { return };
    let path = dir.join("app.log");
    if std::fs::metadata(&path).map(|m| m.len() > 1024 * 1024).unwrap_or(false) {
        let _ = std::fs::rename(&path, dir.join("app.old.log"));
    }
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
        let _ = writeln!(f, "[{now}] {line}");
    }
}

#[tauri::command]
pub fn write_log(app: tauri::AppHandle, line: String) {
    append_log(&app, &line);
}

/// ログをまとめて、ユーザーが選んだ場所に書き出す(「ログを保存」ボタン)
#[tauri::command]
pub fn export_logs(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let dir = log_dir(&app).ok_or("ログの場所がわかりません")?;
    let mut out = format!("ウマ娘 比較ノート {} のログ\n\n", app.package_info().version);
    for name in ["app.old.log", "app.log"] {
        if let Ok(s) = std::fs::read_to_string(dir.join(name)) {
            out.push_str(&format!("===== {name} =====\n{s}\n"));
        }
    }
    std::fs::write(path, out).map_err(|_| "保存できませんでした".to_string())
}

/// アプリが止まったときに、その内容をログに残す
pub fn install_panic_hook(app: tauri::AppHandle) {
    let prev = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        append_log(&app, &format!("アプリが止まりました: {info}"));
        prev(info);
    }));
}
