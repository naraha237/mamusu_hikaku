import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

// 一度取得したアイコンは、アプリを開いている間おぼえておく
const memory = new Map<number, Promise<string | null>>();

function loadIcon(iconId: number): Promise<string | null> {
  let p = memory.get(iconId);
  if (!p) {
    p = invoke<string | null>("skill_icon", { iconId }).catch(() => null);
    memory.set(iconId, p);
  }
  return p;
}

/** スキルのアイコン(なければ何も出さない) */
export function SkillIcon({ iconId, size = 20 }: { iconId?: number; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (iconId) loadIcon(iconId).then((s) => alive && setSrc(s));
    return () => {
      alive = false;
    };
  }, [iconId]);
  if (!src) return <span className="inline-block shrink-0" style={{ width: size, height: size }} />;
  return <img src={src} alt="" width={size} height={size} className="shrink-0" draggable={false} />;
}

/** キャラの顔(取り込んだ画面から切り抜いたもの) */
export function Portrait({ png, size = 40 }: { png?: string; size?: number }) {
  if (!png) return null;
  return (
    <img
      src={`data:image/png;base64,${png}`}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full border border-slate-300 dark:border-slate-600"
      draggable={false}
    />
  );
}
