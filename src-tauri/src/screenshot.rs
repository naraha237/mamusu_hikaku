//! 殿堂入りウマ娘の詳細画面のスクリーンショットを調べる。
//! - パネルの位置を緑の見出し帯(「ウマ娘詳細」)から見つける
//! - 名前・評価点・ステータス・スキル欄を切り出して文字を読む
//! - 適性(S〜G)は文字の色で見分ける。スキル名の最後の ◎/○/× は、その部分を大きくして読み直す
//! - キャラの顔を切り抜く
//!
//! 位置はすべて「見出し帯の左上を原点、見出し帯の幅を 1」とした比率で持つ。
//! ウィンドウの大きさが変わっても同じ比率で使える。
//! 渡された画像を調べるだけで、ゲームやほかのアプリには一切触れない。

use std::sync::Mutex;

use base64::Engine;
use image::{imageops, DynamicImage, Rgba, RgbaImage};
use serde::Serialize;

use crate::ocr::{self, OcrLine};

/// 文字を読むときの拡大後のパネルの幅(px)。小さい画面ほど大きく拡大する
const TARGET_PANEL_WIDTH: f32 = 1150.0;

/// 同時に1枚ずつ処理して、PC が重くならないようにする
static WORK_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone, Copy, Serialize)]
pub struct Panel {
    pub x: u32,
    pub y: u32,
    /// 見出し帯の幅(px)
    pub w: u32,
}

impl Panel {
    /// 比率の矩形を画像の px に直す(画像からはみ出さないようにする)
    fn rect(&self, img: &RgbaImage, x0: f32, y0: f32, x1: f32, y1: f32) -> Option<(u32, u32, u32, u32)> {
        let w = self.w as f32;
        let px0 = (self.x as f32 + x0 * w).max(0.0) as u32;
        let py0 = (self.y as f32 + y0 * w).max(0.0) as u32;
        let px1 = ((self.x as f32 + x1 * w) as u32).min(img.width());
        let py1 = ((self.y as f32 + y1 * w) as u32).min(img.height());
        (px1 > px0 + 2 && py1 > py0 + 2).then_some((px0, py0, px1 - px0, py1 - py0))
    }
}

fn is_title_green(p: &Rgba<u8>) -> bool {
    let [r, g, b, _] = p.0;
    g > 150 && r > 90 && r < 190 && b < 90 && g as i32 - b as i32 > 100
}

/// 緑の見出し帯を探す(画面の上 25%・左 70% の中で、横に長く続く緑)
pub fn find_panel(img: &RgbaImage) -> Option<Panel> {
    let (w, h) = img.dimensions();
    let min_run = (w as f32 * 0.2) as u32;
    for y in 0..(h as f32 * 0.25) as u32 {
        let (mut run, mut start) = (0u32, 0u32);
        for x in 0..(w as f32 * 0.7) as u32 {
            if is_title_green(img.get_pixel(x, y)) {
                if run == 0 {
                    start = x;
                }
                run += 1;
            } else {
                if run >= min_run {
                    break;
                }
                run = 0;
            }
        }
        if run >= min_run {
            return Some(Panel { x: start, y, w: run });
        }
    }
    None
}

/// 切り出して拡大する
fn crop_scaled(img: &RgbaImage, r: (u32, u32, u32, u32), scale: f32) -> RgbaImage {
    let sub = imageops::crop_imm(img, r.0, r.1, r.2, r.3).to_image();
    if scale <= 1.05 {
        return sub;
    }
    imageops::resize(
        &sub,
        (r.2 as f32 * scale) as u32,
        (r.3 as f32 * scale) as u32,
        imageops::FilterType::CatmullRom,
    )
}

/// まわりに白い余白を付ける(小さな切り抜きは、余白がないと読み取りに失敗しやすい)
fn pad_white(img: &RgbaImage, margin: u32) -> RgbaImage {
    let mut out = RgbaImage::from_pixel(img.width() + margin * 2, img.height() + margin * 2, Rgba([255, 255, 255, 255]));
    imageops::overlay(&mut out, img, margin as i64, margin as i64);
    out
}

/// 開発用:環境変数 MAMUSU_DEBUG_DIR が指定されていたら、切り出した画像を保存する
fn debug_save(name: &str, img: &RgbaImage) {
    if let Ok(dir) = std::env::var("MAMUSU_DEBUG_DIR") {
        let _ = img.save(std::path::Path::new(&dir).join(format!("{name}.png")));
    }
}

