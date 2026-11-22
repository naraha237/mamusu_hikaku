//! 開発用:スクリーンショットを読み取って、結果を JSON で表示する。
//!   cargo run --release --example analyze -- ..\samples\fullsc1.jpg
fn main() {
    let path = std::env::args().nth(1).expect("画像のパスを指定してください");
    let bytes = std::fs::read(&path).expect("画像を読めませんでした");
    let started = std::time::Instant::now();
    let mut result = mamusu_hikaku_lib::screenshot::analyze_bytes(&bytes).expect("読み取りに失敗しました");
    // 顔の画像は長いので、表示では省く(MAMUSU_KEEP_PORTRAIT=1 なら残す)
    let keep = std::env::var("MAMUSU_KEEP_PORTRAIT").map(|v| v == "1").unwrap_or(false);
    let has_portrait = if keep { result.portrait_png.is_some() } else { result.portrait_png.take().is_some() };
    println!("{}", serde_json::to_string_pretty(&result).unwrap());
    eprintln!("顔の画像: {} / かかった時間: {:?}", if has_portrait { "あり" } else { "なし" }, started.elapsed());
}
