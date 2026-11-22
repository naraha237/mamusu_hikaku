// GameTora のスキルデータ(skills.<hash>.json)を、アプリのスキルの形に直す。
// 同期スクリプトとアプリの両方から使う。
import type { MasterSkill, SkillType } from "./types";

type GtSkillCore = {
  id: number;
  rarity?: number;
  cost?: number;
  iconid?: number;
  name_en?: string;
  desc_en?: string;
};

type GtSkill = GtSkillCore & {
  jpname: string;
  jpdesc?: string;
  enname?: string;
  /** 固有スキルを継承したときの版(ID は 9xxxxx) */
  gene_version?: GtSkillCore;
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
