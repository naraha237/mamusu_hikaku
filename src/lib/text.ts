/** ひらがなをカタカナにする */
export const toKatakana = (s: string) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

/**
 * 検索用に文字をそろえる。
 * 全角英数→半角、ひらがな→カタカナ、大文字→小文字、空白を除く。
 */
export const normalizeForSearch = (s: string) =>
  toKatakana(s.normalize("NFKC")).toLowerCase().replace(/\s+/g, "");
