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
};

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
  skills: MasterSkill[];
};
