//! ライブキャプチャ(ゲームの画面の取り込み)。
//!
//! このフォルダの中だけで、ゲームのウィンドウを探し、映像を受け取る。
//! ゲームへの入力の送出、プロセスへのアクセス、ウィンドウの操作・描画は一切しない。
//! 使っている Windows API の一覧は docs/capture.md にある。

mod wgc;
pub mod window;

use std::sync::mpsc::{sync_channel, Receiver, RecvTimeoutError, SyncSender};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use base64::Engine;
use image::{imageops, DynamicImage, RgbaImage};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use windows::Graphics::Capture::{GraphicsCaptureItem, GraphicsCapturePicker};
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::Shell::IInitializeWithWindow;
use windows::core::Interface;

use crate::screenshot::{self, Analysis};

/// 取り込み中の状態(アプリ全体で1つだけ)
#[derive(Default)]
pub struct CaptureState {
    running: Mutex<Option<Running>>,
    /// 「自分で選ぶ」で選んだもの(次の開始で使う)
    picked: Mutex<Option<GraphicsCaptureItem>>,
}

struct Running {
    _capture: wgc::Capture,
    stop_tx: SyncSender<()>,
}

/// 画面(フロントエンド)に送る知らせ
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum CaptureEvent {
    /// 1枚読み取った(前の画像と違っていたものだけ)
    Frame {
        index: u32,
        analysis: Box<Analysis>,
        /// 確認画面で見せるための縮小画像(JPEG を base64 にしたもの)
        thumb_jpeg: String,
    },
    /// ゲームが最小化された(取り込みを一時停止中)
    Paused,
    /// 最小化から戻った
    Resumed,
    /// 止まった。reason = "user"(停止ボタン)/ "idle"(画面が変化しなかった)/ "closed"(ゲームが閉じられた)/ "error"
    Stopped { reason: String, message: Option<String> },
}

const EVENT: &str = "capture-event";

/// 縮小した白黒の画像(前の画像とほぼ同じかを比べるために使う)
fn signature(img: &RgbaImage) -> Vec<u8> {
    let small = imageops::resize(img, 64, 36, imageops::FilterType::Triangle);
    small.pixels().map(|p| ((p[0] as u32 * 3 + p[1] as u32 * 6 + p[2] as u32) / 10) as u8).collect()
}

fn difference(a: &[u8], b: &[u8]) -> f32 {
    if a.len() != b.len() {
        return f32::MAX;
    }
    a.iter().zip(b).map(|(x, y)| (*x as i32 - *y as i32).unsigned_abs()).sum::<u32>() as f32 / a.len() as f32
}

fn to_jpeg_base64(img: &RgbaImage, width: u32) -> String {
    let h = (img.height() as f32 * width as f32 / img.width().max(1) as f32) as u32;
    let small = imageops::resize(img, width, h.max(1), imageops::FilterType::Triangle);
    let mut buf = Vec::new();
    let _ = DynamicImage::ImageRgba8(small).to_rgb8().write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Jpeg);
    base64::engine::general_purpose::STANDARD.encode(buf)
}

fn to_png_base64(img: &RgbaImage, width: u32) -> String {
    let h = (img.height() as f32 * width as f32 / img.width().max(1) as f32) as u32;
    let small = imageops::resize(img, width, h.max(1), imageops::FilterType::Triangle);
    let mut buf = Vec::new();
    let _ = DynamicImage::ImageRgba8(small).write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Png);
    base64::engine::general_purpose::STANDARD.encode(buf)
}

/// 受け取った映像を、間引き・重複の除去をしてから読み取る(別のスレッドで動く)
fn worker(app: AppHandle, hwnd: Option<HWND>, frames: Receiver<RgbaImage>, stop: Receiver<()>, auto_stop: Duration) {
    let mut last_sig: Option<Vec<u8>> = None;
    let mut last_change = Instant::now();
    let mut paused = false;
    let mut index = 0u32;
    let emit = |e: CaptureEvent| {
        let _ = app.emit(EVENT, e);
    };
    let finish = |reason: &str, message: Option<String>| {
        if let Some(state) = app.try_state::<CaptureState>() {
            state.running.lock().unwrap().take();
        }
        let _ = app.emit(EVENT, CaptureEvent::Stopped { reason: reason.to_string(), message });
    };

    loop {
        if stop.try_recv().is_ok() {
            finish("user", None);
            return;
        }
        // ゲームのウィンドウの様子(閉じた・最小化)を見る。読むだけで操作はしない
        if let Some(h) = hwnd {
            if !window::exists(h) {
                finish("closed", None);
                return;
            }
            let mini = window::minimized(h);
            if mini != paused {
                paused = mini;
                emit(if mini { CaptureEvent::Paused } else { CaptureEvent::Resumed });
                last_change = Instant::now();
            }
        }
        if !paused && last_change.elapsed() >= auto_stop {
            finish("idle", None);
            return;
        }

        let img = match frames.recv_timeout(Duration::from_millis(400)) {
            Ok(img) => img,
            Err(RecvTimeoutError::Timeout) => continue,
            Err(RecvTimeoutError::Disconnected) => {
                finish("closed", None);
                return;
            }
        };
        if paused {
            continue;
        }
        // スキル欄のあたりだけを比べる(ウィンドウ全体だと、スクロールしても変化が小さすぎて「変わっていない」と見なしてしまう)
        let sig = screenshot::skill_area_signature(&img).unwrap_or_else(|| signature(&img));
        // 前の画像とほぼ同じなら捨てる
        if let Some(prev) = &last_sig {
            // 見本の画像で測ると、同じ画面 = 0、1段スクロール = 6 以上。ボタンのきらめきなどの小さな動きは無視する
            if difference(prev, &sig) < 2.5 {
                continue;
            }
        }
        last_sig = Some(sig);
        last_change = Instant::now();
        match screenshot::analyze(&img) {
            Ok(analysis) => {
                // 詳細画面が見つからない画像(別の画面を開いているとき)は知らせない
                if analysis.panel.is_none() {
                    continue;
                }
                index += 1;
                emit(CaptureEvent::Frame { index, analysis: Box::new(analysis), thumb_jpeg: to_jpeg_base64(&img, 960) });
            }
            Err(e) => {
                finish("error", Some(e));
                return;
            }
        }
    }
}

