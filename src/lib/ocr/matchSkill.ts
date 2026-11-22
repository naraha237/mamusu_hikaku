// 読み取ったスキル名を、スキル一覧の名前とあいまいに照らし合わせる。
import type { MasterSkill } from "../skills/types";
import { toKatakana } from "../text";
import type { EndGlyph } from "./types";

/** 記号(◎○×)の種類 */
const SYMBOLS: Record<string, "double" | "single" | "cross"> = { "◎": "double", "○": "single", "〇": "single", "×": "cross" };
const SYMBOL_CHAR: Record<"double" | "single" | "cross", string> = { double: "◎", single: "○", cross: "×" };

/** 形が似ていて読み違えやすい文字を、同じ文字にそろえる(漢字→カタカナ など) */
const LOOKALIKE: Record<string, string> = {
  力: "カ",
  口: "ロ",
  工: "エ",
  夕: "タ",
  二: "ニ",
  八: "ハ",
  卜: "ト",
  一: "ー",
  了: "ア",
  // 季節のスキル(春夏秋冬ウマ娘)で、実際に読み違えた字
  各: "冬",
  呑: "春",
  漱: "秋",
  // 「深呼吸」の 呼 を 評 と読み違えた
  評: "呼",
};

/** 照らし合わせ用に文字をそろえる(記号・空白・句読点を除き、カタカナ・半角にそろえる) */
export function normalizeForMatch(s: string): string {
  return toKatakana(s.normalize("NFKC"))
    .toLowerCase()
    .replace(/[力口工夕二八卜一了各呑漱評]/g, (c) => LOOKALIKE[c])
    .replace(/[\s、。,.!！?？・･「」『』"“”'’ー―\-~〜…:：;；/／]/g, "")
    .replace(/[◎○〇×]/g, "");
}

/** 読み取りに失敗した、意味のない文字の並び(「ロ冂冂ロロ」など)か */
export function looksLikeNoise(text: string): boolean {
  const chars = [...text.replace(/\s/g, "")];
  if (!chars.length) return true;
  const boxy = chars.filter((c) => "ロ冂口一コ〕〔|丨".includes(c)).length;
  return boxy / chars.length >= 0.6;
}

/** 名前の最後の記号を取り出す */
function trailingSymbol(name: string): "double" | "single" | "cross" | null {
  const last = name.trim().slice(-1);
  return SYMBOLS[last] ?? null;
}

/** 読み取った文字の最後にある、記号らしいもの */
function ocrSymbol(text: string): "double" | "single" | "cross" | null {
  const t = text.trim();
  const last = t.slice(-1);
  if (last === "◎") return "double";
  if (last === "○" || last === "〇") return "single";
  if (last === "×") return "cross";
  return null;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 似ている度合い(0〜1) */
export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 0 : 1 - levenshtein(a, b) / max;
}

type Indexed = { skill: MasterSkill; base: string; symbol: ReturnType<typeof trailingSymbol> };
const cache = new WeakMap<MasterSkill[], Indexed[]>();
function index(master: MasterSkill[]): Indexed[] {
  let idx = cache.get(master);
  if (!idx) {
    idx = master.map((s) => ({ skill: s, base: normalizeForMatch(s.nameJa), symbol: trailingSymbol(s.nameJa) }));
    cache.set(master, idx);
  }
  return idx;
}

/** これ以上なら「一致」、HINT 以上なら「要確認」、それ未満は「一覧にない」 */
export const MATCH_SURE = 0.8;
export const MATCH_HINT = 0.5;

export type SkillMatch = {
  /** 一番近いスキル(見つからなければ undefined) */
  skill?: MasterSkill;
  score: number;
  /** 記号だけが違うスキル(◎と○ など)。記号が読み取れなかったときに選んでもらう */
  symbolVariants: MasterSkill[];
  /** 記号を読み取れたか */
  symbolSure: boolean;
  /** 次に近いスキル(要確認のときに選び直せるように) */
  nearby: MasterSkill[];
  /** 近い順の候補(ほかの行と同じスキルになってしまったときに、次の候補を選ぶため) */
  ranked: { skill: MasterSkill; score: number }[];
};

/**
 * 1行分の読み取り結果をスキルに当てはめる。
 * hasLevel = その行に「Lv」が付いていた(自分の固有スキル)なら true。
 * 同じ名前の固有と継承は、Lv があれば固有、なければ継承にする。
 */
export function matchSkill(text: string, glyph: EndGlyph, master: MasterSkill[], hasLevel: boolean): SkillMatch {
  const q = normalizeForMatch(text);
  const empty: SkillMatch = { score: 0, symbolVariants: [], symbolSure: false, nearby: [], ranked: [] };
  if (!q) return empty;

  const scored: { it: Indexed; sc: number }[] = [];
  for (const it of index(master)) {
    // 長さが大きく違うものは計算しない(速くするため)
    if (Math.abs(it.base.length - q.length) > Math.max(3, q.length * 0.5)) continue;
    scored.push({ it, sc: similarity(q, it.base) });
  }
  if (!scored.length) return empty;
  scored.sort((a, b) => b.sc - a.sc);
  const bestScore = scored[0].sc;
  // 一番近い名前(記号を除いた形)のものだけを候補にする
  const bestBase = scored[0].it.base;
  const best = scored.filter((x) => x.it.base === bestBase).map((x) => x.it);
  // ほかに近い名前(選び直し用、最大5つ)
  const nearby = [
    ...new Map(
      scored
        .filter((x) => x.it.base !== bestBase && x.sc >= Math.max(MATCH_HINT - 0.1, bestScore - 0.25))
        .filter((x) => x.it.skill.type !== "inherited")
        .map((x) => [x.it.skill.nameJa, x.it.skill]),
    ).values(),
  ].slice(0, 5);

  // 同じ名前(記号ちがいを含む)の候補を、種類と記号でしぼる
  let cands = best;
  const wantUnique = hasLevel;
  const byType = cands.filter((c) => (wantUnique ? c.skill.type === "unique" : c.skill.type !== "unique"));
  if (byType.length) cands = byType;

  const symbolVariants = [...new Map(cands.filter((c) => c.symbol).map((c) => [c.skill.nameJa, c.skill])).values()];
  const literal = ocrSymbol(text);
  const hinted = literal ?? (glyph === "double" || glyph === "single" || glyph === "cross" ? glyph : null);
  let pick = cands[0];
  let symbolSure = true;
  if (symbolVariants.length > 1) {
    const bySymbol = hinted ? cands.find((c) => c.symbol === hinted) : undefined;
    pick = bySymbol ?? cands.find((c) => c.symbol === "double") ?? cands[0];
    symbolSure = !!literal && !!bySymbol;
  }
  // 継承は固有と同じ名前なので、Lv がない行では継承を選ぶ
  if (!hasLevel) {
    const inherited = cands.find((c) => c.skill.nameJa === pick.skill.nameJa && c.skill.type === "inherited");
    if (inherited) pick = inherited;
  }
  // 近い順の候補(Lv の有無に合う種類だけ。継承と固有は同じ名前なので種類で分ける)
  const fits = (s: MasterSkill) => (hasLevel ? s.type === "unique" : s.type !== "unique");
  const ranked = scored
    .filter((x) => fits(x.it.skill) && x.sc >= MATCH_HINT)
    .slice(0, 12)
    .map((x) => ({ skill: x.it.skill, score: x.sc }));
  return { skill: pick.skill, score: bestScore, symbolVariants: symbolVariants.length > 1 ? symbolVariants : [], symbolSure, nearby, ranked };
}

export const symbolChar = (s: "double" | "single" | "cross") => SYMBOL_CHAR[s];
