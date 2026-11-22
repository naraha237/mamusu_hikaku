import React from "react";
import ReactDOM from "react-dom/client";
import { isTauri } from "@tauri-apps/api/core";
import App from "./App";
import { GuideWindow } from "./GuideWindow";
import "./App.css";

async function start() {
  // ブラウザで開発しているときだけ、Tauri の代わりを入れる
  if (import.meta.env.DEV && !isTauri()) {
    const { installDevMock } = await import("./devMock");
    installDevMock();
  }
  // 画面で起きたエラーを、データフォルダのログに残す(「ログを保存」で書き出せる)
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const log = (line: string) => invoke("write_log", { line }).catch(() => {});
    window.addEventListener("error", (e) => log(`画面のエラー: ${e.message} (${e.filename}:${e.lineno})`));
    window.addEventListener("unhandledrejection", (e) => log(`画面のエラー: ${String(e.reason)}`));
  }
  // 案内用の小さな窓は ?view=guide で開く
  const isGuide = new URLSearchParams(location.search).get("view") === "guide";
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>{isGuide ? <GuideWindow /> : <App />}</React.StrictMode>,
  );
}

start();
