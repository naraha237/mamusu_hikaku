/** スキル一覧の取得元(出典表示にも使う) */
export const WIKI_SOURCE = {
  name: "Umamusume Wiki",
  id: "umamusu.wiki",
  origin: "https://umamusu.wiki",
  path: "/Game:List_of_Skills",
  url: "https://umamusu.wiki/Game:List_of_Skills",
  license: "CC BY-SA",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
} as const;

/** 補助の確認先(自動取得はしない) */
export const GAMETORA_SOURCE = {
  name: "GameTora",
  url: "https://gametora.com/umamusume/skills",
} as const;

/** 取得のときに名乗る User-Agent(アプリ名と連絡先) */
export const USER_AGENT = "mamusu_hikaku/1.0 (+https://github.com/naraha237/mamusu_hikaku)";

/** 件数がこの割合より減ったら、ページの構造が変わったとみなして更新を中止する */
export const MIN_COUNT_RATIO = 0.9;

/** 件数の下限(前回分がないときの目安) */
export const MIN_COUNT_ABSOLUTE = 500;

/**
 * 新しい一覧を受け入れてよいか調べる。
 * だめなときは理由(やさしい日本語)を返す。
 */
export function checkCount(newCount: number, prevCount: number | undefined): string | null {
  if (newCount < MIN_COUNT_ABSOLUTE) {
    return `スキルが ${newCount} 件しか読み取れませんでした(少なすぎます)。取得元のページの形が変わったかもしれません。`;
  }
  if (prevCount && newCount < prevCount * MIN_COUNT_RATIO) {
    return `スキルの件数が ${prevCount} 件から ${newCount} 件に大きく減りました。取得元のページの形が変わったかもしれません。`;
  }
  return null;
}
