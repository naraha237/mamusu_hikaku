import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getDefaultConfig } from "../appInfo";
import { loadMasterQuick, loadUserSkills, mergeSkills, refreshMaster, type MasterStatus } from "./master";
import type { MasterSkill } from "./types";

type Ctx = {
  status: MasterStatus | null;
  /** マスタとユーザー追加分を合わせた一覧 */
  skills: MasterSkill[];
  busy: boolean;
  refresh: (force?: boolean) => Promise<void>;
};

const SkillMasterContext = createContext<Ctx | null>(null);

export function SkillMasterProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MasterStatus | null>(null);
  const [userSkills, setUserSkills] = useState<MasterSkill[]>([]);
  const [busy, setBusy] = useState(false);
  const urlRef = useRef<string | undefined>(undefined);
  const started = useRef(false);

  const refresh = useCallback(async (force = false) => {
    setBusy(true);
    try {
      setStatus(await refreshMaster(urlRef.current, force));
    } catch {
      // 失敗しても、手元の一覧はそのまま使える
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      // まず手元の一覧ですぐ表示し、そのあと裏で新しいものを確認する
      const [quick, user, config] = await Promise.all([
        loadMasterQuick(),
        loadUserSkills(),
        getDefaultConfig().catch(() => null),
      ]);
      setStatus(quick);
      setUserSkills(user);
      urlRef.current = config?.skillMaster?.distributionUrl || undefined;
      await refresh();
    })();
  }, [refresh]);

  const skills = useMemo(() => (status ? mergeSkills(status.file.skills, userSkills) : []), [status, userSkills]);

  return <SkillMasterContext.Provider value={{ status, skills, busy, refresh }}>{children}</SkillMasterContext.Provider>;
}

export function useSkillMaster(): Ctx {
  const ctx = useContext(SkillMasterContext);
  if (!ctx) throw new Error("SkillMasterProvider の中で使ってください");
  return ctx;
}