fn ocr_text(img: &RgbaImage, panel: &Panel, name: &str, r: (f32, f32, f32, f32), scale: f32) -> Result<Vec<OcrLine>, String> {
    match panel.rect(img, r.0, r.1, r.2, r.3) {
        Some(rect) => {
            let crop = crop_scaled(img, rect, scale);
            debug_save(name, &crop);
            ocr::recognize(&crop)
        }
        None => Ok(vec![]),
    }
}

/// 数字だけの小さな切り抜きを読む(さらに拡大して余白を付ける)
fn ocr_number(img: &RgbaImage, panel: &Panel, name: &str, r: (f32, f32, f32, f32), scale: f32) -> Result<String, String> {
    let Some(rect) = panel.rect(img, r.0, r.1, r.2, r.3) else { return Ok(String::new()) };
    let crop = crop_scaled(img, rect, scale * 1.6);
    let crop = pad_white(&crop, crop.height() / 2);
    debug_save(name, &crop);
    Ok(ocr::recognize(&crop)?.into_iter().map(|l| l.text).collect::<Vec<_>>().join(""))
}

// ---------- 適性(S〜G) ----------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GradeGuess {
    /// "surface.turf" など
    pub key: &'static str,
    pub grade: char,
    /// 見分けにくかったとき false(E は見本がないので常に false)
    pub sure: bool,
}

const APTITUDE_ROWS: [f32; 3] = [0.557, 0.615, 0.673];
const APTITUDE_COLS: [f32; 4] = [0.349, 0.540, 0.730, 0.923];
const APTITUDE_CELLS: [(&str, usize, usize); 10] = [
    ("surface.turf", 0, 0),
    ("surface.dirt", 0, 1),
    ("distance.sprint", 1, 0),
    ("distance.mile", 1, 1),
    ("distance.medium", 1, 2),
    ("distance.long", 1, 3),
    ("style.front", 2, 0),
    ("style.pace", 2, 1),
    ("style.late", 2, 2),
    ("style.end", 2, 3),
];

fn hue_of(r: f32, g: f32, b: f32) -> f32 {
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let d = max - min;
    if d == 0.0 {
        return 0.0;
    }
    let h = if max == r {
        ((g - b) / d).rem_euclid(6.0)
    } else if max == g {
        (b - r) / d + 2.0
    } else {
        (r - g) / d + 4.0
    };
    h * 60.0
}

/// 文字の色で見分ける(S=金 43°、A=橙 25°、B=桃 340°、C=緑 104°、D=青 202°、E=紫、F=薄紫 248°、G=灰)
fn classify_grade(img: &RgbaImage, cx: u32, cy: u32, half: u32) -> (char, bool) {
    let (mut n, mut sat, mut sx, mut sy) = (0u32, 0u32, 0f32, 0f32);
    for y in cy.saturating_sub(half)..=(cy + half).min(img.height() - 1) {
        for x in cx.saturating_sub(half)..=(cx + half).min(img.width() - 1) {
            let [r, g, b, _] = img.get_pixel(x, y).0;
            n += 1;
            let mx = r.max(g).max(b) as i32;
            let mn = r.min(g).min(b) as i32;
            if mx - mn > 60 {
                sat += 1;
                let h = hue_of(r as f32, g as f32, b as f32).to_radians();
                sx += h.cos();
                sy += h.sin();
            }
        }
    }
    let ratio = sat as f32 / n.max(1) as f32;
    if ratio < 0.02 {
        return ('G', true);
    }
    let hue = sy.atan2(sx).to_degrees().rem_euclid(360.0);
    let dist = |c: f32| {
        let d = (hue - c).abs();
        d.min(360.0 - d)
    };
    if dist(43.0) <= 9.0 {
        ('S', true)
    } else if dist(25.0) <= 8.0 {
        ('A', true)
    } else if dist(340.0) <= 15.0 {
        ('B', true)
    } else if dist(104.0) <= 20.0 {
        ('C', true)
    } else if dist(202.0) <= 18.0 {
        ('D', true)
    } else if dist(248.0) <= 15.0 {
        ('F', ratio < 0.2)
    } else if (265.0..325.0).contains(&hue) {
        ('E', false)
    } else {
        // どれにも近くないときは、一番近いものを「要確認」で返す
        let table = [('S', 43.0), ('A', 25.0), ('B', 340.0), ('C', 104.0), ('D', 202.0), ('E', 290.0), ('F', 248.0)];
        let best = table.iter().min_by(|a, b| dist(a.1).partial_cmp(&dist(b.1)).unwrap()).unwrap();
        (best.0, false)
    }
}

// ---------- スキル名の最後の記号(◎ ○ ×) ----------
// 小さい画面では見分けられないことがあるので、アプリ側で「要確認」にして選んでもらう

