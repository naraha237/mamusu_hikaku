// Umamusume Wiki と GameTora からスキル一覧を取得して data/skills.json を作る。
//   npx tsx scripts/sync-skills.ts           … 24時間以内に取得済みなら何もしない
//   npx tsx scripts/sync-skills.ts --force   … 24時間の制限を無視して取得する
// 件数が大きく減ったときは skills.json を書き換えずに終了コード 1 で終わる(Actions を失敗させる)。
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import kuromoji from "kuromoji";
import { checkCount, GAMETORA_SOURCE, USER_AGENT, WIKI_SOURCE } from "../src/lib/skills/constants";
import { diffSkills, isEmptyDiff, type SkillDiff } from "../src/lib/skills/diff";
import { mergeSources, parseGameTora } from "../src/lib/skills/gametora";
import { isAllowedByRobots } from "../src/lib/skills/robots";
import type { MasterSkill, SkillsFile } from "../src/lib/skills/types";
import { parseSkillsPage } from "../src/lib/skills/wikiParser";
import { toKatakana } from "../src/lib/text";
import { parseCards, parseRanks } from "../src/lib/umaData/gametora";
import type { RankStep, UmaCard, UmaDataFile } from "../src/lib/umaData/types";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "data/skills.json");
const UMAS_OUT = resolve(ROOT, "data/umas.json");
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
async function fetchWithRetry(url: string, headers: Record<string, string> = {}): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, ...headers } });
      if (res.status < 500) return res;
      if (attempt >= RETRY_WAIT_SECONDS.length) return res;
      console.warn(`HTTP ${res.status}(${url})。${RETRY_WAIT_SECONDS[attempt]}秒後にやり直します`);
    } catch (e) {
      if (attempt >= RETRY_WAIT_SECONDS.length) throw e;
      console.warn(`通信エラー(${e})。${RETRY_WAIT_SECONDS[attempt]}秒後にやり直します`);
    }
    await sleep(RETRY_WAIT_SECONDS[attempt]);
  }
}

async function checkRobots(origin: string, path: string, name: string) {
  const res = await fetchWithRetry(`${origin}/robots.txt`);
  if (res.ok) {
    if (!isAllowedByRobots(await res.text(), path, USER_AGENT)) {
      fail(`${name} の robots.txt で ${path} の取得が禁止されたため、中止しました。`);
    }
  } else if (res.status >= 500) {
    fail(`${name} の robots.txt を確認できませんでした(HTTP ${res.status})。`);
  }
}

/** Umamusume Wiki(記事ページ1つだけ) */
async function fetchWiki(): Promise<{ skills: MasterSkill[]; lastModified?: string }> {
  await checkRobots(WIKI_SOURCE.origin, WIKI_SOURCE.path, WIKI_SOURCE.name);
  const res = await fetchWithRetry(WIKI_SOURCE.url);
  if (!res.ok) fail(`Wiki のページを取得できませんでした(HTTP ${res.status})。`);
  return { skills: parseSkillsPage(await res.text()), lastModified: res.headers.get("last-modified") ?? undefined };
}

/** GameTora のデータ(目次の manifest にある版のファイル)を1つ取得する */
async function fetchGameToraData(manifest: Record<string, string>, key: string): Promise<unknown> {
  const version = manifest[key];
  if (!version) fail(`GameTora の目次に ${key} が見つかりませんでした。`);
  const res = await fetchWithRetry(`${GAMETORA_SOURCE.origin}/data/umamusume/${key}.${version}.json`);
  if (!res.ok) fail(`GameTora の ${key} を取得できませんでした(HTTP ${res.status})。`);
  return res.json();
}

/** GameTora(スキル・衣装・評価ランクの表) */
async function fetchGameTora(): Promise<{ skills: MasterSkill[]; version: string; cards: UmaCard[]; ranks: RankStep[] }> {
  await checkRobots(GAMETORA_SOURCE.origin, "/data/umamusume/skills.json", GAMETORA_SOURCE.name);
  const mRes = await fetchWithRetry(GAMETORA_SOURCE.manifestUrl);
  if (!mRes.ok) fail(`GameTora の目次を取得できませんでした(HTTP ${mRes.status})。`);
  const manifest = (await mRes.json()) as Record<string, string>;
  const skills = parseGameTora(await fetchGameToraData(manifest, "skills"));
  const cards = parseCards(await fetchGameToraData(manifest, "character-cards"));
  const ranks = parseRanks(await fetchGameToraData(manifest, "db-files/single_mode_rank"));
  return { skills, version: manifest.skills, cards, ranks };
}

