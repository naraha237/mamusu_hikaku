// バックアップ(手動・週1回の自動)
import { invoke } from "@tauri-apps/api/core";
import type { UiSettings } from "./settings";
import { buildPackage, type PackageFile } from "./share";
import type { MasterSkill } from "./skills/types";
import type { CompareSet, UmaEntry } from "./uma/types";

export type BackupInfo = { name: string; path: string; size: number; modified: number };

const WEEK_MS = 7 * 24 * 3600 * 1000;

export function fullPackage(umas: UmaEntry[], compareSets: CompareSet[], userSkills: MasterSkill[], settings: UiSettings): PackageFile {
  return buildPackage("backup", umas, { compareSets, userSkills, settings });
}

export const listBackups = () => invoke<BackupInfo[]>("list_backups");

const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);

/** データフォルダの backups に作る(直近5つを残す) */
export const writeBackup = (pkg: PackageFile) => invoke<string>("write_backup", { json: JSON.stringify(pkg), stamp: stamp() });

/** 前の自動バックアップから1週間たっていたら作る。作ったら true */
export async function autoBackupIfDue(make: () => PackageFile): Promise<boolean> {
  const list = await listBackups();
  const newest = list[0]?.modified ? list[0].modified * 1000 : 0;
  if (Date.now() - newest < WEEK_MS) return false;
  const pkg = make();
  if (!pkg.umas.length) return false; // 何も登録していないうちは作らない
  await writeBackup(pkg);
  return true;
}
