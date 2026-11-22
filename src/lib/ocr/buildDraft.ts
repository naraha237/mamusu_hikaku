// 何枚かのスクリーンショットの読み取り結果を、1人分の登録内容(下書き)にまとめる。
import type { MasterSkill } from "../skills/types";
import { emptyUma, STAT_KEYS, STAT_MAX, type Aptitude, type Grade, type UmaEntry, type UmaSkill } from "../uma/types";
import { looksLikeNoise, MATCH_HINT, MATCH_SURE, matchSkill, normalizeForMatch } from "./matchSkill";
import type { Analysis } from "./types";

/** 読み取ったスキル1件の、確認画面用の情報 */
export type SkillReview = {
  /** 読み取った文字そのまま */
  ocrText: string;
  /** 一致の度合い(0〜1) */
  score: number;
  /** ok = そのまま / check = 要確認(黄色) / unknown = 一覧にない(新しいスキルかも) */
  status: "ok" | "check" | "unknown";
  /** ◎と○ など、選び直せる候補 */
  alternatives: MasterSkill[];
  /** 確認が必要な理由 */
  reason?: string;
};

export type ReviewSkill = UmaSkill & { review?: SkillReview };

export type FieldReview = { status: "ok" | "check"; reason?: string };

export type Draft = {
  uma: UmaEntry;
  skills: ReviewSkill[];
  /** 項目ごとの確認の要・不要 */
  fields: Record<string, FieldReview>;
  /** 読み取れなかった画像の数(パネルが見つからなかった) */
  failedImages: number;
};

const GRADES = "SABCDEFG";

/** 3〜4桁で上限以内の数字だけを候補にして、いちばん多いものを選ぶ */
export function pickStat(candidates: string[]): { value?: number; sure: boolean } {
  const values = candidates
    .map((c) => c.normalize("NFKC").replace(/[^\d]/g, ""))
    .filter((d) => /^\d{3,4}$/.test(d))
    .map(Number)
    .filter((n) => n > 0 && n <= STAT_MAX);
  if (!values.length) return { sure: false };
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const [value, count] = [...counts].sort((a, b) => b[1] - a[1])[0];
  return { value, sure: count >= 2 };
}

