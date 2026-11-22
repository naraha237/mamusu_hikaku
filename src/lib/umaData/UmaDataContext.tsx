// ウマ娘の名前・衣装・評価ランクの表を読み込む。
// 同梱の data/umas.json をすぐ使い、裏で GitHub の新しいものを確認する(取れなくても同梱分で動く)。
import { invoke } from "@tauri-apps/api/core";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import bundledJson from "../../../data/umas.json";
import { getDefaultConfig } from "../appInfo";
import { readJson, writeJson } from "../dataFiles";
import type { UmaDataFile } from "./types";

const bundled = bundledJson as UmaDataFile;
const CACHE_FILE = "umas-cache.json";

const UmaDataContext = createContext<UmaDataFile>(bundled);

const isUmaData = (v: unknown): v is UmaDataFile => {
  const d = v as UmaDataFile;
  return !!d && Array.isArray(d.cards) && Array.isArray(d.ranks) && d.cards.length > 100;
};

export function UmaDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<UmaDataFile>(bundled);

  useEffect(() => {
    (async () => {
      const cached = await readJson<UmaDataFile>(CACHE_FILE);
      if (isUmaData(cached) && Date.parse(cached.fetchedAt) > Date.parse(bundled.fetchedAt)) setData(cached);
      // スキル一覧と同じ場所(data/skills.json の隣)にある umas.json を確認する
      const config = await getDefaultConfig().catch(() => null);
      const url = config?.skillMaster.distributionUrl?.replace(/skills\.json$/, "umas.json");
      if (!url || url === config?.skillMaster.distributionUrl) return;
      try {
        const res = await invoke<{ status: number; body: string }>("http_get", { url });
        if (res.status !== 200) return;
        const fresh = JSON.parse(res.body);
        if (isUmaData(fresh) && Date.parse(fresh.fetchedAt) > Date.parse((cached ?? bundled).fetchedAt)) {
          setData(fresh);
          await writeJson(CACHE_FILE, fresh);
        }
      } catch {
        // オフラインなどのときは、手元のものを使う
      }
    })();
  }, []);

  return <UmaDataContext.Provider value={data}>{children}</UmaDataContext.Provider>;
}

export const useUmaData = () => useContext(UmaDataContext);
