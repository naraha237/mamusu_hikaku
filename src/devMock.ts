// 開発用:ブラウザだけで画面を確かめるための、Tauri の代わり(npm run dev をブラウザで開いたときだけ使う)。
// 配布する exe には含まれない。
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import defaultConfig from "../src-tauri/resources/default-config.json";

const KEY = "devMock:";
const load = <T,>(name: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(KEY + name);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const store = (name: string, v: unknown) => localStorage.setItem(KEY + name, JSON.stringify(v));

type Row = Record<string, string>;

export function installDevMock() {
  mockWindows("main");
  mockIPC((cmd, args) => {
    const a = (args ?? {}) as Record<string, unknown>;
    switch (cmd) {
      case "app_info":
        return { version: "0.0.0-dev", installed: false };
      case "default_config":
        return { ...defaultConfig, skillMaster: { distributionUrl: "" } };
      case "read_data_file":
        return localStorage.getItem(KEY + "file:" + a.name);
      case "write_data_file":
        localStorage.setItem(KEY + "file:" + a.name, String(a.contents));
        return null;
      case "http_get":
        throw new Error("開発用のブラウザでは通信しません");
      case "plugin:sql|load":
        return a.db;
      case "plugin:sql|select": {
        const q = String(a.query);
        if (q.includes("FROM umas")) {
          const rows = load<Row[]>("umas", []);
          return [...rows].sort((x, y) => x.created_at.localeCompare(y.created_at)).map((r) => ({ data: r.data }));
        }
        if (q.includes("FROM compare_sets")) return load<Row[]>("sets", []);
        return [];
      }
      case "plugin:sql|execute": {
        const q = String(a.query);
        const v = (a.values ?? []) as string[];
        const table = q.includes("umas") ? "umas" : "sets";
        let rows = load<Row[]>(table, []);
        if (q.startsWith("DELETE")) rows = rows.filter((r) => r.id !== v[0]);
        else {
          const row: Row =
            table === "umas"
              ? { id: v[0], data: v[1], created_at: v[2], updated_at: v[3] }
              : { id: v[0], name: v[1], uma_ids: v[2], updated_at: v[3] };
          const old = rows.find((r) => r.id === row.id);
          rows = old ? rows.map((r) => (r.id === row.id ? { ...row, created_at: old.created_at ?? row.created_at } : r)) : [...rows, row];
        }
        store(table, rows);
        return [1, 0];
      }
      default:
        // updater など、開発用では使わないもの
        if (cmd.startsWith("plugin:updater")) return null;
        return null;
    }
  });
}
