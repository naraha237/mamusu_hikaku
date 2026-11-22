// スキルマスタの読み込みと更新。
// 1. 配信(GitHub の skills.json)  2. Wiki を直接取得  3. 前回取得したもの  4. アプリに同梱したもの
// の順に試す。オフラインでも必ず 3 か 4 で動く。
import { invoke } from "@tauri-apps/api/core";
import bundledJson from "../../../data/skills.json";
import { readJson, writeJson } from "../dataFiles";
import { checkCount, WIKI_SOURCE, USER_AGENT } from "./constants";
import { diffSkills, isEmptyDiff, type SkillDiff } from "./diff";
import { isAllowedByRobots } from "./robots";
import type { MasterSkill, SkillsFile } from "./types";
import { parseSkillsPage } from "./wikiParser";

const bundled = bundledJson as SkillsFile;

const CACHE_FILE = "skills-cache.json";
const STATE_FILE = "skills-state.json";
const USER_SKILLS_FILE = "user-skills.json";
const WIKI_CACHE_HOURS = 24;
const WIKI_RETRY_WAIT_MS = [5_000, 15_000];

export type MasterOrigin = "distribution" | "wiki" | "cache" | "bundled";

type State = {
  /** 今使っているスキル一覧の出どころ */
  origin?: MasterOrigin;
  distributionEtag?: string;
  lastCheckedAt?: string;
  wikiCheckedAt?: string;
  /** 直近で内容が変わったときの差分 */
  lastDiff?: SkillDiff & { at: string };
  /** 直近の確認で起きた問題(やさしい日本語) */
  lastWarning?: string;
};

export type MasterStatus = {
  file: SkillsFile;
  origin: MasterOrigin;
  lastCheckedAt?: string;
  lastDiff?: SkillDiff & { at: string };
  warning?: string;
};

type HttpResult = { status: number; body: string; etag?: string; lastModified?: string };

const httpGet = (url: string, ifNoneMatch?: string, ifModifiedSince?: string) =>
  invoke<HttpResult>("http_get", { url, ifNoneMatch, ifModifiedSince });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isSkillsFile(v: unknown): v is SkillsFile {
  const f = v as SkillsFile;
  return !!f && Array.isArray(f.skills) && f.skills.every((s) => typeof s.id === "string" && typeof s.nameJa === "string");
}

/** 前回取得したものと同梱のもののうち、新しいほうを返す */
async function loadLocal(): Promise<{ file: SkillsFile; origin: MasterOrigin }> {
  const cached = await readJson<SkillsFile>(CACHE_FILE);
  if (cached && isSkillsFile(cached) && Date.parse(cached.fetchedAt) >= Date.parse(bundled.fetchedAt)) {
    return { file: cached, origin: "cache" };
  }
  return { file: bundled, origin: "bundled" };
}

/** 起動直後にすぐ使う版(通信しない) */
export async function loadMasterQuick(): Promise<MasterStatus> {
  const [{ file, origin }, state] = await Promise.all([loadLocal(), readJson<State>(STATE_FILE)]);
  return {
    file,
    origin: state?.origin && origin === "cache" ? state.origin : origin,
    lastCheckedAt: state?.lastCheckedAt,
    lastDiff: state?.lastDiff,
    warning: state?.lastWarning,
  };
}

/** 配信元(GitHub)から取得する。変わっていなければ null、だめなら例外 */
async function fetchDistribution(url: string, state: State): Promise<{ file: SkillsFile; etag?: string } | null> {
  const res = await httpGet(url, state.distributionEtag);
  if (res.status === 304) return null;
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  const file = JSON.parse(res.body);
  if (!isSkillsFile(file)) throw new Error("形式が正しくありません");
  return { file, etag: res.etag };
}