/** data/umas.json(ウマ娘の名前・衣装・評価ランクの表)を書き出す。変わっていなければ書かない */
function writeUmas(cards: UmaCard[], ranks: RankStep[], version: string) {
  if (cards.length < 100 || ranks.length < 50) fail(`GameTora の衣装(${cards.length}件)かランク(${ranks.length}件)が少なすぎます。`);
  const prev: UmaDataFile | null = existsSync(UMAS_OUT) ? JSON.parse(readFileSync(UMAS_OUT, "utf8")) : null;
  if (prev && prev.cards.length > cards.length * 1.1) fail(`衣装の件数が ${prev.cards.length} 件から ${cards.length} 件に大きく減りました。`);
  if (prev && JSON.stringify(prev.cards) === JSON.stringify(cards) && JSON.stringify(prev.ranks) === JSON.stringify(ranks)) return;
  const file: UmaDataFile = {
    source: GAMETORA_SOURCE.name,
    sourceUrl: "https://gametora.com/umamusume/characters",
    fetchedAt: new Date().toISOString(),
    gametoraVersion: version,
    cards,
    ranks,
  };
  const { cards: c, ranks: r, ...meta } = file;
  const head = JSON.stringify(meta, null, 2).replace(/\n}$/, "");
  const lines = (xs: unknown[]) => xs.map((x) => "    " + JSON.stringify(x)).join(",\n");
  writeFileSync(UMAS_OUT, `${head},\n  "cards": [\n${lines(c)}\n  ],\n  "ranks": [\n${lines(r)}\n  ]\n}\n`);
  log(`- ${UMAS_OUT} を更新しました(衣装 ${cards.length} 件・ランク ${ranks.length} 段階)。`);
}

/** スキル名に読み(カタカナ)を付ける */
async function addReadings(skills: MasterSkill[]): Promise<void> {
  const require = createRequire(import.meta.url);
  const dicPath = resolve(dirname(require.resolve("kuromoji/package.json")), "dict");
  const tokenizer = await new Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>>((ok, ng) =>
    kuromoji.builder({ dicPath }).build((err, t) => (err ? ng(err) : ok(t))),
  );
  for (const s of skills) {
    const kana = tokenizer
      .tokenize(s.nameJa)
      .map((t) => (t.reading && t.reading !== "*" ? t.reading : toKatakana(t.surface_form)))
      .join("");
    // 読みが名前と同じ(すでにカタカナだけ)なら付けない
    if (kana !== toKatakana(s.nameJa)) s.kana = kana;
    else delete s.kana;
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

  const wiki = await fetchWiki();
  const gt = await fetchGameTora();
  mkdirSync(dirname(STATE), { recursive: true });
  writeFileSync(STATE, JSON.stringify({ lastCheckedAt: new Date().toISOString() }, null, 2) + "\n");

  // どちらかの取得元の形が変わっていないか、それぞれ確かめる
  const wikiProblem = checkCount(wiki.skills.length, undefined);
  if (wikiProblem) fail(`Umamusume Wiki: ${wikiProblem} skills.json は更新しませんでした。`);
  const gtProblem = checkCount(gt.skills.length, undefined);
  if (gtProblem) fail(`GameTora: ${gtProblem} skills.json は更新しませんでした。`);

  writeUmas(gt.cards, gt.ranks, gt.version);

  const skills = mergeSources(wiki.skills, gt.skills);
  const countError = checkCount(skills.length, prev?.skills.length);
  if (countError) fail(`${countError} skills.json は更新しませんでした。`);
  await addReadings(skills);

  const diff = diffSkills(prev?.skills ?? [], skills);
  log(`## スキル一覧の同期\n- Wiki: ${wiki.skills.length} 件 / GameTora: ${gt.skills.length} 件 / 合わせて: ${skills.length} 件`);
  if (prev && isEmptyDiff(diff) && prev.gametoraVersion === gt.version) {
    log("- スキルに変更はありませんでした。");
    return;
  }
  describeDiff(diff);

  const file: SkillsFile = {
    source: WIKI_SOURCE.id,
    sourceUrl: WIKI_SOURCE.url,
    license: WIKI_SOURCE.license,
    licenseUrl: WIKI_SOURCE.licenseUrl,
    attribution: `スキルのデータは ${WIKI_SOURCE.name}(${WIKI_SOURCE.url}、${WIKI_SOURCE.license})と ${GAMETORA_SOURCE.name}(${GAMETORA_SOURCE.url})の内容を加工して利用しています。`,
    fetchedAt: new Date().toISOString(),
    sourceLastModified: wiki.lastModified,
    sources: [
      { name: WIKI_SOURCE.name, url: WIKI_SOURCE.url, license: WIKI_SOURCE.license, licenseUrl: WIKI_SOURCE.licenseUrl },
      { name: GAMETORA_SOURCE.name, url: GAMETORA_SOURCE.url },
    ],
    gametoraVersion: gt.version,
    skills,
  };
  writeFileSync(OUT, formatSkillsFile(file));
  log(`- ${OUT} を更新しました。`);
}

main().catch((e) => fail(`予期しないエラー: ${e instanceof Error ? e.message : e}`));
