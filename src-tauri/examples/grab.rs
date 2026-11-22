//! 開発用:ゲームのウィンドウを探して画面を1枚受け取り、PNG に保存して読み取る。
//!   cargo run --release --example grab -- 保存先.png
//! ウィンドウを探すのはタイトルとクラス名だけ。画面を受け取るだけで、ゲームには触れない。
use mamusu_hikaku_lib::capture::{grab_once, window};

fn main() {
    let out = std::env::args().nth(1).unwrap_or_else(|| "grab.png".to_string());
    let candidates: Vec<window::Candidate> = serde_json::from_str(
        r#"[{"title":"UmamusumePrettyDerby_Jpn","className":"UnityWndClass"},{"title":"umamusume","className":"UnityWndClass"}]"#,
    )
    .unwrap();
    let found = window::find(&candidates);
    println!("見つかったウィンドウ: {found:?}");
    let Some(w) = found.first() else { return };
    let started = std::time::Instant::now();
    match grab_once(w.hwnd) {
        Ok(img) => {
            println!("受け取った画像: {}x{} ({:?})", img.width(), img.height(), started.elapsed());
            img.save(&out).unwrap();
            let a = mamusu_hikaku_lib::screenshot::analyze(&img).unwrap();
            println!("パネル: {:?} / 名前の行: {:?} / スキル {}行", a.panel, a.header_lines, a.skills.len());
        }
        Err(e) => println!("失敗: {e}"),
    }
}
