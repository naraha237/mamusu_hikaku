// GameTora のスキルデータ(skills.<hash>.json)を、アプリのスキルの形に直す。
// 同期スクリプトとアプリの両方から使う。
import type { DistanceKey, MasterSkill, SkillLimits, SkillType, StyleKey, SurfaceKey } from "./types";

type GtSkillCore = {
  id: number;
  rarity?: number;
  cost?: number;
  iconid?: number;
  name_en?: string;
  desc_en?: string;
  /** 発動条件(例:"running_style==1&phase_random==1")。グループどうしは「または」 */
  condition_groups?: { condition?: string }[];
};

/** 発動条件の文字列(グループどうしは「@」=または でつなぐ)。コースで発動できるかの確認に使う */
const condOf = (groups?: { condition?: string }[]) => {
  const s = (groups ?? []).map((g) => String(g.condition ?? "").trim()).filter(Boolean).join("@");
  return s || undefined;
};

const STYLE: Record<string, StyleKey> = { "1": "front", "2": "pace", "3": "late", "4": "end" };
const DISTANCE: Record<string, DistanceKey> = { "1": "sprint", "2": "mile", "3": "medium", "4": "long" };
const SURFACE: Record<string, SurfaceKey> = { "1": "turf", "2": "dirt" };

/**
 * 発動条件から、脚質・距離・バ場の決まりを取り出す。
 * 条件は「&」が「かつ」、「@」と複数のグループが「または」。
 * どれか1つの「または」の中に決まりがなければ、その項目はどれでも発動する。
 */
export function parseLimits(groups: { condition?: string }[] | undefined): SkillLimits | undefined {
  const alternatives = (groups ?? []).flatMap((g) => String(g.condition ?? "").split("@")).filter((s) => s.trim());
  if (!alternatives.length) return undefined;
  const pick = <K extends string>(key: string, table: Record<string, K>): K[] | undefined => {
    const values = new Set<K>();
    for (const alt of alternatives) {
      const m = [...alt.matchAll(new RegExp(`${key}==(\\d)`, "g"))];
      if (!m.length) return undefined; // この「または」には決まりがない → どれでも発動する
      for (const x of m) if (table[x[1]]) values.add(table[x[1]]);
    }
    return values.size ? [...values] : undefined;
  };
  const limits: SkillLimits = {
    style: pick("running_style", STYLE),
    distance: pick("distance_type", DISTANCE),
    surface: pick("ground_type", SURFACE),
  };
  return limits.style || limits.distance || limits.surface
    ? (Object.fromEntries(Object.entries(limits).filter(([, v]) => v)) as SkillLimits)
    : undefined;
}

type GtSkill = GtSkillCore & {
  jpname: string;
  jpdesc?: string;
  enname?: string;
  /** 固有スキルを継承したときの版(ID は 9xxxxx) */
  gene_version?: GtSkillCore;
  /** 同じ系統のスキルの ID(右回り◎ なら 右回り○・右回り×・右回りの鬼) */
  versions?: number[];
};

/** GameTora の rarity とスキルの種類の対応 */
function typeOf(rarity: number | undefined): SkillType {
  switch (rarity) {
    case 1:
      return "normal";
    case 2:
      return "rare";
    case 3:
    case 4:
    case 5:
      return "unique";
    case 6:
      return "evolved";
    default:
      return "other";
  }
}

const clean = (s: string | undefined) => (s ? s.replace(/\s+/g, " ").trim() : undefined);

export function parseGameTora(data: unknown): MasterSkill[] {
  if (!Array.isArray(data)) throw new Error("GameTora のデータの形が想定と違います");
  const out: MasterSkill[] = [];
  const seen = new Set<string>();
  const push = (s: MasterSkill) => {
    if (seen.has(s.id)) return;
    seen.add(s.id);
    out.push(s);
  };
  for (const raw of data as GtSkill[]) {
    if (typeof raw?.id !== "number" || typeof raw.jpname !== "string" || !raw.jpname.trim()) continue;
    const nameJa = raw.jpname.trim();
    const description = clean(raw.jpdesc);
    push({
      id: String(raw.id),
      nameJa,
      nameEn: raw.name_en ?? raw.enname,
      type: typeOf(raw.rarity),
      description,
      sp: raw.cost ?? 0,
      iconId: raw.iconid,
      limits: parseLimits(raw.condition_groups),
      cond: condOf(raw.condition_groups),
      // 同じ系統の中でいちばん小さい ID を系統の番号にする(マイナスの「×」は別あつかい)
      family: raw.versions?.length && !/×$/.test(nameJa) ? String(Math.min(raw.id, ...raw.versions)) : undefined,
    });
    const g = raw.gene_version;
    if (g && typeof g.id === "number") {
      push({
        id: String(g.id),
        nameJa,
        nameEn: g.name_en ?? raw.name_en ?? raw.enname,
        type: "inherited",
        description,
        sp: g.cost ?? 0,
        iconId: g.iconid ?? raw.iconid,
        limits: parseLimits(g.condition_groups ?? raw.condition_groups),
        cond: condOf(g.condition_groups ?? raw.condition_groups),
      });
    }
  }
  // 値が undefined の項目は消しておく(JSON を小さく・差分を読みやすくするため)
  return out.map((s) => Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)) as MasterSkill);
}

/**
 * Wiki と GameTora の一覧を合わせる。
 * 同じ ID なら GameTora の内容(日本語の説明・アイコン番号)を優先し、
 * 英語名・マイナスの印は Wiki の内容でおぎなう。どちらか片方だけでもよい。
 */
export function mergeSources(wiki: MasterSkill[] | null, gametora: MasterSkill[] | null): MasterSkill[] {
  if (!gametora) return wiki ?? [];
  if (!wiki) return gametora;
  const wikiById = new Map(wiki.map((s) => [s.id, s]));
  const merged = gametora.map((g) => {
    const w = wikiById.get(g.id);
    if (!w) return g;
    const m: MasterSkill = { ...g, nameEn: w.nameEn ?? g.nameEn };
    if (w.negative) {
      m.negative = true;
      m.type = "other";
    }
    if (!m.description && w.description) m.description = w.description;
    return m;
  });
  const gtIds = new Set(gametora.map((s) => s.id));
  for (const w of wiki) if (!gtIds.has(w.id)) merged.push(w);
  return merged;
}
