// ウマ娘と比較セットの保存(SQLite。データフォルダの mamusu.db)
import Database from "@tauri-apps/plugin-sql";
import type { CompareSet, UmaEntry } from "./types";

let dbPromise: Promise<Database> | null = null;
const db = () => (dbPromise ??= Database.load("sqlite:mamusu.db"));

export async function listUmas(): Promise<UmaEntry[]> {
  const rows = await (await db()).select<{ data: string }[]>("SELECT data FROM umas ORDER BY created_at");
  return rows.map((r) => JSON.parse(r.data) as UmaEntry);
}

export async function saveUma(uma: UmaEntry): Promise<void> {
  await (await db()).execute(
    `INSERT INTO umas (id, data, created_at, updated_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    [uma.id, JSON.stringify(uma), uma.createdAt, uma.updatedAt],
  );
}

export async function deleteUma(id: string): Promise<void> {
  await (await db()).execute("DELETE FROM umas WHERE id = $1", [id]);
}

export async function listCompareSets(): Promise<CompareSet[]> {
  const rows = await (await db()).select<{ id: string; name: string; uma_ids: string; updated_at: string }[]>(
    "SELECT id, name, uma_ids, updated_at FROM compare_sets ORDER BY updated_at DESC",
  );
  return rows.map((r) => ({ id: r.id, name: r.name, umaIds: JSON.parse(r.uma_ids), updatedAt: r.updated_at }));
}

export async function saveCompareSet(set: CompareSet): Promise<void> {
  await (await db()).execute(
    `INSERT INTO compare_sets (id, name, uma_ids, updated_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, uma_ids = excluded.uma_ids, updated_at = excluded.updated_at`,
    [set.id, set.name, JSON.stringify(set.umaIds), set.updatedAt],
  );
}

export async function deleteCompareSet(id: string): Promise<void> {
  await (await db()).execute("DELETE FROM compare_sets WHERE id = $1", [id]);
}