/// 名前の最後の部分だけを大きくして読み直し、記号を見分ける。
/// "double"(◎)/"single"(○)/"cross"(×)/"none"(記号なし)/"other"(わからない)
fn read_end_symbol(img: &RgbaImage, line: &OcrLine) -> &'static str {
    let h = line.rect.h;
    let x0 = (line.rect.x + line.rect.w - h * 1.3).max(0.0) as u32;
    let x1 = ((line.rect.x + line.rect.w + h * 1.6) as u32).min(img.width());
    let y0 = (line.rect.y - h * 0.25).max(0.0) as u32;
    let y1 = ((line.rect.y + h * 1.25) as u32).min(img.height());
    if x1 <= x0 + 4 || y1 <= y0 + 4 {
        return "other";
    }
    let crop = imageops::crop_imm(img, x0, y0, x1 - x0, y1 - y0).to_image();
    // 文字の高さが 60px 前後になるように拡大する
    let s = (60.0 / h.max(1.0)).clamp(1.0, 4.0);
    let crop = imageops::resize(
        &crop,
        ((x1 - x0) as f32 * s) as u32,
        ((y1 - y0) as f32 * s) as u32,
        imageops::FilterType::CatmullRom,
    );
    let crop = pad_white(&crop, crop.height() / 2);
    let Ok(lines) = ocr::recognize(&crop) else { return "other" };
    let text: String = lines.iter().map(|l| l.text.as_str()).collect();
    match text.chars().last() {
        Some('◎') => "double",
        Some('○' | '〇' | 'O' | 'o' | '0') => "single",
        Some('×' | 'x' | 'X' | '✕') => "cross",
        Some(_) => "none",
        None => "other",
    }
}

// ---------- まとめ ----------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillLine {
    pub text: String,
    /// 0 = 左の列、1 = 右の列
    pub column: u8,
    /// パネル内での縦の位置(見出し帯の幅 = 1)。並べ替えに使う
    pub y: f32,
    /// スキル欄の上下の端で切れている
    pub partial: bool,
    /// 名前の最後の記号の読み直しの結果(当てにならないこともある)
    pub end_glyph: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Analysis {
    pub width: u32,
    pub height: u32,
    pub panel: Option<Panel>,
    /// 名前・二つ名のあたりの行(上から順)
    pub header_lines: Vec<String>,
    pub score_text: String,
    /// ステータス5種(スピード・スタミナ・パワー・根性・賢さ)ごとの、読み取った文字の候補
    pub stat_candidates: Vec<Vec<String>>,
    pub aptitudes: Vec<GradeGuess>,
    pub skills: Vec<SkillLine>,
    /// キャラの顔(PNG を base64 にしたもの)
    pub portrait_png: Option<String>,
}

fn portrait(img: &RgbaImage, panel: &Panel) -> Option<String> {
    let rect = panel.rect(img, 0.186 - 0.105, 0.210 - 0.105, 0.186 + 0.105, 0.210 + 0.105)?;
    let face = imageops::resize(
        &imageops::crop_imm(img, rect.0, rect.1, rect.2, rect.3).to_image(),
        128,
        128,
        imageops::FilterType::CatmullRom,
    );
    let mut png = Vec::new();
    DynamicImage::ImageRgba8(face)
        .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
        .ok()?;
    Some(base64::engine::general_purpose::STANDARD.encode(png))
}

/// 画像のバイト列(PNG/JPEG)を調べる
pub fn analyze_bytes(bytes: &[u8]) -> Result<Analysis, String> {
    let img = image::load_from_memory(bytes)
        .map_err(|_| "画像を開けませんでした。PNG か JPEG の画像を使ってください".to_string())?;
    analyze(&img.to_rgba8())
}

