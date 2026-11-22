import { invoke } from "@tauri-apps/api/core";
import type { Analysis } from "./types";

/** 画像(PNG/JPEG のバイト列)を読み取る。重い処理は Rust 側で1枚ずつ行う */
export const analyzeImage = (bytes: Uint8Array) => invoke<Analysis>("analyze_screenshot", bytes);

/** ユーザーが選んだ・ドロップした画像ファイルを読む */
export async function readImageFile(path: string): Promise<Uint8Array> {
  const buf = await invoke<ArrayBuffer>("read_image_file", { path });
  return new Uint8Array(buf);
}

export const listImagesInFolder = (path: string) => invoke<string[]>("list_images_in_folder", { path });
