import type { MasterSkill } from "./types";

export type SkillChange = {
  before: MasterSkill;
  after: MasterSkill;
  /** 変わった項目の名前 */
  fields: (keyof MasterSkill)[];
};

export type SkillDiff = {
  added: MasterSkill[];
  removed: MasterSkill[];
  changed: SkillChange[];
};

// limits(発動の決まり)は入れ子なので、JSON にして比べる
const FIELDS: (keyof MasterSkill)[] = ["nameJa", "nameEn", "type", "description", "sp", "negative", "iconId", "limits", "family"];
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** 前後のスキル一覧の差分(追加・削除・変更)を求める */
export function diffSkills(before: MasterSkill[], after: MasterSkill[]): SkillDiff {
  const oldMap = new Map(before.map((s) => [s.id, s]));
  const newMap = new Map(after.map((s) => [s.id, s]));
  const diff: SkillDiff = { added: [], removed: [], changed: [] };
  for (const s of after) {
    const o = oldMap.get(s.id);
    if (!o) {
      diff.added.push(s);
      continue;
    }
    const fields = FIELDS.filter((f) => !same(o[f], s[f]));
    if (fields.length) diff.changed.push({ before: o, after: s, fields });
  }
  for (const s of before) if (!newMap.has(s.id)) diff.removed.push(s);
  return diff;
}

export const isEmptyDiff = (d: SkillDiff) =>
  d.added.length === 0 && d.removed.length === 0 && d.changed.length === 0;
