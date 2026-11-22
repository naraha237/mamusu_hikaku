//! 開発用:2枚の画像のスキル欄の違いの大きさを表示する(ライブキャプチャの「変わったか」の目安を決めるため)
//!   cargo run --release --example sigdiff -- a.jpg b.jpg
fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let load = |p: &str| image::open(p).expect("画像を開けません").to_rgba8();
    let a = mamusu_hikaku_lib::screenshot::skill_area_signature(&load(&args[0])).expect("詳細画面がありません");
    let b = mamusu_hikaku_lib::screenshot::skill_area_signature(&load(&args[1])).expect("詳細画面がありません");
    let d: f32 = a.iter().zip(&b).map(|(x, y)| (*x as i32 - *y as i32).unsigned_abs() as f32).sum::<f32>() / a.len() as f32;
    println!("違いの大きさ: {d:.2}");
}
