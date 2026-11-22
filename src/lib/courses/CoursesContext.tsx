// レース場・コースのデータ(data/courses.json)を読み込む。
// 同梱のものをすぐ使い、裏で GitHub の新しいものを確認する(取れなくても同梱分で動く)。
import { invoke } from "@tauri-apps/api/core";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import bundledJson from "../../../data/courses.json";
import { getDefaultConfig } from "../appInfo";
import { readJson, writeJson } from "../dataFiles";
import type { RaceEvent } from "../events/parse";
import type { Course, CoursesFile, Track } from "./types";

const bundled = bundledJson as unknown as CoursesFile;
const CACHE_FILE = "courses-cache.json";
const CoursesContext = createContext<CoursesFile>(bundled);

const isCourses = (v: unknown): v is CoursesFile => !!v && Array.isArray((v as CoursesFile).tracks) && (v as CoursesFile).tracks.length > 5;

export function CoursesProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CoursesFile>(bundled);
  useEffect(() => {
    (async () => {
      const cached = await readJson<CoursesFile>(CACHE_FILE);
      if (isCourses(cached) && Date.parse(cached.fetchedAt) > Date.parse(bundled.fetchedAt)) setData(cached);
      const config = await getDefaultConfig().catch(() => null);
      const base = config?.skillMaster.distributionUrl;
      const url = base?.replace(/skills\.json$/, "courses.json");
      if (!url || url === base) return;
      try {
        const res = await invoke<{ status: number; body: string }>("http_get", { url });
        if (res.status !== 200) return;
        const fresh = JSON.parse(res.body);
        if (isCourses(fresh) && Date.parse(fresh.fetchedAt) > Date.parse((cached ?? bundled).fetchedAt)) {
          setData(fresh);
          await writeJson(CACHE_FILE, fresh);
        }
      } catch {
        // オフラインなどのときは、手元のものを使う
      }
    })();
  }, []);
  return <CoursesContext.Provider value={data}>{children}</CoursesContext.Provider>;
}

export const useCourses = () => useContext(CoursesContext);

/**
 * イベントのコースの説明(例:京都 芝 3000m(長距離) 右・外)から、コースのデータを探す。
 * 見つからなければ null
 */
export function courseOfEvent(ev: RaceEvent | undefined, tracks: Track[]): { track: Track; course: Course } | null {
  const c = ev?.course;
  if (!c?.place || !c.meters || !c.surface) return null;
  const track = tracks.find((t) => t.name === c.place);
  if (!track) return null;
  const candidates = track.courses.filter((x) => x.length === c.meters && x.surface === c.surface);
  // 同じ距離で内回り・外回りがあるときは、説明の「内」「外」で選ぶ
  const want = /外→内|外内/.test(c.text) ? "outerToInner" : /外/.test(c.text) ? "outer" : /内/.test(c.text) ? "inner" : undefined;
  const course = candidates.find((x) => x.inout === want) ?? candidates[0];
  return course ? { track, course } : null;
}
