// スキルの発動の決まり(脚質・距離・バ場)の表示と絞り込み
import type { DistanceKey, MasterSkill, SkillLimits, StyleKey, SurfaceKey } from "./types";

export const STYLE_LABEL: Record<StyleKey, string> = { front: "逃げ", pace: "先行", late: "差し", end: "追込" };
export const DISTANCE_LABEL: Record<DistanceKey, string> = { sprint: "短距離", mile: "マイル", medium: "中距離", long: "長距離" };
export const SURFACE_LABEL: Record<SurfaceKey, string> = { turf: "芝", dirt: "ダート" };

/** 「逃げ・長距離」のような短い説明(決まりがなければ空) */
export function limitsText(l?: SkillLimits): string {
  if (!l) return "";
  return [
    ...(l.style ?? []).map((k) => STYLE_LABEL[k]),
    ...(l.distance ?? []).map((k) => DISTANCE_LABEL[k]),
    ...(l.surface ?? []).map((k) => SURFACE_LABEL[k]),
  ].join("・");
}

export type LimitFilter = {
  style: StyleKey[];
  distance: DistanceKey[];
  surface: SurfaceKey[];
  /** 決まりのない(どれでも発動する)スキルも出すか */
  includeGeneral: boolean;
};

export const EMPTY_LIMIT_FILTER: LimitFilter = { style: [], distance: [], surface: [], includeGeneral: true };

export const isLimitFilterActive = (f: LimitFilter) => f.style.length + f.distance.length + f.surface.length > 0;

/**
 * 絞り込みに合うか。選んだ項目ごとに、
 * 「その項目の決まりがあって、選んだものを含む」か「決まりがない(どれでも発動)で、includeGeneral」なら合う。
 */
export function matchesLimits(skill: MasterSkill | undefined, f: LimitFilter): boolean {
  if (!isLimitFilterActive(f)) return true;
  const l = skill?.limits;
  const axis = <K extends string>(selected: K[], has?: K[]) =>
    selected.length === 0 || (has ? has.some((k) => selected.includes(k)) : f.includeGeneral);
  const ok = axis(f.style, l?.style) && axis(f.distance, l?.distance) && axis(f.surface, l?.surface);
  // 「どれでも発動するもの」を外すときは、選んだ項目のどれかに専用の決まりがあるものだけにする
  if (!f.includeGeneral) {
    const special =
      (f.style.length > 0 && !!l?.style) || (f.distance.length > 0 && !!l?.distance) || (f.surface.length > 0 && !!l?.surface);
    return ok && special;
  }
  return ok;
}
