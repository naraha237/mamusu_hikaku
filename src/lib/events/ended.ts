// 終わったイベントの見分け方
import { eventEnd, eventLabel } from "./labels";
import type { RaceEvent } from "./parse";

const DAY = 24 * 3600 * 1000;

/** 終わったイベントのタグ(最終日の次の日になったもの) */
export function endedEventTags(events: RaceEvent[], now = Date.now()): string[] {
  const out = new Set<string>();
  for (const ev of events) {
    const end = eventEnd(ev);
    if (end !== undefined && now >= end + DAY) out.add(eventLabel(ev));
  }
  return [...out];
}
