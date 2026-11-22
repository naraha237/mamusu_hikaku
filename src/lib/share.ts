// 共有・バックアップ用のファイル(.umacmp)の中身を作る・読む。
// ファイルそのものの読み書き(zip)は Rust の share.rs で行う。
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { MasterSkill } from "./skills/types";
import type { UiSettings } from "./settings";
import { statTotal, type CompareSet, type UmaEntry } from "./uma/types";

export const PACKAGE_FORMAT = "mamusu_hikaku";
export const PACKAGE_VERSION = 1;

export type PackageFile = {
  format: typeof PACKAGE_FORMAT;
  version: number;
  /** backup = 全部のバックアップ、share = 選んだウマ娘だけ */
  kind: "backup" | "share";
  exportedAt: string;
  umas: UmaEntry[];
  compareSets?: CompareSet[];
  userSkills?: MasterSkill[];
  settings?: Partial<UiSettings>;
};

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
};

export function buildPackage(kind: PackageFile["kind"], umas: UmaEntry[], extra: Omit<Partial<PackageFile>, "kind" | "umas"> = {}): PackageFile {
  return { format: PACKAGE_FORMAT, version: PACKAGE_VERSION, kind, exportedAt: new Date().toISOString(), umas, ...extra };
}

/** 保存先を選んでもらって書き出す。やめたら false */
export async function exportPackage(pkg: PackageFile, suggestedName: string): Promise<boolean> {
  const path = await save({ defaultPath: suggestedName, filters: [{ name: "ウマ娘 比較ノートのデータ", extensions: ["umacmp"] }] });
  if (!path) return false;
  await invoke("write_umacmp", { path, json: JSON.stringify(pkg) });
  return true;
}

export const shareFileName = (umas: UmaEntry[]) =>
  umas.length === 1 ? `${umas[0].nickname || umas[0].name}_${today()}.umacmp` : `ウマ娘${umas.length}人_${today()}.umacmp`;
export const backupFileName = () => `ウマ娘比較ノート_バックアップ_${today()}.umacmp`;

/** ファイルを選んでもらう。やめたら null */
export async function pickPackageFile(): Promise<string | null> {
  const p = await open({ multiple: false, filters: [{ name: "ウマ娘 比較ノートのデータ", extensions: ["umacmp"] }] });
  return typeof p === "string" ? p : null;
}

/** .umacmp を読む。このアプリのファイルでなければ例外(やさしい日本語の文) */
export async function readPackage(path: string): Promise<PackageFile> {
  const json = await invoke<string>("read_umacmp", { path });
  let data: PackageFile;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("ファイルが壊れているようです。");
  }
  if (data?.format !== PACKAGE_FORMAT || !Array.isArray(data.umas)) throw new Error("このアプリのファイルではないようです。");
  if (data.version > PACKAGE_VERSION) throw new Error("新しいバージョンのアプリで作られたファイルです。アプリを更新してから読み込んでください。");
  return data;
}

// ---- 読み込むときの、重複の確認 ----

export type ImportChoice = "overwrite" | "keepBoth" | "skip";

export type ImportItem = {
  uma: UmaEntry;
  /** 同じウマ娘(同じデータ、または同じ名前・衣装・評価点・ステータス)がすでにいるか */
  duplicateOf?: UmaEntry;
  choice: ImportChoice;
};

const fingerprint = (u: UmaEntry) => [u.name, u.outfit ?? "", u.score ?? "", statTotal(u.stats), u.skills.length].join("|");

export function planImport(pkg: PackageFile, existing: UmaEntry[]): ImportItem[] {
  return pkg.umas.map((uma) => {
    const duplicateOf = existing.find((e) => e.id === uma.id) ?? existing.find((e) => fingerprint(e) === fingerprint(uma));
    // 同じものがあるときは、ひとまず「読み込まない」にしておく
    return { uma, duplicateOf, choice: duplicateOf ? "skip" : "keepBoth" };
  });
}

/** 選んだとおりに保存するウマ娘の一覧を作る */
export function applyImport(items: ImportItem[], newId: () => string): UmaEntry[] {
  const now = new Date().toISOString();
  return items.flatMap((it) => {
    if (it.choice === "skip") return [];
    if (it.choice === "overwrite" && it.duplicateOf) return [{ ...it.uma, id: it.duplicateOf.id, createdAt: it.duplicateOf.createdAt, updatedAt: now }];
    // 新しく足す(同じ ID のものがあってもぶつからないように、ID を付け直す)
    return [{ ...it.uma, id: it.duplicateOf ? newId() : it.uma.id, updatedAt: now }];
  });
}
