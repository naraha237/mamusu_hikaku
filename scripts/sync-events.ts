// 公式サイト(umamusume.jp)のお知らせから、対戦レースイベントの予定を取得して data/events.json を作る。
//   npx tsx scripts/sync-events.ts           … 24時間以内に取得済みなら何もしない
//   npx tsx scripts/sync-events.ts --force   … 24時間の制限を無視して取得する
// 取得するのは「お知らせの一覧1ページ」「半年分の予定のお知らせ1件」「最近の開催のお知らせ(最大6件)」だけ。
// それぞれの間は1秒あける。
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { USER_AGENT } from "../src/lib/skills/constants";
import { isAllowedByRobots } from "../src/lib/skills/robots";
import { htmlToLines, mergeEvents, parseAnnouncement, parseSchedule, type EventsFile, type RaceEvent } from "../src/lib/events/parse";

const ORIGIN = "https://umamusume.jp";
const LIST_URL = `${ORIGIN}/api/ajax/pr_info_index?format=json&announce_label=0&device&per_page=50&page=1`;
const DETAIL_URL = (id: number) => `${ORIGIN}/api/ajax/pr_info_detail?format=json&announce_id=${id}`;
const MAX_DETAILS = 6;
const RECENT_DAYS = 60;

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "data/events.json");
const STATE = resolve(ROOT, "data/.sync-events-state.json");
const CACHE_HOURS = 24;

const force = process.argv.includes("--force");
const summaryFile = process.env.GITHUB_STEP_SUMMARY;
const log = (msg: string) => {
  console.log(msg);
  if (summaryFile) appendFileSync(summaryFile, msg + "\n");
};
const fail = (msg: string): never => {
  console.error(`::error::${msg}`);
  if (summaryFile) appendFileSync(summaryFile, `**失敗:** ${msg}\n`);
  process.exit(1);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type ListItem = { announce_id: number; title: string; post_at: string };
type Detail = { announce_id: number; title: string; message: string; post_at: string };

async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (res.ok) return (await res.json()) as T;
      if (res.status < 500 || attempt >= 2) fail(`公式サイトから取得できませんでした(HTTP ${res.status}): ${url}`);
    } catch (e) {
      if (attempt >= 2) fail(`公式サイトに接続できませんでした(${e})`);
    }
    await sleep(30_000 * (attempt + 1));
  }
}

async function main() {
  const state: { lastCheckedAt?: string } = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
  if (!force && state.lastCheckedAt && (Date.now() - Date.parse(state.lastCheckedAt)) / 3600_000 < CACHE_HOURS) {
    log("前回の取得から24時間たっていないので、イベントの予定は取得しません(--force で無視できます)。");
    return;
  }

  const robots = await fetch(`${ORIGIN}/robots.txt`, { headers: { "User-Agent": USER_AGENT } });
  if (robots.ok && !isAllowedByRobots(await robots.text(), "/api/ajax/pr_info_index", USER_AGENT)) {
    fail("公式サイトの robots.txt で取得が禁止されたため、中止しました。");
  }

  const list = (await getJson<{ information_list?: ListItem[] }>(LIST_URL)).information_list ?? [];
  if (!list.length) fail("お知らせの一覧が空でした。公式サイトの形が変わったかもしれません。");
  mkdirSync(dirname(STATE), { recursive: true });
  writeFileSync(STATE, JSON.stringify({ lastCheckedAt: new Date().toISOString() }, null, 2) + "\n");

  const byNewest = [...list].sort((a, b) => b.post_at.localeCompare(a.post_at));
  const scheduleItem = byNewest.find((i) => /対戦レースイベント/.test(i.title));
  const since = new Date(Date.now() - RECENT_DAYS * 86400_000).toISOString().slice(0, 10);
  const announceItems = byNewest
    .filter((i) => /(チャンピオンズミーティング|リーグ\s*オブ\s*ヒーローズ)/.test(i.title) && /開催/.test(i.title) && !/予告|終了/.test(i.title))
    .filter((i) => i.post_at.slice(0, 10) >= since)
    .slice(0, MAX_DETAILS);

  let schedule: RaceEvent[] = [];
  if (scheduleItem) {
    await sleep(1000);
    const d = (await getJson<{ detail: Detail }>(DETAIL_URL(scheduleItem.announce_id))).detail;
    schedule = parseSchedule(htmlToLines(d.message), d.announce_id, d.title);
  } else log("- 半年分の予定のお知らせが、一覧の1ページ目に見つかりませんでした。");

  const announced: RaceEvent[] = [];
  for (const item of announceItems) {
    await sleep(1000);
    const d = (await getJson<{ detail: Detail }>(DETAIL_URL(item.announce_id))).detail;
    const ev = parseAnnouncement(htmlToLines(d.message), d.title, d.post_at, d.announce_id);
    if (ev) announced.push(ev);
  }

  const events = mergeEvents(schedule, announced);
  log(`## イベントの予定\n- 予定の一覧: ${schedule.length} 件 / 開催のお知らせ: ${announced.length} 件 / 合わせて: ${events.length} 件`);
  for (const e of events) log(`  - ${e.when ?? ""} ${e.name} ${e.start ? `${e.start.slice(0, 16)}〜${e.end?.slice(0, 16)}` : ""} ${e.course?.text ?? ""}`);

  const prev: EventsFile | null = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
  if (prev && JSON.stringify(prev.events) === JSON.stringify(events)) {
    log("- 予定に変更はありませんでした。");
    return;
  }
  const file: EventsFile = { source: "ウマ娘 プリティーダービー 公式ポータルサイト", sourceUrl: `${ORIGIN}/news/`, fetchedAt: new Date().toISOString(), events };
  writeFileSync(OUT, JSON.stringify(file, null, 2) + "\n");
  log(`- ${OUT} を更新しました。`);
}

main().catch((e) => fail(`予期しないエラー: ${e instanceof Error ? e.message : e}`));
