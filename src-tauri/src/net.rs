//! スキル一覧の取得に使う HTTP 通信。
//! 取得先は決まったホストだけに限り、アプリ名と連絡先を User-Agent で名乗る。

use serde::Serialize;

const USER_AGENT: &str = concat!(
    "mamusu_hikaku/",
    env!("CARGO_PKG_VERSION"),
    " (+https://github.com/naraha237/mamusu_hikaku)"
);

/// 取得してよいホスト(スキル一覧の配信元、Umamusume Wiki、GameTora だけ)
const ALLOWED_HOSTS: &[&str] = &["raw.githubusercontent.com", "umamusu.wiki", "gametora.com"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResult {
    status: u16,
    body: String,
    etag: Option<String>,
    last_modified: Option<String>,
}

#[tauri::command]
pub async fn http_get(
    url: String,
    if_none_match: Option<String>,
    if_modified_since: Option<String>,
) -> Result<HttpResult, String> {
    let parsed = reqwest::Url::parse(&url).map_err(|e| e.to_string())?;
    let host = parsed.host_str().unwrap_or_default();
    if parsed.scheme() != "https" || !ALLOWED_HOSTS.contains(&host) {
        return Err(format!("このアドレスには接続できません: {host}"));
    }

    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    let mut req = client.get(parsed);
    if let Some(v) = if_none_match {
        req = req.header(reqwest::header::IF_NONE_MATCH, v);
    }
    if let Some(v) = if_modified_since {
        req = req.header(reqwest::header::IF_MODIFIED_SINCE, v);
    }

    let res = req.send().await.map_err(|e| e.to_string())?;
    let header = |name: reqwest::header::HeaderName| {
        res.headers()
            .get(name)
            .and_then(|v| v.to_str().ok())
            .map(str::to_string)
    };
    let etag = header(reqwest::header::ETAG);
    let last_modified = header(reqwest::header::LAST_MODIFIED);
    let status = res.status().as_u16();
    let body = res.text().await.map_err(|e| e.to_string())?;
    Ok(HttpResult { status, body, etag, last_modified })
}
