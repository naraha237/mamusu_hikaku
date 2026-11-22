import { normalizeForSearch } from "../text";
import type { MasterSkill, SkillType } from "./types";

export const SKILL_TYPE_LABEL: Record<SkillType, string> = {
  unique: "固有",
  rare: "金",
  normal: "白",
  inherited: "継承",
  evolved: "進化",
  other: "その他",
};

type Indexed = { skill: MasterSkill; ja: string; kana: string; en: string };

const cache = new WeakMap<MasterSkill[], Indexed[]>();
function index(skills: MasterSkill[]): Indexed[] {
  let idx = cache.get(skills);
  if (!idx) {
    idx = skills.map((s) => ({
      skill: s,
      ja: normalizeForSearch(s.nameJa),
      kana: normalizeForSearch(s.kana ?? ""),
      en: normalizeForSearch(s.nameEn ?? ""),
    }));
    cache.set(skills, idx);
  }
  return idx;
}

/** スキル名の候補を探す(ひらがなで入れても、カタカナ・漢字の名前が見つかる) */
export function searchSkills(skills: MasterSkill[], query: string, limit = 10): MasterSkill[] {
  const q = normalizeForSearch(query);
  if (!q) return [];
  const scored: { s: MasterSkill; score: number }[] = [];
  for (const { skill, ja, kana, en } of index(skills)) {
    let score = -1;
    if (ja === q || kana === q) score = 0;
    else if (ja.startsWith(q) || kana.startsWith(q)) score = 1;
    else if (ja.includes(q) || kana.includes(q)) score = 2;
    else if (en.startsWith(q)) score = 3;
    else if (en.includes(q)) score = 4;
    // 継承スキルは固有スキルと同じ名前なので少し後ろにする
    if (score >= 0) scored.push({ s: skill, score: score * 10 + (skill.type === "inherited" ? 1 : 0) });
  }
  scored.sort((a, b) => a.score - b.score || a.s.nameJa.length - b.s.nameJa.length);
  return scored.slice(0, limit).map((x) => x.s);
}

/** 名前が完全に一致するスキル(継承より固有などを優先) */
export function findSkillByName(skills: MasterSkill[], name: string): MasterSkill | undefined {
  const q = normalizeForSearch(name);
  const hits = index(skills).filter((x) => x.ja === q);
  return (hits.find((h) => h.skill.type !== "inherited") ?? hits[0])?.skill;
}
