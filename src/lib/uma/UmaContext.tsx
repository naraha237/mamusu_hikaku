import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as db from "./db";
import type { CompareSet, UmaEntry } from "./types";

type Ctx = {
  umas: UmaEntry[];
  loaded: boolean;
  /** 読み込みや保存に失敗したときの案内 */
  error: string | null;
  save: (uma: UmaEntry) => Promise<void>;
  remove: (id: string) => Promise<void>;
  sets: CompareSet[];
  saveSet: (set: CompareSet) => Promise<void>;
  removeSet: (id: string) => Promise<void>;
};

const UmaContext = createContext<Ctx | null>(null);

const SAVE_ERROR = "保存できませんでした。もう一度押してみてください。直らないときはアプリを開き直してください。";

export function UmaProvider({ children }: { children: ReactNode }) {
  const [umas, setUmas] = useState<UmaEntry[]>([]);
  const [sets, setSets] = useState<CompareSet[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([db.listUmas(), db.listCompareSets()])
      .then(([u, s]) => {
        setUmas(u);
        setSets(s);
      })
      .catch(() => setError("登録したウマ娘を読み込めませんでした。アプリを開き直してください。"))
      .finally(() => setLoaded(true));
  }, []);

  const save = useCallback(async (uma: UmaEntry) => {
    try {
      const saved = { ...uma, updatedAt: new Date().toISOString() };
      await db.saveUma(saved);
      setUmas((list) => (list.some((u) => u.id === uma.id) ? list.map((u) => (u.id === uma.id ? saved : u)) : [...list, saved]));
      setError(null);
    } catch (e) {
      setError(SAVE_ERROR);
      throw e;
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      await db.deleteUma(id);
      setUmas((list) => list.filter((u) => u.id !== id));
    } catch (e) {
      setError("消せませんでした。もう一度押してみてください。");
      throw e;
    }
  }, []);

  const saveSet = useCallback(async (set: CompareSet) => {
    try {
      await db.saveCompareSet(set);
      setSets((list) => [set, ...list.filter((s) => s.id !== set.id)]);
    } catch (e) {
      setError(SAVE_ERROR);
      throw e;
    }
  }, []);

  const removeSet = useCallback(async (id: string) => {
    await db.deleteCompareSet(id);
    setSets((list) => list.filter((s) => s.id !== id));
  }, []);

  return (
    <UmaContext.Provider value={{ umas, loaded, error, save, remove, sets, saveSet, removeSet }}>
      {children}
    </UmaContext.Provider>
  );
}

export function useUmas(): Ctx {
  const ctx = useContext(UmaContext);
  if (!ctx) throw new Error("UmaProvider の中で使ってください");
  return ctx;
}
