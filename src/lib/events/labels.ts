// 「使う予定のイベント」のタグ(例:12月チャンピオンズミーティングLONG / 11月リーグオブヒーローズ)
import type { UmaEntry } from "../uma/types";
import type { RaceEvent } from "./parse";

/** イベントではないけれど選べるもの */
export const ARENA = "競技場";

/** イベントの月(開催日がわかればその月、なければ「12月下旬」などから) */
function monthOf(ev: RaceEvent): number | undefined {
  if (ev.start) return new Date(ev.start).getMonth() + 1;
  const m = ev.when?.match(/^(\d{1,2})(?:月|\/)/);
  return m ? Number(m[1]) : undefined;
}

/** タグにする名前(例:12月チャンピオンズミーティングLONG) */
export function eventLabel(ev: RaceEvent): string {
  const month = monthOf(ev);
  const name = ev.name.replace(/\s+/g, "").replace(/[「」]/g, "");
  return month ? `${month}月${name}` : name;
}

/** イベントが終わった日時(わからなければ undefined) */
export const eventEnd = (ev: RaceEvent) => (ev.end ? Date.parse(ev.end) : undefined);

/** これからのイベント(終わっていないもの)を、近い順に。同じ名前は1つにする */
export function upcomingEvents(events: RaceEvent[], now = Date.now()): { label: string; event: RaceEvent }[] {
  const seen = new Set<string>();
  const out: { label: string; event: RaceEvent }[] = [];
  for (const ev of events) {
    const end = eventEnd(ev);
    if (end !== undefined && end < now) continue;
    const label = eventLabel(ev);
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, event: ev });
  }
  return out;
}

/** そのタグがイベント(または競技場)のタグか */
export function isEventTag(tag: string, events: RaceEvent[]): boolean {
  return tag === ARENA || events.some((e) => eventLabel(e) === tag);
}

/** ウマ娘についているイベントのタグ */
export const eventTagsOf = (u: UmaEntry, events: RaceEvent[]) => (u.tags ?? []).filter((t) => isEventTag(t, events));

/** タグのイベント(競技場や、もう一覧にないものは undefined) */
export const eventOfTag = (tag: string, events: RaceEvent[]) => events.find((e) => eventLabel(e) === tag);
