//! 画像から文字を読み取る(Windows 標準の文字認識 Windows.Media.Ocr、日本語)。
//! 渡された画像を読むだけで、ほかのアプリやゲームには一切触れない。

use image::RgbaImage;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrWord {
    pub text: String,
    pub rect: Rect,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrLine {
    /// 日本語の文字の間の空白は詰めてある
    pub text: String,
    pub rect: Rect,
    pub words: Vec<OcrWord>,
}

/// 日本語どうしの間に入る空白を詰める(英単語の間の空白は残す)
pub fn join_words(words: &[&str]) -> String {
    let mut out = String::new();
    for w in words {
        if let (Some(prev), Some(next)) = (out.chars().last(), w.chars().next()) {
            if prev.is_ascii_alphanumeric() && next.is_ascii_alphanumeric() {
                out.push(' ');
            }
        }
        out.push_str(w);
    }
    out
}

#[cfg(windows)]
pub fn recognize(img: &RgbaImage) -> Result<Vec<OcrLine>, String> {
    use windows::Globalization::Language;
    use windows::Graphics::Imaging::{BitmapPixelFormat, SoftwareBitmap};
    use windows::Media::Ocr::OcrEngine;
    use windows::Security::Cryptography::CryptographicBuffer;
    use windows::core::HSTRING;

    let e = |err: windows::core::Error| err.message().to_string();

    // RGBA → BGRA に並べ替えて、Windows の画像の形にする
    let mut bgra = img.as_raw().clone();
    for px in bgra.chunks_exact_mut(4) {
        px.swap(0, 2);
    }
    let buffer = CryptographicBuffer::CreateFromByteArray(&bgra).map_err(e)?;
    let bitmap = SoftwareBitmap::CreateCopyFromBuffer(&buffer, BitmapPixelFormat::Bgra8, img.width() as i32, img.height() as i32)
        .map_err(e)?;

    let lang = Language::CreateLanguage(&HSTRING::from("ja")).map_err(e)?;
    let engine = OcrEngine::TryCreateFromLanguage(&lang)
        .map_err(|_| "日本語の文字を読み取る機能が、この PC に入っていません".to_string())?;
    let result = engine.RecognizeAsync(&bitmap).map_err(e)?.join().map_err(e)?;

    let mut lines = Vec::new();
    for line in result.Lines().map_err(e)? {
        let mut words = Vec::new();
        for w in line.Words().map_err(e)? {
            let r = w.BoundingRect().map_err(e)?;
            words.push(OcrWord {
                text: w.Text().map_err(e)?.to_string(),
                rect: Rect { x: r.X, y: r.Y, w: r.Width, h: r.Height },
            });
        }
        if words.is_empty() {
            continue;
        }
        let x0 = words.iter().map(|w| w.rect.x).fold(f32::MAX, f32::min);
        let y0 = words.iter().map(|w| w.rect.y).fold(f32::MAX, f32::min);
        let x1 = words.iter().map(|w| w.rect.x + w.rect.w).fold(0.0, f32::max);
        let y1 = words.iter().map(|w| w.rect.y + w.rect.h).fold(0.0, f32::max);
        let texts: Vec<&str> = words.iter().map(|w| w.text.as_str()).collect();
        lines.push(OcrLine {
            text: join_words(&texts),
            rect: Rect { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
            words,
        });
    }
    Ok(lines)
}

#[cfg(not(windows))]
pub fn recognize(_img: &RgbaImage) -> Result<Vec<OcrLine>, String> {
    Err("文字の読み取りは Windows でだけ使えます".to_string())
}
