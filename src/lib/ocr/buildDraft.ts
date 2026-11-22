// 何枚かのスクリーンショットの読み取り結果を、1人分の登録内容(下書き)にまとめる。
import type { MasterSkill } from "../skills/types";
import { emptyUma, STAT_KEYS, STAT_MAX, type Aptitude, type Grade, type UmaEntry, type UmaSkill } from "../uma/types";
import { looksLikeNoise, MATCH_HINT, MATCH_SURE, matchSkill, normalizeForMatch } from "./matchSkill";
import type { Analysis } from "./types";
import { matchHeader } from "../umaData/match";
import { rankFromScore, type UmaDataFile } from "../umaData/types";

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

export type ReviewSkill = UmaSkill & { review?: SkillReview; /** 画面で並べ替えるための一時的な ID(保存しない) */ uid?: string };

export type FieldReview = { status: "ok" | "check"; reason?: string; /** 選び直せる候補 */ options?: string[] };

export type Draft = {
  uma: UmaEntry;
  skills: ReviewSkill[];
  /** 項目ごとの確認の要・不要 */
  fields: Record<string, FieldReview>;
  /** 読み取れなかった画像の数(パネルが見つからなかった) */
  failedImages: number;
};

const GRADES = "SABCDEFG";

/** 評価点の上限の目安(これより大きい値は読み違いとみなす) */
const MAX_SCORE = 150000;

/** 固有スキルの「Lv5」(L が「し」「I」などに読み違えられることがある) */
const LEVEL_ONLY = /^[lしi1|]?v\s*\d$/i;
const LEVEL_TAIL = /\s*[lしi1|]v\s*\d\s*$/i;
const LEVEL_ANY = /[lしi1|]v\s*(\d)\b/i;

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
export function buildDraft(analyses: Analysis[], master: MasterSkill[], umaData?: UmaDataFile, options: { voting?: boolean } = {}): Draft {
  const uma = emptyUma();
  const fields: Record<string, FieldReview> = {};
  const ok = analyses.filter((a) => a.panel);
  const failedImages = analyses.length - ok.length;

  // 名前・二つ名(最初に読めたもの)を、ウマ娘と衣装の一覧に照らし合わせる
  let nameText: string | undefined;
  let outfitText: string | undefined;
  for (const a of ok) {
    const h = parseHeader(a.headerLines);
    if (!nameText && h.name) nameText = h.name;
    if (!outfitText && h.outfit) outfitText = h.outfit;
  }
  const hm = umaData ? matchHeader(nameText, outfitText, umaData.cards) : undefined;
  uma.name = hm?.name ?? nameText ?? "";
  uma.outfit = hm?.outfit ?? outfitText;
  if (!uma.name) fields.name = { status: "check", reason: "名前を読み取れませんでした", options: hm?.nameOptions };
  else if (hm && !hm.nameSure) fields.name = { status: "check", reason: "読み取った名前と少し違います", options: hm.nameOptions };
  if (!uma.outfit) fields.outfit = { status: "check", reason: "二つ名を読み取れませんでした", options: hm?.outfitOptions };
  else if (hm && !hm.outfitSure) fields.outfit = { status: "check", reason: "読み取った二つ名と少し違います", options: hm.outfitOptions };

  // 評価点(いちばん多く読めた値)
  const scores = ok.map((a) => a.scoreText.normalize("NFKC").replace(/[^\d]/g, "")).filter((s) => /^\d{3,6}$/.test(s) && Number(s) <= MAX_SCORE);
  if (scores.length) {
    const counts = new Map<string, number>();
    for (const s of scores) counts.set(s, (counts.get(s) ?? 0) + 1);
    uma.score = Number([...counts].sort((x, y) => y[1] - x[1])[0][0]);
    // 評価ランクは評価点から決まる
    if (umaData) uma.rank = rankFromScore(uma.score, umaData.ranks);
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
  /** スキルごとに、何枚の画像で読めたか */
  const seenCount = new Map<string, number>();
  /** 最初か最後の画像に出てきたスキル(一番上・一番下の段は写る枚数が少ないので、多数決で捨てない) */
  const atEdgeImage = new Set<string>();
  const keyOf = (s: ReviewSkill) => (s.skillId ? `id:${s.skillId}` : `text:${normalizeForMatch(s.name)}`);
  ok.forEach((a, imageIndex) => {
    const edgeImage = imageIndex === 0 || imageIndex === ok.length - 1;
    const lines = a.skills;
    /** この画像の中で、すでに使ったスキル(同じ画像の別の行は、別のスキル) */
    const usedInThisImage = new Set<string>();
    lines.forEach((line, idx) => {
      if (LEVEL_ONLY.test(line.text.normalize("NFKC").trim())) return;
      const text = line.text.normalize("NFKC").replace(LEVEL_TAIL, "").trim();
      // 同じ段・同じ列に「Lv」がある行は、自分の固有スキル
      const levelText = [line.text, ...lines.filter((o, j) => j !== idx && o.column === line.column && Math.abs(o.y - line.y) < 0.03).map((o) => o.text)]
        .map((t) => t.normalize("NFKC").match(LEVEL_ANY))
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

      let key = keyOf(entry);
      let existing = skills.findIndex((s) => keyOf(s) === key);
      if (existing >= 0) {
        // 同じスキルに当てはまった行がすでにある。
        // 同じ画像の別の行か、読み取った文字が似ていないなら、別のスキル(読み違い)とみなす
        // 別の画像で同じスキルに当てはまったものは、同じスキル(スクロールで重なって写った)とみなす。
        // 同じ画像の別の行が同じスキルに当てはまったときだけ、読み違い(別のスキル)とみなす
        if (usedInThisImage.has(key)) {
          const used = new Set(skills.map(keyOf));
          const next = m.ranked.find((r) => !used.has(`id:${r.skill.id}`));
          entry = next
            ? {
                skillId: next.skill.id,
                name: next.skill.nameJa,
                type: next.skill.type,
                level: next.skill.type === "unique" ? (level ?? 1) : undefined,
                review: {
                  ocrText: line.text,
                  score: next.score,
                  status: "check",
                  alternatives: m.ranked.slice(0, 6).map((r) => r.skill),
                  reason: "ほかのスキルと同じ名前に読めたので、近い別のスキルにしました",
                },
              }
            : {
                name: text,
                review: { ocrText: line.text, score: m.score, status: "unknown", alternatives: m.ranked.slice(0, 6).map((r) => r.skill), reason: "読み取れませんでした" },
              };
          key = keyOf(entry);
          existing = skills.findIndex((s) => keyOf(s) === key);
        }
      }
      usedInThisImage.add(key);
      seenCount.set(key, (seenCount.get(key) ?? 0) + 1);
      if (edgeImage) atEdgeImage.add(key);
      if (existing < 0) skills.push(entry);
      else if ((entry.review?.score ?? 0) > (skills[existing].review?.score ?? 0)) skills[existing] = entry;
    });
  });

  // ライブキャプチャ(たくさんの画像)では、同じスキルが何枚にも写る。
  // 1枚にしか出てこない、確かでない読み取りは、読み違いとみなして捨てる
  const finalSkills =
    options.voting && ok.length >= 5
      ? skills.filter((s) => s.review?.status === "ok" || atEdgeImage.has(keyOf(s)) || (seenCount.get(keyOf(s)) ?? 0) >= 2)
      : skills;

  uma.portrait = ok.find((a) => a.portraitPng)?.portraitPng ?? undefined;
  uma.skills = finalSkills;
  return { uma, skills: finalSkills, fields, failedImages };
}