/// ゲームのウィンドウを探す(タイトルとクラス名だけで判定)
#[tauri::command]
pub fn capture_find_windows(candidates: Vec<window::Candidate>) -> Vec<window::WindowInfo> {
    window::find(&candidates)
}

/// そのウィンドウの画面を1枚だけ受け取る
pub fn grab_once(hwnd: i64) -> Result<RgbaImage, String> {
    let h = window::hwnd_of(hwnd);
    if !window::exists(h) {
        return Err("ウィンドウが見つかりませんでした".to_string());
    }
    let item = wgc::item_for_window(h).map_err(|e| e.message().to_string())?;
    let (tx, rx) = sync_channel::<RgbaImage>(1);
    let capture = wgc::Capture::start(&item, move |img| {
        let _ = tx.try_send(img);
    })
    .map_err(|e| e.message().to_string())?;
    let img = rx
        .recv_timeout(Duration::from_secs(3))
        .map_err(|_| "ウィンドウの画面を受け取れませんでした。最小化されていないか確かめてください".to_string());
    drop(capture);
    img
}

/// 確認用に、そのウィンドウの縮小画像を1枚だけ取る(PNG を base64 にしたもの)
#[tauri::command]
pub async fn capture_thumbnail(hwnd: i64) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || grab_once(hwnd).map(|img| to_png_base64(&img, 480)))
        .await
        .map_err(|e| e.to_string())?
}

/// Windows 標準のウィンドウ選択画面を出す。選んだものは次の capture_start で使う
#[tauri::command]
pub async fn capture_pick(app: AppHandle, state: tauri::State<'_, CaptureState>) -> Result<Option<String>, String> {
    let main = app.get_webview_window("main").ok_or("画面が見つかりません")?;
    let owner = main.hwnd().map_err(|e| e.to_string())?;
    let owner = owner.0 as isize;
    let item = tauri::async_runtime::spawn_blocking(move || -> Result<Option<GraphicsCaptureItem>, String> {
        let picker = GraphicsCapturePicker::new().map_err(|e| e.message().to_string())?;
        let init: IInitializeWithWindow = picker.cast().map_err(|e| e.message().to_string())?;
        unsafe { init.Initialize(HWND(owner as *mut core::ffi::c_void)) }.map_err(|e| e.message().to_string())?;
        let picked = picker.PickSingleItemAsync().map_err(|e| e.message().to_string())?.join();
        Ok(picked.ok())
    })
    .await
    .map_err(|e| e.to_string())??;
    let name = item.as_ref().and_then(|i| i.DisplayName().ok()).map(|s| s.to_string());
    *state.picked.lock().unwrap() = item;
    Ok(name)
}

/// 取り込みを始める。hwnd がなければ「自分で選ぶ」で選んだものを使う
#[tauri::command]
pub fn capture_start(
    app: AppHandle,
    state: tauri::State<'_, CaptureState>,
    hwnd: Option<i64>,
    fps: f32,
    auto_stop_secs: u32,
) -> Result<(), String> {
    let mut running = state.running.lock().unwrap();
    if running.is_some() {
        return Err("もう取り込み中です".to_string());
    }
    let (item, h) = match hwnd {
        Some(id) => {
            let h = window::hwnd_of(id);
            (wgc::item_for_window(h).map_err(|e| e.message().to_string())?, Some(h))
        }
        None => (
            state.picked.lock().unwrap().clone().ok_or("取り込むウィンドウが選ばれていません")?,
            None,
        ),
    };

    // 映像は秒間 fps 枚に間引いてから、読み取りのスレッドに渡す(読み取りが追いつかないときは捨てる)
    let (frame_tx, frame_rx) = sync_channel::<RgbaImage>(1);
    let interval = Duration::from_secs_f32(1.0 / fps.clamp(0.5, 4.0));
    let last = Mutex::new(Instant::now() - interval);
    let capture = wgc::Capture::start(&item, move |img| {
        let mut l = last.lock().unwrap();
        if l.elapsed() < interval {
            return;
        }
        *l = Instant::now();
        let _ = frame_tx.try_send(img);
    })
    .map_err(|e| e.message().to_string())?;

    let (stop_tx, stop_rx) = sync_channel::<()>(1);
    let auto_stop = Duration::from_secs(auto_stop_secs.clamp(2, 60) as u64);
    let app2 = app.clone();
    let hwnd_raw = h.map(|h| h.0 as isize);
    std::thread::spawn(move || {
        let h = hwnd_raw.map(|r| HWND(r as *mut core::ffi::c_void));
        worker(app2, h, frame_rx, stop_rx, auto_stop)
    });
    *running = Some(Running { _capture: capture, stop_tx });
    Ok(())
}

/// 取り込みを止める
#[tauri::command]
pub fn capture_stop(state: tauri::State<'_, CaptureState>) {
    if let Some(r) = state.running.lock().unwrap().as_ref() {
        let _ = r.stop_tx.try_send(());
    }
}
