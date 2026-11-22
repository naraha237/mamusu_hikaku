// Umamusume Wiki「Game:List_of_Skills」のHTMLからスキル一覧を取り出す。
// 同期スクリプト(Node.js)とアプリの両方から使う。
import { parse, type HTMLElement } from "node-html-parser";
import type { MasterSkill, SkillType } from "./types";

/** 見出しのIDと、スキルの種類の対応 */
const SECTION_TYPES: Record<string, { type: SkillType; negative?: boolean }> = {
  Common_Skills: { type: "normal" },
  Rare_Skills: { type: "rare" },
  Negative_Skills: { type: "other", negative: true },
  Unique_Skills: { type: "unique" },
  Inherited: { type: "inherited" },
};

const clean = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

const textOf = (el: HTMLElement | null | undefined) => (el ? clean(decode(el.text)) : "");

/** 1行(tr)を1件のスキルにする。読めない行は null */
function parseRow(tr: HTMLElement, section: { type: SkillType; negative?: boolean }): MasterSkill | null {
  const tds = tr.querySelectorAll("td");
  if (tds.length < 4) return null;
  const nameCell = tds[1];

  const link = nameCell.querySelector("b a") ?? nameCell.querySelector("a");
  const idMatch = link?.getAttribute("href")?.match(/Game:Skills\/(\d+)/);
  if (!idMatch) return null;

  const bold = textOf(nameCell.querySelector("b"));
  const italic = textOf(nameCell.querySelector("i"));

  let nameJa: string;
  let nameEn: string | undefined;
  if (italic) {
    nameJa = italic;
    nameEn = bold || undefined;
  } else if (bold) {
    // 日本版だけのスキルは、太字に日本語名だけが入っている
    // (「Adventure of 564」のように、日本語名が英字のものもある)
    nameJa = bold;
  } else {
    return null;
  }

  const spText = textOf(tds[3]).replace(/,/g, "");
  const sp = /^-?\d+$/.test(spText) ? Number(spText) : undefined;

  let type = section.type;
  // レアスキルの欄で必要SPが0のものは、取得できない「進化スキル」
  if (type === "rare" && sp === 0) type = "evolved";

  const skill: MasterSkill = { id: idMatch[1], nameJa, type };
  if (nameEn) skill.nameEn = nameEn;
  const description = textOf(tds[2]);
  if (description) skill.description = description;
  if (sp !== undefined) skill.sp = sp;
  if (section.negative) skill.negative = true;
  return skill;
}

/** ページのHTML全体からスキル一覧を取り出す(IDの重複は先に出たものを残す) */
export function parseSkillsPage(html: string): MasterSkill[] {
  const root = parse(html);
  const result: MasterSkill[] = [];
  const seen = new Set<string>();
  let section: { type: SkillType; negative?: boolean } | null = null;

  // 見出しと表を、ページに出てくる順に見ていく
  for (const el of root.querySelectorAll("h2, h3, table")) {
    const tag = el.tagName.toLowerCase();
    if (tag === "h2" || tag === "h3") {
      const id = el.getAttribute("id") ?? "";
      if (id in SECTION_TYPES) section = SECTION_TYPES[id];
      else if (tag === "h2") section = null;
      continue;
    }
    if (!section) continue;
    for (const tr of el.querySelectorAll("tr")) {
      const skill = parseRow(tr, section);
      if (skill && !seen.has(skill.id)) {
        seen.add(skill.id);
        result.push(skill);
      }
    }
  }
  return result;
}
