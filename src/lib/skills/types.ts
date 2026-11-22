/** スキルの種類 */
export type SkillType = "normal" | "rare" | "unique" | "inherited" | "evolved" | "other";

/** スキルマスタの1件 */
export type MasterSkill = {
  /** 安定したID。Wiki のゲーム内スキルID(例 "200011")。ユーザー追加のスキルは "user-..." */
  id: string;
  nameJa: string;
  nameEn?: string;
  type: SkillType;
  description?: string;
  /** 必要SP(取得できないスキルは 0) */
  sp?: number;
  /** 下位スキルなど、マイナスの効果のスキル */
  negative?: boolean;
  /** スキルのアイコンの番号(GameTora の iconid) */
  iconId?: number;
  /** 名前の読み(カタカナ)。ひらがなで探すときに使う */
  kana?: string;
  /** 発動する脚質・距離・バ場の決まり(書いていない項目は、どれでも発動する) */
  limits?: SkillLimits;
  /** 同じ系統のスキル(右回り○・右回り◎・右回りの鬼 など)に共通の番号。比較で「共通」として扱う */
  family?: string;
};

export type StyleKey = "front" | "pace" | "late" | "end";
export type DistanceKey = "sprint" | "mile" | "medium" | "long";
export type SurfaceKey = "turf" | "dirt";
export type SkillLimits = { style?: StyleKey[]; distance?: DistanceKey[]; surface?: SurfaceKey[] };

export type SkillSource = { name: string; url: string; license?: string; licenseUrl?: string };

/** 配布する skills.json の形 */
export type SkillsFile = {
  source: string;
  sourceUrl: string;
  license: string;
  licenseUrl?: string;
  /** 出典の表示文 */
  attribution?: string;
  /** 内容が最後に変わった(取得した)日時 */
  fetchedAt: string;
  /** Wiki のページの Last-Modified(条件付き取得に使う) */
  sourceLastModified?: string;
  /** 使った取得元(Umamusume Wiki・GameTora) */
  sources?: SkillSource[];
  /** GameTora のデータの版(ファイル名のハッシュ) */
  gametoraVersion?: string;
  skills: MasterSkill[];
};
