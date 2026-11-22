// 取り込み中に出す、小さな案内用の窓(常に手前に表示。ユーザーが好きな場所に動かせる)。
// ゲームの窓には何も描かない。
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { GUIDE_EVENT, type GuideState } from "./lib/capture/api";

export function GuideWindow() {
  const [state, setState] = useState<GuideState>({ status: "running", found: 0, tooFast: false });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);
    const p = listen<GuideState>(GUIDE_EVENT, (e) => setState(e.payload));
    return () => {
      p.then((f) => f());
    };
  }, []);

  return (
    <div className="flex h-screen select-none flex-col gap-2 bg-white p-3 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <div className="flex items-center gap-2">
        <span className="animate-pulse rounded bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">
          {state.status === "paused" ? "一時停止中" : "● 取り込み中"}
        </span>
        <span className="text-sm">
          スキル <b className="text-lg">{state.found}</b> 個
        </span>
      </div>
      {state.tooFast ? (
        <p className="rounded bg-amber-100 p-2 text-center font-bold text-amber-900">少しゆっくりスクロールしてください</p>
      ) : state.message ? (
        <p className="rounded bg-amber-100 p-2 text-center text-sm text-amber-900">{state.message}</p>
      ) : (
        <p className="text-center text-sm">このくらいの速さで、スキル欄を下へスクロールしてね</p>
      )}
      {/* スクロールの速さの見本(1段ずつ、ゆっくり下がる) */}
      <div className="relative mx-auto h-24 w-40 overflow-hidden rounded border border-slate-300 dark:border-slate-600">
        <div className="guide-scroll absolute inset-x-2 top-0 space-y-1.5">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className={`h-4 rounded ${i % 3 === 1 ? "bg-amber-300" : "bg-slate-300 dark:bg-slate-600"}`} />
          ))}
        </div>
      </div>
      <p className="text-center text-xs text-slate-500">止めるときはアプリの「停止」か、決めたキーを押します</p>
    </div>
  );
}
