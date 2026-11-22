// Umamusume Wiki からスキル一覧を取得して data/skills.json を作る。
//   npx tsx scripts/sync-skills.ts           … 24時間以内に取得済みなら何もしない
//   npx tsx scripts/sync-skills.ts --force   … 24時間の制限を無視して取得する
// 件数が大きく減ったときは skills.json を書き換えずに終了コード 1 で終わる(Actions を失敗させる)。
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { checkCount, USER_AGENT, WIKI_SOURCE } from "../src/lib/skills/constants";
import { diffSkills, isEmptyDiff, type SkillDiff } from "../src/lib/skills/diff";
import { isAllowedByRobots } from "../src/lib/skills/robots";
import type { MasterSkill, SkillsFile } from "../src/lib/skills/types";
import { parseSkillsPage } from "../src/lib/skills/wikiParser";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "data/skills.json");
/** 最後に取得を試みた日時など(git には入れない) */
const STATE = resolve(ROOT, "data/.sync-state.json");
const CACHE_HOURS = 24;
const RETRY_WAIT_SECONDS = [30, 60];

const force = process.argv.includes("--force");
const summaryFile = process.env.GITHUB_STEP_SUMMARY;

function log(msg: string) {
  console.log(msg);
  if (summaryFile) appendFileSync(summaryFile, msg + "\n");
}

function fail(msg: string): never {
  console.error(`::error::${msg}`);
  if (summaryFile) appendFileSync(summaryFile, `**失敗:** ${msg}\n`);
  process.exit(1);
}

const sleep = (sec: number) => new Promise((r) => setTimeout(r, sec * 1000));

/** 通信エラーや 5xx のときだけ、間隔を空けて最大2回やり直す */
async function fetchWithRetry(url: string, headers: Record<string, string>): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, ...headers } });
      if (res.status < 500) return res;
      if (attempt >= RETRY_WAIT_SECONDS.length) return res;
      console.warn(`HTTP ${res.status}。${RETRY_WAIT_SECONDS[attempt]}秒後にやり直します`);
    } catch (e) {
      if (attempt >= RETRY_WAIT_SECONDS.length) throw e;
      console.warn(`通信エラー(${e})。${RETRY_WAIT_SECONDS[attempt]}秒後にやり直します`);
    }
    await sleep(RETRY_WAIT_SECONDS[attempt]);
  }
}

/** 1件1行で書き出す(git の差分を読みやすくするため) */
function formatSkillsFile(file: SkillsFile): string {
  const { skills, ...meta } = file;
  const head = JSON.stringify(meta, null, 2).replace(/\n}$/, "");
  const body = skills.map((s) => "    " + JSON.stringify(s)).join(",\n");
  return `${head},\n  "skills": [\n${body}\n  ]\n}\n`;
}

function describeDiff(d: SkillDiff) {
  const name = (s: MasterSkill) => `${s.nameJa}(${s.id})`;
  log(`- 追加: ${d.added.length} 件 / 変更: ${d.changed.length} 件 / 削除: ${d.removed.length} 件`);
  for (const s of d.added.slice(0, 50)) log(`  - 追加 ${name(s)}`);
  for (const c of d.changed.slice(0, 50)) log(`  - 変更 ${name(c.after)}: ${c.fields.join(", ")}`);
  for (const s of d.removed.slice(0, 50)) log(`  - 削除 ${name(s)}`);
}

async function main() {
  const prev: SkillsFile | null = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
  const state: { lastCheckedAt?: string } = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};

  if (!force && state.lastCheckedAt) {
    const hours = (Date.now() - Date.parse(state.lastCheckedAt)) / 3600_000;
    if (hours < CACHE_HOURS) {
      log(`前回の取得から ${hours.toFixed(1)} 時間しかたっていないので、取得しません(--force で無視できます)。`);
      return;
    }
  }

  // robots.txt の確認
  const robotsRes = await fetchWithRetry(`${WIKI_SOURCE.origin}/robots.txt`, {});
  if (robotsRes.ok) {
    const robots = await robotsRes.text();
    if (!isAllowedByRobots(robots, WIKI_SOURCE.path, USER_AGENT)) {
      fail(`robots.txt で ${WIKI_SOURCE.path} の取得が禁止されたため、中止しました。`);
    }
  } else if (robotsRes.status >= 500) {
    fail(`robots.txt を確認できませんでした(HTTP ${robotsRes.status})。`);
  }

  // ページの取得(ページ1つだけ)
  const headers: Record<string, string> = {};
  if (prev?.sourceLastModified && !force) headers["If-Modified-Since"] = prev.sourceLastModified;
  const res = await fetchWithRetry(WIKI_SOURCE.url, headers);
  mkdirSync(dirname(STATE), { recursive: true });
  writeFileSync(STATE, JSON.stringify({ lastCheckedAt: new Date().toISOString() }, null, 2) + "\n");

  if (res.status === 304) {
    log("Wiki のページは前回から変わっていません。");
    return;
  }
  if (!res.ok) fail(`Wiki のページを取得できませんでした(HTTP ${res.status})。`);

  const skills = parseSkillsPage(await res.text());
  const countError = checkCount(skills.length, prev?.skills.length);
  if (countError) fail(`${countError} skills.json は更新しませんでした。`);

  const diff = diffSkills(prev?.skills ?? [], skills);
  log(`## スキル一覧の同期\n- 取得件数: ${skills.length} 件`);
  if (prev && isEmptyDiff(diff)) {
    log("- スキルに変更はありませんでした。");
    return;
  }
  describeDiff(diff);

  const file: SkillsFile = {
    source: WIKI_SOURCE.id,
    sourceUrl: WIKI_SOURCE.url,
    license: WIKI_SOURCE.license,
    licenseUrl: WIKI_SOURCE.licenseUrl,
    attribution: `スキルのデータは ${WIKI_SOURCE.name}(${WIKI_SOURCE.url})の内容を ${WIKI_SOURCE.license} のもとで加工して利用しています。`,
    fetchedAt: new Date().toISOString(),
    sourceLastModified: res.headers.get("last-modified") ?? undefined,
    skills,
  };
  writeFileSync(OUT, formatSkillsFile(file));
  log(`- ${OUT} を更新しました。`);
}

main().catch((e) => fail(`予期しないエラー: ${e instanceof Error ? e.message : e}`));