/** 「[二つ名]」の行と名前の行を見分ける */
export function parseHeader(lines: string[]): { outfit?: string; name?: string } {
  let outfit: string | undefined;
  let name: string | undefined;
  for (const raw of lines) {
    const l = raw.normalize("NFKC").trim();
    const m = l.match(/^[[「【](.+?)[\]」】]?$/);
    if (m && /^[[「【]/.test(l)) outfit = m[1].trim();
    else if (!name && l.length >= 2) name = l.replace(/ー+$/, (s) => (s.length > 1 ? "ー" : s)).trim();
  }
  // 名前の最後に「ー」が余分に付くことがある(読み取りの癖)
  if (name && /[^ー]ー$/.test(name) && /フェー$|ェー$/.test(name)) name = name.slice(0, -1);
  return { outfit, name };
}

/**
 * 読み取り結果をまとめる。
 * analyses はスクロールした順(上から下)に並んでいること。
 */
export function buildDraft(analyses: Analysis[], master: MasterSkill[]): Draft {
  const uma = emptyUma();
  const fields: Record<string, FieldReview> = {};
  const ok = analyses.filter((a) => a.panel);
  const failedImages = analyses.length - ok.length;

  // 名前・二つ名(最初に読めたもの)
  for (const a of ok) {
    const h = parseHeader(a.headerLines);
    if (!uma.name && h.name) uma.name = h.name;
    if (!uma.outfit && h.outfit) uma.outfit = h.outfit;
  }
  if (!uma.name) fields.name = { status: "check", reason: "名前を読み取れませんでした" };
  if (!uma.outfit) fields.outfit = { status: "check", reason: "二つ名を読み取れませんでした" };

  // 評価点(いちばん多く読めた値)
  const scores = ok.map((a) => a.scoreText.normalize("NFKC").replace(/[^\d]/g, "")).filter((s) => /^\d{4,6}$/.test(s));
  if (scores.length) {
    const counts = new Map<string, number>();
    for (const s of scores) counts.set(s, (counts.get(s) ?? 0) + 1);
    uma.score = Number([...counts].sort((x, y) => y[1] - x[1])[0][0]);
  } else fields.score = { status: "check", reason: "評価点を読み取れませんでした" };

  // ステータス(全部の画像の候補を合わせて多数決)
  STAT_KEYS.forEach((k, i) => {
    const picked = pickStat(ok.flatMap((a) => a.statCandidates[i] ?? []));
    if (picked.value !== undefined) uma.stats[k] = picked.value;
    if (!picked.sure) fields[`stats.${k}`] = { status: "check", reason: picked.value ? "読み取りが不確かです" : "読み取れませんでした" };
  });

  // 適性(画像ごとの結果の多数決)
  const aptitude = JSON.parse(JSON.stringify(uma.aptitude)) as Aptitude;
  const keys = ok[0]?.aptitudes.map((g) => g.key) ?? [];
  for (const key of keys) {
    const guesses = ok.map((a) => a.aptitudes.find((g) => g.key === key)).filter((g) => !!g);
    const counts = new Map<string, number>();
    for (const g of guesses) counts.set(g.grade, (counts.get(g.grade) ?? 0) + 1);
    const [grade] = [...counts].sort((x, y) => y[1] - x[1])[0];
    if (!GRADES.includes(grade)) continue;
    const [group, sub] = key.split(".") as [keyof Aptitude, string];
    (aptitude[group] as Record<string, Grade>)[sub] = grade as Grade;
    const sure = guesses.every((g) => g.sure && g.grade === grade);
    if (!sure) fields[`aptitude.${key}`] = { status: "check", reason: "文字の色が見分けにくい適性です" };
  }
  uma.aptitude = aptitude;

  // スキル(画像の順に並べ、同じスキルはまとめて、一致の度合いが高い結果を残す)
  const skills: ReviewSkill[] = [];
  const keyOf = (s: ReviewSkill) => (s.skillId ? `id:${s.skillId}` : `text:${normalizeForMatch(s.name)}`);
  for (const a of ok) {
    const lines = a.skills;
    lines.forEach((line, idx) => {
      if (/^lv\s*\d+$/i.test(line.text.normalize("NFKC").trim())) return;
      const text = line.text.replace(/\s*Lv\s*\d+\s*$/i, "").trim();
      // 同じ段・同じ列に「Lv」がある行は、自分の固有スキル
      const levelText = [line.text, ...lines.filter((o, j) => j !== idx && o.column === line.column && Math.abs(o.y - line.y) < 0.03).map((o) => o.text)]
        .map((t) => t.normalize("NFKC").match(/lv\s*(\d+)/i))
        .find((m) => m);
      const level = levelText ? Number(levelText[1]) : undefined;
      const m = matchSkill(text, line.endGlyph, master, level !== undefined);
      // スキル欄の端で切れている行は、はっきり一致したものだけを使う
      if (line.partial && m.score < MATCH_SURE) return;
      // 読み取りに失敗した文字の並びは捨てる
      if (m.score < MATCH_HINT && looksLikeNoise(text)) return;

      let entry: ReviewSkill;
      if (m.skill && m.score >= MATCH_HINT) {
        const needCheck = m.score < MATCH_SURE || !m.symbolSure;
        entry = {
          skillId: m.skill.id,
          name: m.skill.nameJa,
          type: m.skill.type,
          level: m.skill.type === "unique" ? (level ?? 1) : undefined,
          review: {
            ocrText: line.text,
            score: m.score,
            status: needCheck ? "check" : "ok",
            alternatives: m.symbolVariants.length ? m.symbolVariants : m.score < MATCH_SURE ? [m.skill, ...m.nearby] : [],
            reason: m.score < MATCH_SURE ? "読み取った名前と少し違います" : !m.symbolSure ? "◎・○ などの記号を確かめてください" : undefined,
          },
        };
      } else {
        entry = {
          name: text,
          review: {
            ocrText: line.text,
            score: m.score,
            status: "unknown",
            alternatives: m.skill ? [m.skill, ...m.nearby] : [],
            reason: "スキルの一覧にありません。新しいスキルかもしれません",
          },
        };
      }

      const key = keyOf(entry);
      const existing = skills.findIndex((s) => keyOf(s) === key);
      if (existing < 0) skills.push(entry);
      else if ((entry.review?.score ?? 0) > (skills[existing].review?.score ?? 0)) skills[existing] = entry;
    });
  }

  uma.portrait = ok.find((a) => a.portraitPng)?.portraitPng ?? undefined;
  uma.skills = skills;
  return { uma, skills, fields, failedImages };
}
