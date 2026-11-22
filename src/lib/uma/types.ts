import type { SkillType } from "../skills/types";

export type Grade = "S" | "A" | "B" | "C" | "D" | "E" | "F" | "G";
export const GRADES: Grade[] = ["S", "A", "B", "C", "D", "E", "F", "G"];
/** 比較用の数値(S=8 … G=1) */
export const gradeValue = (g: Grade) => 8 - GRADES.indexOf(g);

export type StatKey = "speed" | "stamina" | "power" | "guts" | "wit";
export const STAT_KEYS: StatKey[] = ["speed", "stamina", "power", "guts", "wit"];
export const STAT_LABEL: Record<StatKey, string> = {
  speed: "スピード",
  stamina: "スタミナ",
  power: "パワー",
  guts: "根性",
  wit: "賢さ",
};
/** ステータスの上限(これを超える値は入力ミスとみなす) */
export const STAT_MAX = 2500;

export type Stats = Record<StatKey, number>;

export type Aptitude = {
  surface: { turf: Grade; dirt: Grade };
  distance: { sprint: Grade; mile: Grade; medium: Grade; long: Grade };
  style: { front: Grade; pace: Grade; late: Grade; end: Grade };
};

/** 適性の行の定義(表示順) */
export const APTITUDE_ROWS: { group: keyof Aptitude; key: string; label: string; groupLabel: string }[] = [
  { group: "surface", key: "turf", label: "芝", groupLabel: "バ場" },
  { group: "surface", key: "dirt", label: "ダート", groupLabel: "バ場" },
  { group: "distance", key: "sprint", label: "短距離", groupLabel: "距離" },
  { group: "distance", key: "mile", label: "マイル", groupLabel: "距離" },
  { group: "distance", key: "medium", label: "中距離", groupLabel: "距離" },
  { group: "distance", key: "long", label: "長距離", groupLabel: "距離" },
  { group: "style", key: "front", label: "逃げ", groupLabel: "脚質" },
  { group: "style", key: "pace", label: "先行", groupLabel: "脚質" },
  { group: "style", key: "late", label: "差し", groupLabel: "脚質" },
  { group: "style", key: "end", label: "追込", groupLabel: "脚質" },
];

export const getAptitude = (a: Aptitude, group: keyof Aptitude, key: string): Grade =>
  (a[group] as Record<string, Grade>)[key];

export type UmaSkill = {
  skillId?: string;
  name: string;
  level?: number;
  type?: SkillType;
};

export type FactorKind = "blue" | "red" | "green" | "white";
export const FACTOR_KIND_LABEL: Record<FactorKind, string> = {
  blue: "青(ステータス)",
  red: "赤(適性)",
  green: "緑(固有)",
  white: "白(スキルなど)",
};

export type Factor = { name: string; stars: 1 | 2 | 3; kind: FactorKind };

export type UmaEntry = {
  id: string;
  name: string;
  outfit?: string;
  nickname?: string;
  owner?: string;
  rank?: string;
  score?: number;
  stats: Stats;
  aptitude: Aptitude;
  skills: UmaSkill[];
  factors?: Factor[];
  sourceImages?: string[];
  /** キャラの顔(PNG を base64 にしたもの)。取り込んだ画面から切り抜く */
  portrait?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
};

export const newId = () => crypto.randomUUID();

export function emptyUma(): UmaEntry {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: "",
    stats: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
    aptitude: {
      surface: { turf: "A", dirt: "G" },
      distance: { sprint: "G", mile: "G", medium: "A", long: "G" },
      style: { front: "G", pace: "A", late: "G", end: "G" },
    },
    skills: [],
    factors: [],
    createdAt: now,
    updatedAt: now,
  };
}

export const statTotal = (s: Stats) => STAT_KEYS.reduce((sum, k) => sum + (s[k] || 0), 0);

/** 列の見出しなどに使う表示名 */
export const umaLabel = (u: UmaEntry) => u.nickname || u.name || "(名前なし)";

/** 比べられるのは最大5人 */
export const MAX_COMPARE = 5;

export type CompareSet = { id: string; name: string; umaIds: string[]; updatedAt: string };
