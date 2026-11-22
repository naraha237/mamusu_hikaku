// 対戦レースイベントの予定(data/events.json)を読み込む。
// 同梱のものをすぐ使い、裏で GitHub の新しいものを確認する(取れなくても同梱分で動く)。
import { invoke } from "@tauri-apps/api/core";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import bundledJson from "../../../data/events.json";
import { getDefaultConfig } from "../appInfo";
import { readJson, writeJson } from "../dataFiles";
import type { EventsFile } from "./parse";

const bundled = bundledJson as EventsFile;
const CACHE_FILE = "events-cache.json";
const EventsContext = createContext<EventsFile>(bundled);

const isEvents = (v: unknown): v is EventsFile => !!v && Array.isArray((v as EventsFile).events);

export function EventsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<EventsFile>(bundled);

  useEffect(() => {
    (async () => {
      const cached = await readJson<EventsFile>(CACHE_FILE);
      if (isEvents(cached) && Date.parse(cached.fetchedAt) > Date.parse(bundled.fetchedAt)) setData(cached);
      const config = await getDefaultConfig().catch(() => null);
      const base = config?.skillMaster.distributionUrl;
      const url = base?.replace(/skills\.json$/, "events.json");
      if (!url || url === base) return;
      try {
        const res = await invoke<{ status: number; body: string }>("http_get", { url });
        if (res.status !== 200) return;
        const fresh = JSON.parse(res.body);
        if (isEvents(fresh) && Date.parse(fresh.fetchedAt) > Date.parse((cached ?? bundled).fetchedAt)) {
          setData(fresh);
          await writeJson(CACHE_FILE, fresh);
        }
      } catch {
        // オフラインなどのときは、手元のものを使う
      }
    })();
  }, []);

  return <EventsContext.Provider value={data}>{children}</EventsContext.Provider>;
}

export const useEvents = () => useContext(EventsContext);
