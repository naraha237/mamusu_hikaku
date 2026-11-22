// GameTora の character-cards と single_mode_rank を、アプリの形に直す(同期スクリプトで使う)
import type { RankStep, UmaCard } from "./types";

type GtCard = { card_id: number; char_id: number; name_jp: string; title_jp?: string };
type GtRank = { id: number; min_value: number };

export function parseCards(data: unknown): UmaCard[] {
  if (!Array.isArray(data)) throw new Error("GameTora の衣装のデータの形が想定と違います");
  return (data as GtCard[])
    .filter((c) => typeof c.card_id === "number" && c.name_jp)
    .map((c) => ({
      cardId: c.card_id,
      charId: c.char_id,
      name: c.name_jp.trim(),
      outfit: (c.title_jp ?? "").replace(/^\s*[[［]/, "").replace(/[\]］]\s*$/, "").trim(),
    }))
    .sort((a, b) => a.cardId - b.cardId);
}

// 評価ランクの名前:G〜SS+ の18段階のあと、U・L・M… の各文字(G F E D C B A S)ごとに「無印・1〜9」の10段階。
// (表には番号しかないので、ゲームの表示に合わせて名前を付ける。58367点 = UA3 などで確認済み)
const BASIC = ["G", "G+", "F", "F+", "E", "E+", "D", "D+", "C", "C+", "B", "B+", "A", "A+", "S", "S+", "SS", "SS+"];
const LETTERS = ["G", "F", "E", "D", "C", "B", "A", "S"];
const TIERS = ["U", "L", "M", "N", "O", "P", "Q"];

function rankName(index: number): string {
  if (index < BASIC.length) return BASIC[index];
  const k = index - BASIC.length;
  const n = k % 10;
  return `${TIERS[Math.floor(k / 80)] ?? "?"}${LETTERS[Math.floor((k % 80) / 10)]}${n || ""}`;
}

export function parseRanks(data: unknown): RankStep[] {
  if (!Array.isArray(data)) throw new Error("GameTora のランクのデータの形が想定と違います");
  return (data as GtRank[])
    .filter((r) => typeof r.id === "number" && typeof r.min_value === "number")
    .sort((a, b) => a.id - b.id)
    .map((r, i) => ({ min: r.min_value, name: rankName(i) }));
}
