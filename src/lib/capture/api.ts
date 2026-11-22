// ライブキャプチャ(Rust の src-tauri/src/capture/)を呼ぶための関数
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Analysis } from "../ocr/types";

export type WindowCandidate = { title: string; className: string; label?: string };
export type GameWindow = { hwnd: number; title: string; className: string };

export type CaptureEvent =
  | { kind: "frame"; index: number; analysis: Analysis; thumbJpeg: string }
  | { kind: "paused" }
  | { kind: "resumed" }
  | { kind: "stopped"; reason: "user" | "idle" | "closed" | "error"; message?: string };

export const findGameWindows = (candidates: WindowCandidate[]) =>
  invoke<GameWindow[]>("capture_find_windows", { candidates: candidates.map((c) => ({ title: c.title, className: c.className })) });

/** 確認用の縮小画像(PNG の base64) */
export const captureThumbnail = (hwnd: number) => invoke<string>("capture_thumbnail", { hwnd });

/** Windows 標準のウィンドウ選択画面。選んだウィンドウの名前(やめたら null) */
export const pickWindow = () => invoke<string | null>("capture_pick");

export const startCapture = (hwnd: number | null, fps: number, autoStopSecs: number) =>
  invoke<void>("capture_start", { hwnd, fps, autoStopSecs });

export const stopCapture = () => invoke<void>("capture_stop");

export const onCaptureEvent = (handler: (e: CaptureEvent) => void): Promise<UnlistenFn> =>
  listen<CaptureEvent>("capture-event", (e) => handler(e.payload));

/** 案内用の窓に送る内容 */
export type GuideState = {
  status: "running" | "paused" | "stopped";
  found: number;
  tooFast: boolean;
  message?: string;
};
export const GUIDE_EVENT = "guide-update";