pub fn analyze(img: &RgbaImage) -> Result<Analysis, String> {
    let _guard = WORK_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let (width, height) = img.dimensions();
    let Some(panel) = find_panel(img) else {
        return Ok(Analysis {
            width,
            height,
            panel: None,
            header_lines: vec![],
            score_text: String::new(),
            stat_candidates: vec![],
            aptitudes: vec![],
            skills: vec![],
            portrait_png: None,
        });
    };
    let scale = (TARGET_PANEL_WIDTH / panel.w as f32).max(1.0);

    // 名前・二つ名
    let header_lines = ocr_text(img, &panel, "header", (0.40, 0.10, 0.93, 0.225), scale)?
        .into_iter()
        .map(|l| l.text)
        .collect();

    // 評価点
    let score_text = ocr_number(img, &panel, "score", (0.08, 0.33, 0.30, 0.385), scale)?;

    // ステータス。小さな数字は読み方によって失敗することがあるので、
    // 「セルごと」「セルごと(余白つき)」「行ぜんぶ」の3通りで読み、候補として返す
    let cell_x0 = |i: usize| 0.0137 + i as f32 * 0.1945;
    let mut stat_candidates: Vec<Vec<String>> = vec![Vec::new(); 5];
    for (i, cands) in stat_candidates.iter_mut().enumerate() {
        let x0 = cell_x0(i);
        let r = (x0 + 0.075, 0.44, x0 + 0.192, 0.507);
        let plain = ocr_text(img, &panel, &format!("stat{i}"), r, scale)?;
        cands.push(plain.into_iter().map(|l| l.text).collect::<Vec<_>>().join(""));
        cands.push(ocr_number(img, &panel, &format!("stat{i}p"), r, scale)?);
    }
    let row = ocr_text(img, &panel, "statrow", (0.0137, 0.44, 0.986, 0.507), scale)?;
    let mut row_texts = vec![String::new(); 5];
    for line in &row {
        for w in &line.words {
            let cx = (w.rect.x + w.rect.w / 2.0) / scale / panel.w as f32;
            let i = ((cx / 0.1945).floor().max(0.0) as usize).min(4);
            row_texts[i].push_str(&w.text);
        }
    }
    for (cands, t) in stat_candidates.iter_mut().zip(row_texts) {
        cands.push(t);
    }

    // 適性
    let half = (0.017 * panel.w as f32) as u32;
    let aptitudes = APTITUDE_CELLS
        .iter()
        .map(|(key, row, col)| {
            let cx = panel.x + (APTITUDE_COLS[*col] * panel.w as f32) as u32;
            let cy = panel.y + (APTITUDE_ROWS[*row] * panel.w as f32) as u32;
            let (grade, sure) = classify_grade(img, cx, cy, half);
            GradeGuess { key, grade, sure }
        })
        .collect();

    // スキル欄(左右の列を別々に読む)
    let mut skills: Vec<SkillLine> = Vec::new();
    let (sy0, sy1) = (0.787, 1.553);
    for (column, (x0, x1)) in [(0.02, 0.497), (0.505, 0.985)].into_iter().enumerate() {
        let Some(rect) = panel.rect(img, x0, sy0, x1, sy1) else { continue };
        let crop = crop_scaled(img, rect, scale);
        debug_save(&format!("skills{column}"), &crop);
        let lines = ocr::recognize(&crop)?;
        let edge = crop.height() as f32 * 0.03;
        for line in lines {
            let text = line.text.trim().to_string();
            if text.chars().count() < 2 {
                continue;
            }
            let partial = line.rect.y < edge || line.rect.y + line.rect.h > crop.height() as f32 - edge;
            let end_glyph = read_end_symbol(&crop, &line);
            let y = sy0 + (line.rect.y / scale) / panel.w as f32;
            skills.push(SkillLine { text, column: column as u8, y, partial, end_glyph });
        }
    }
    // ゲームの並び順(上の段から、同じ段なら左→右)にする。
    // 左右の列で読み取った高さが少しずれるので、近い高さを同じ段とみなす
    skills.sort_by(|a, b| a.y.partial_cmp(&b.y).unwrap());
    let mut row_start = f32::MIN;
    let mut row_no = 0;
    let mut indexed = Vec::with_capacity(skills.len());
    for s in skills {
        if s.y - row_start > 0.04 {
            row_no += 1;
            row_start = s.y;
        }
        indexed.push((row_no, s));
    }
    indexed.sort_by(|(ra, a), (rb, b)| ra.cmp(rb).then(a.column.cmp(&b.column)));
    let skills: Vec<SkillLine> = indexed.into_iter().map(|(_, s)| s).collect();

    Ok(Analysis {
        width,
        height,
        panel: Some(panel),
        header_lines,
        score_text,
        stat_candidates,
        aptitudes,
        skills,
        portrait_png: portrait(img, &panel),
    })
}

/// 画像のバイト列を受け取って調べる(重い処理なので別のスレッドで動かす)
#[tauri::command]
pub async fn analyze_screenshot(request: tauri::ipc::Request<'_>) -> Result<Analysis, String> {
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(b) => b.clone(),
        _ => return Err("画像のデータを受け取れませんでした".to_string()),
    };
    tauri::async_runtime::spawn_blocking(move || analyze_bytes(&bytes))
        .await
        .map_err(|e| e.to_string())?
}
