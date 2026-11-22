// 読み取った名前・二つ名を、ウマ娘と衣装の一覧に照らし合わせる
import { normalizeForMatch, similarity } from "../ocr/matchSkill";
import type { UmaCard } from "./types";

export type HeaderMatch = {
  name?: string;
  outfit?: string;
  nameSure: boolean;
  outfitSure: boolean;
  /** 名前の候補(要確認のとき) */
  nameOptions: string[];
  /** そのウマ娘の衣装の候補 */
  outfitOptions: string[];
};

const SURE = 0.8;
const HINT = 0.45;

export function matchHeader(nameText: string | undefined, outfitText: string | undefined, cards: UmaCard[]): HeaderMatch {
  const qn = nameText ? normalizeForMatch(nameText) : "";
  const qo = outfitText ? normalizeForMatch(outfitText) : "";
  const result: HeaderMatch = { name: nameText, outfit: outfitText, nameSure: false, outfitSure: false, nameOptions: [], outfitOptions: [] };
  if (!cards.length || (!qn && !qo)) return result;

  const scored = cards.map((c) => {
    const sn = qn ? similarity(qn, normalizeForMatch(c.name)) : undefined;
    const so = qo ? similarity(qo, normalizeForMatch(c.outfit)) : undefined;
    const total = sn !== undefined && so !== undefined ? (sn + so) / 2 : (sn ?? so ?? 0);
    return { c, sn: sn ?? 0, so: so ?? 0, total };
  });
  scored.sort((a, b) => b.total - a.total);
  const best = scored[0];
  if (best.total < HINT) {
    result.nameOptions = [...new Set(scored.filter((s) => s.sn >= HINT).map((s) => s.c.name))].slice(0, 5);
    return result;
  }

  result.name = best.c.name;
  result.nameSure = best.sn >= SURE || (!qn && best.so >= SURE);
  if (!result.nameSure) result.nameOptions = [...new Set(scored.slice(0, 12).map((s) => s.c.name))].slice(0, 5);

  const outfits = cards.filter((c) => c.name === best.c.name).map((c) => c.outfit);
  result.outfitOptions = outfits;
  if (qo && best.so >= HINT) {
    result.outfit = best.c.outfit;
    result.outfitSure = best.so >= SURE;
  } else if (outfits.length === 1) {
    // 衣装が1つしかないウマ娘なら、それに決まる
    result.outfit = outfits[0];
    result.outfitSure = true;
  } else {
    result.outfit = undefined;
  }
  return result;
}
