// 公式サイト(umamusume.jp)のお知らせから、対戦レースイベント(チャンピオンズミーティング・リーグ オブ ヒーローズ など)の
// 予定を取り出す。同期スクリプトで使う。

export type RaceCourse = {
  /** 例:京都 芝 3000m(長距離) 右・外 秋 昼 */
  text: string;
  surface?: "turf" | "dirt";
  distance?: "sprint" | "mile" | "medium" | "long";
  meters?: number;
  place?: string;
};

export type RaceEvent = {
  /** 例:チャンピオンズミーティングLONG / リーグ オブ ヒーローズ */
  name: string;
  /** 例:12月下旬(日にちが決まっていないとき) */
  when?: string;
  /** 開催期間(わかっているとき)。ISO 8601(日本時間) */
  start?: string;
  end?: string;
  course?: RaceCourse;
  /** 特殊ルール(例:デバフなし) */
  rules?: string[];
  /** 元のお知らせ */
  sourceId: number;
  sourceTitle: string;
};

export type EventsFile = {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  events: RaceEvent[];
};

/** お知らせのHTMLを、行ごとのテキストにする */
export function htmlToLines(html: string): string[] {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d|table|ul)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split("\n")
    .map((l) => l.normalize("NFKC").trim())
    .filter(Boolean);
}

const DISTANCE: Record<string, RaceCourse["distance"]> = { 短距離: "sprint", マイル: "mile", 中距離: "medium", 長距離: "long" };

/** 「京都 芝 3000m(長距離) 右・外 秋 昼」や「ダート 中距離」を読む */
export function parseCourse(text: string): RaceCourse {
  const c: RaceCourse = { text };
  if (/ダート/.test(text)) c.surface = "dirt";
  else if (/芝/.test(text)) c.surface = "turf";
  const d = text.match(/短距離|マイル|中距離|長距離/);
  if (d) c.distance = DISTANCE[d[0]];
  const m = text.match(/(\d{3,4})\s*m/);
  if (m) {
    c.meters = Number(m[1]);
    if (!c.distance) c.distance = c.meters <= 1400 ? "sprint" : c.meters <= 1800 ? "mile" : c.meters <= 2400 ? "medium" : "long";
  }
  const place = text.match(/^(\S+?)\s+(芝|ダート)/);
  if (place) c.place = place[1];
  return c;
}

const looksLikeCourse = (l: string) => /(芝|ダート)/.test(l) && /(短距離|マイル|中距離|長距離|\d{3,4}\s*m)/.test(l);

/**
 * 「11月～4月対戦レースイベント」のような、半年分の予定のお知らせを読む。
 * 「12月下旬:チャンピオンズミーティングLONG」の行と、その次のコースの行を組にする。
 */
export function parseSchedule(lines: string[], sourceId: number, sourceTitle: string): RaceEvent[] {
  const events: RaceEvent[] = [];
  let current: RaceEvent | null = null;
  for (const line of lines) {
    const head = line.match(/^(\d{1,2}\/\d{1,2}|\d{1,2}月(?:上旬|中旬|下旬|頃)?)\s*[::]\s*(.+)$/);
    if (head && /ミーティング|リーグ|レース|ヒーローズ/.test(head[2])) {
      current = { name: head[2].trim(), when: head[1], sourceId, sourceTitle };
      events.push(current);
      continue;
    }
    if (!current) continue;
    if (!current.course && looksLikeCourse(line)) current.course = parseCourse(line);
    const rule = line.match(/^特殊ルール\s*[::]\s*(.+)$/);
    if (rule) current.rules = [...(current.rules ?? []), rule[1].trim()];
    // 予定の一覧が終わったら止める
    if (/^(トレーナーガイド|正式な開催時期|注意事項)/.test(line)) current = null;
  }
  return events;
}

/** 「11/22 12:00」を、お知らせの日付から年を補って ISO 8601(日本時間)にする */
function toIso(md: string, postAt: string): string | undefined {
  const m = md.match(/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (!m) return undefined;
  const postYear = Number(postAt.slice(0, 4));
  const postMonth = Number(postAt.slice(5, 7));
  const month = Number(m[1]);
  // お知らせが12月で開催が1月なら、次の年
  const year = month < postMonth - 6 ? postYear + 1 : postYear;
  const pad = (n: string | number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(m[2])}T${pad(m[3])}:${m[4]}:00+09:00`;
}

/** 個別の開催のお知らせ(「リーグ オブ ヒーローズ」開催! など)から、期間とコースを読む */
export function parseAnnouncement(lines: string[], title: string, postAt: string, sourceId: number): RaceEvent | null {
  const nameMatch = title.match(/チャンピオンズミーティング\s*[「『]?([^」』]*)[」』]?|リーグ\s*オブ\s*ヒーローズ/);
  if (!nameMatch) return null;
  const name = /リーグ/.test(nameMatch[0]) ? "リーグ オブ ヒーローズ" : `チャンピオンズミーティング${nameMatch[1] ? `「${nameMatch[1]}」` : ""}`;
  const ev: RaceEvent = { name, sourceId, sourceTitle: title };
  // お知らせの本文は、見出しと文が同じ行につながっていることがあるので、全体を1つの文字列で探す
  const text = lines.join("\n");
  // 「イベント開催期間」のすぐあとの「11/22 12:00 ~ 12/1 11:59」
  const range = text.match(/(?:イベント)?開催期間[\s\S]{0,40}?(\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2})\s*[~〜～-]\s*(\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2})/);
  if (range) {
    ev.start = toIso(range[1], postAt);
    ev.end = toIso(range[2], postAt);
  }
  // 「対象レース」のあとのコース(同じ行か次の行)
  const course = text.match(/対象レース\s*\n?\s*([^\n]+)/);
  if (course && looksLikeCourse(course[1])) ev.course = parseCourse(course[1].trim());
  return ev.start || ev.course ? ev : null;
}

/** 同じイベントを1つにまとめる(個別のお知らせの内容を優先し、予定の一覧の特殊ルールなどでおぎなう) */
export function mergeEvents(fromSchedule: RaceEvent[], fromAnnouncements: RaceEvent[]): RaceEvent[] {
  const result = [...fromAnnouncements];
  for (const s of fromSchedule) {
    const kind = (n: string) => (/リーグ/.test(n) ? "loh" : /チャンピオンズ/.test(n) ? "cm" : n);
    // 個別のお知らせとだけ照らし合わせる(予定の一覧どうしは、同じ条件でも別の回なのでまとめない)
    const same = fromAnnouncements.find(
      (a) => kind(a.name) === kind(s.name) && a.course?.surface === s.course?.surface && a.course?.distance === s.course?.distance,
    );
    if (same) {
      same.when ??= s.when;
      if (s.rules) same.rules = s.rules;
    } else result.push(s);
  }
  return result;
}
