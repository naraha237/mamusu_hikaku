import { invoke } from "@tauri-apps/api/core";

/** データフォルダの中の JSON ファイルを読む。ないとき・壊れているときは null */
export async function readJson<T>(name: string): Promise<T | null> {
  try {
    const text = await invoke<string | null>("read_data_file", { name });
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

export async function writeJson(name: string, value: unknown): Promise<void> {
  await invoke("write_data_file", { name, contents: JSON.stringify(value) });
}
