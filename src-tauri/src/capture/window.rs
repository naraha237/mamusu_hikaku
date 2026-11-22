//! ゲームのウィンドウを探す。
//! OS のウィンドウ一覧(EnumWindows)から、ウィンドウの「タイトル」と「クラス名」だけを見て判定する。
//! プロセスのハンドルは開かない。ウィンドウの位置・大きさ・前面化などは一切操作しない(読むだけ)。

use serde::{Deserialize, Serialize};
use windows::Win32::Foundation::{HWND, LPARAM};
use windows::Win32::UI::WindowsAndMessaging::{EnumWindows, GetClassNameW, GetWindowTextW, IsIconic, IsWindow, IsWindowVisible};
use windows::core::BOOL;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    /// タイトルに含まれる文字(大文字・小文字は区別しない)
    pub title: String,
    /// クラス名(空なら見ない)
    #[serde(default)]
    pub class_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowInfo {
    /// ウィンドウの番号(HWND)。取り込みを始めるときに使う
    pub hwnd: i64,
    pub title: String,
    pub class_name: String,
}

fn text_of(hwnd: HWND, class: bool) -> String {
    let mut buf = [0u16; 512];
    let n = unsafe {
        if class {
            GetClassNameW(hwnd, &mut buf)
        } else {
            GetWindowTextW(hwnd, &mut buf)
        }
    };
    String::from_utf16_lossy(&buf[..n.max(0) as usize])
}

/// 表示中のトップレベルウィンドウのうち、条件に合うものを返す
pub fn find(candidates: &[Candidate]) -> Vec<WindowInfo> {
    unsafe extern "system" fn collect(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let list = unsafe { &mut *(lparam.0 as *mut Vec<HWND>) };
        if unsafe { IsWindowVisible(hwnd) }.as_bool() {
            list.push(hwnd);
        }
        BOOL(1)
    }
    let mut all: Vec<HWND> = Vec::new();
    unsafe {
        let _ = EnumWindows(Some(collect), LPARAM(&mut all as *mut _ as isize));
    }
    all.into_iter()
        .filter_map(|hwnd| {
            let title = text_of(hwnd, false);
            if title.is_empty() {
                return None;
            }
            let class_name = text_of(hwnd, true);
            let lower = title.to_lowercase();
            let hit = candidates.iter().any(|c| {
                !c.title.is_empty()
                    && lower.contains(&c.title.to_lowercase())
                    && (c.class_name.is_empty() || c.class_name == class_name)
            });
            hit.then(|| WindowInfo { hwnd: hwnd.0 as i64, title, class_name })
        })
        .collect()
}

pub fn hwnd_of(id: i64) -> HWND {
    HWND(id as isize as *mut core::ffi::c_void)
}

/// ウィンドウがまだあるか(閉じられていないか)
pub fn exists(hwnd: HWND) -> bool {
    unsafe { IsWindow(Some(hwnd)) }.as_bool()
}

/// ウィンドウが最小化されているか
pub fn minimized(hwnd: HWND) -> bool {
    unsafe { IsIconic(hwnd) }.as_bool()
}
