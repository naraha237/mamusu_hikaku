import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getDefaultConfig } from "../appInfo";
import { loadMasterQuick, loadUserSkills, mergeSkills, refreshMaster, saveUserSkills, type MasterStatus } from "./master";
import type { MasterSkill } from "./types";

type Ctx = {
  status: MasterStatus | null;
  /** マスタとユーザー追加分を合わせた一覧 */
  skills: MasterSkill[];
  /** ユーザーが追加・修正したスキル */
  userSkills: MasterSkill[];
  busy: boolean;
  refresh: (force?: boolean) => Promise<void>;
  /** 追加・修正(同じ ID なら置き換え) */
  saveUserSkill: (skill: MasterSkill) => Promise<void>;
  removeUserSkill: (id: string) => Promise<void>;
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
      userRef.current = user;
      setUserSkills(user);
      urlRef.current = config?.skillMaster?.distributionUrl || undefined;
      await refresh();
    })();
  }, [refresh]);

  // 保存する一覧は、画面の更新を待たずに決めたいので ref でも持つ
  const userRef = useRef<MasterSkill[]>([]);
  const setUser = useCallback(async (next: MasterSkill[]) => {
    userRef.current = next;
    setUserSkills(next);
    await saveUserSkills(next);
  }, []);

  const saveUserSkill = useCallback(
    (skill: MasterSkill) => {
      const list = userRef.current;
      return setUser(list.some((s) => s.id === skill.id) ? list.map((s) => (s.id === skill.id ? skill : s)) : [...list, skill]);
    },
    [setUser],
  );

  const removeUserSkill = useCallback((id: string) => setUser(userRef.current.filter((s) => s.id !== id)), [setUser]);

  const skills = useMemo(() => (status ? mergeSkills(status.file.skills, userSkills) : []), [status, userSkills]);

  return (
    <SkillMasterContext.Provider value={{ status, skills, userSkills, busy, refresh, saveUserSkill, removeUserSkill }}>
      {children}
    </SkillMasterContext.Provider>
  );
}

export function useSkillMaster(): Ctx {
  const ctx = useContext(SkillMasterContext);
  if (!ctx) throw new Error("SkillMasterProvider の中で使ってください");
  return ctx;
}
