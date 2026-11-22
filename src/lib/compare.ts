import type { MasterSkill, SkillType } from "./skills/types";
import type { UmaEntry, UmaSkill } from "./uma/types";

/** 列ごとの色(グラフの線・列の見出し・「1人だけ」のハイライトで共通) */
export const COLUMN_COLORS = [
  { line: "#2563eb", soft: "bg-blue-100 dark:bg-blue-950", dot: "bg-blue-600" },
  { line: "#e11d48", soft: "bg-rose-100 dark:bg-rose-950", dot: "bg-rose-600" },
  { line: "#059669", soft: "bg-emerald-100 dark:bg-emerald-950", dot: "bg-emerald-600" },
  { line: "#d97706", soft: "bg-amber-100 dark:bg-amber-950", dot: "bg-amber-600" },
  { line: "#7c3aed", soft: "bg-violet-100 dark:bg-violet-950", dot: "bg-violet-600" },
];

/** その行の最大値・最小値。全員同じ(または1人だけ)なら null */
export function extremes(values: number[]): { max: number; min: number } | null {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  return max === min ? null : { max, min };
}

/** ヒートマップの濃さ(0〜1)。その行の中での位置で決める */
export function heatLevel(value: number, values: number[]): number {
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

export const formatDiff = (d: number) => (d > 0 ? `+${d}` : d < 0 ? `−${Math.abs(d)}` : "±0");

// ---- スキル ----

export type SkillRow = {
  key: string;
  name: string;
  type?: SkillType;
  master?: MasterSkill;
  /** 列ごとの所持状況(持っていなければ undefined) */
  owned: (UmaSkill | undefined)[];
  /** 列ごとの、持っているスキルの一覧の情報(同じ系統で ◎ と ○ が混ざるときに使う) */
  ownedMaster: (MasterSkill | undefined)[];
  count: number;
  /** 同じ系統の別のスキル(右回り◎ と 右回り○ など)が混ざっている */
  mixed: boolean;
};

export const skillKey = (s: UmaSkill) => (s.skillId ? `id:${s.skillId}` : `name:${s.name}`);

/** 比べるときの行の番号。同じ系統のスキル(○・◎・金)は同じ行にまとめる */
export const rowKeyOf = (s: UmaSkill, byId: Map<string, MasterSkill>) => {
  const fam = s.skillId ? byId.get(s.skillId)?.family : undefined;
  return fam ? `fam:${fam}` : skillKey(s);
};

/** 同じ系統の中での強さ(金 > ◎ > ○)。表示の順番と、代表の名前を決めるのに使う */
const strength = (m?: MasterSkill) => (!m ? 0 : m.type === "rare" || m.type === "evolved" ? 3 : /◎$/.test(m.nameJa) ? 2 : 1);

/** ◎・○・金 のような短い札(系統の中でどれを持っているか) */
export function variantLabel(m?: MasterSkill): string {
  if (!m) return "";
  if (m.type === "rare" || m.type === "evolved") return "金";
  const last = m.nameJa.slice(-1);
  return last === "◎" || last === "○" ? last : m.nameJa;
}

/** 比較対象全員のスキルを合わせた行を作る(最初に出てきた順) */
export function buildSkillRows(umas: UmaEntry[], master: MasterSkill[]): SkillRow[] {
  const byId = new Map(master.map((m) => [m.id, m]));
  const rows = new Map<string, SkillRow>();
  umas.forEach((u, col) => {
    for (const s of u.skills) {
      const key = rowKeyOf(s, byId);
      const m = s.skillId ? byId.get(s.skillId) : undefined;
      let row = rows.get(key);
      if (!row) {
        row = {
          key,
          name: m?.nameJa ?? s.name,
          type: m?.type ?? s.type,
          master: m,
          owned: umas.map(() => undefined),
          ownedMaster: umas.map(() => undefined),
          count: 0,
          mixed: false,
        };
        rows.set(key, row);
      }
      if (!row.owned[col]) {
        row.owned[col] = s;
        row.ownedMaster[col] = m;
        row.count++;
      }
    }
  });
  // 同じ系統で違うスキルが混ざっている行は、「右回り◎ / 右回り○」のように両方の名前にする
  for (const row of rows.values()) {
    const kinds = [...new Map(row.ownedMaster.filter((m): m is MasterSkill => !!m).map((m) => [m.id, m])).values()];
    if (kinds.length > 1) {
      kinds.sort((a, b) => strength(b) - strength(a));
      row.mixed = true;
      row.name = kinds.map((k) => k.nameJa).join(" / ");
      row.master = kinds[0];
      row.type = kinds[0].type;
    }
  }
  return [...rows.values()];
}

/** 金スキル(レア・進化)かどうか */
export const isGold = (t?: SkillType) => t === "rare" || t === "evolved";