/** Wiki から直接取得する(配信元が使えないときだけ)。変わっていなければ null */
async function fetchWiki(current: SkillsFile): Promise<SkillsFile | null> {
  const robots = await httpGet(`${WIKI_SOURCE.origin}/robots.txt`);
  if (robots.status === 200 && !isAllowedByRobots(robots.body, WIKI_SOURCE.path, USER_AGENT)) {
    throw new Error("取得元のサイトの決まりで、取得が許可されていません");
  }

  let res: HttpResult | null = null;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await httpGet(WIKI_SOURCE.url, undefined, current.sourceLastModified);
      if (res.status < 500 || attempt >= WIKI_RETRY_WAIT_MS.length) break;
    } catch (e) {
      if (attempt >= WIKI_RETRY_WAIT_MS.length) throw e;
    }
    await sleep(WIKI_RETRY_WAIT_MS[attempt]);
  }
  if (res.status === 304) return null;
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);

  return {
    source: WIKI_SOURCE.id,
    sourceUrl: WIKI_SOURCE.url,
    license: WIKI_SOURCE.license,
    licenseUrl: WIKI_SOURCE.licenseUrl,
    fetchedAt: new Date().toISOString(),
    sourceLastModified: res.lastModified,
    skills: parseSkillsPage(res.body),
  };
}

/**
 * スキル一覧を新しくする。
 * force = true のときは、Wiki の24時間の制限を無視する(手動更新ボタン用)。
 */
export async function refreshMaster(distributionUrl: string | undefined, force = false): Promise<MasterStatus> {
  const local = await loadLocal();
  const state: State = (await readJson<State>(STATE_FILE)) ?? {};
  const now = new Date().toISOString();
  let next: { file: SkillsFile; origin: MasterOrigin } | null = null;
  let warning: string | undefined;
  let unchanged = false;

  const accept = (file: SkillsFile, origin: MasterOrigin): boolean => {
    const problem = checkCount(file.skills.length, local.file.skills.length);
    if (problem) {
      warning = `${problem} 前のスキル一覧をそのまま使います。`;
      return false;
    }
    next = { file, origin };
    return true;
  };

  // 1. 配信元
  if (distributionUrl) {
    try {
      // 手元に前回分がないときは、ETag を送らずに全体を取り直す
      const got = await fetchDistribution(distributionUrl, local.origin === "cache" ? state : {});
      if (got === null) unchanged = true;
      else if (accept(got.file, "distribution")) state.distributionEtag = got.etag;
    } catch {
      // 2 に進む
    }
  }

  // 2. Wiki を直接(配信元が未設定・失敗のときだけ)
  if (!next && !unchanged && !warning) {
    const recent =
      state.wikiCheckedAt && Date.now() - Date.parse(state.wikiCheckedAt) < WIKI_CACHE_HOURS * 3600_000;
    if (!recent || force) {
      try {
        state.wikiCheckedAt = now;
        const file = await fetchWiki(local.file);
        if (file === null) unchanged = true;
        else accept(file, "wiki");
      } catch {
        warning = "スキル一覧を新しくできませんでした。ネットにつながっているか確かめてください。前のスキル一覧をそのまま使います。";
      }
    }
  }

  // 3・4. 取得できなければ手元のものを使う
  let result: { file: SkillsFile; origin: MasterOrigin } = local;
  if (next) {
    const fresh: { file: SkillsFile; origin: MasterOrigin } = next;
    const diff = diffSkills(local.file.skills, fresh.file.skills);
    if (!isEmptyDiff(diff)) state.lastDiff = { ...diff, at: now };
    await writeJson(CACHE_FILE, fresh.file);
    state.origin = fresh.origin;
    result = fresh;
  } else if (local.origin === "bundled") {
    state.origin = "bundled";
  }

  if (!warning) state.lastCheckedAt = now;
  state.lastWarning = warning;
  await writeJson(STATE_FILE, state);

  return {
    file: result.file,
    origin: state.origin ?? result.origin,
    lastCheckedAt: state.lastCheckedAt,
    lastDiff: state.lastDiff,
    warning,
  };
}

// ---- ユーザーが追加・修正したスキル ----

/** ユーザーが追加・修正したスキル(同期で上書きされない) */
export const loadUserSkills = async () => (await readJson<MasterSkill[]>(USER_SKILLS_FILE)) ?? [];
export const saveUserSkills = (skills: MasterSkill[]) => writeJson(USER_SKILLS_FILE, skills);

/** マスタとユーザーのスキルを合わせる。同じIDならユーザーの内容を優先する */
export function mergeSkills(master: MasterSkill[], user: MasterSkill[]): MasterSkill[] {
  const userMap = new Map(user.map((s) => [s.id, s]));
  const merged = master.map((s) => userMap.get(s.id) ?? s);
  const masterIds = new Set(master.map((s) => s.id));
  for (const s of user) if (!masterIds.has(s.id)) merged.push(s);
  return merged;
}
