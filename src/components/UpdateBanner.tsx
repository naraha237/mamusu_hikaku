import { useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getAppInfo, getDefaultConfig } from "../lib/appInfo";

type State =
  | { kind: "none" }
  | { kind: "available"; update: Update; installed: boolean; pageUrl: string }
  | { kind: "updating"; percent: number | null }
  | { kind: "error"; message: string };

/** 起動時に新しい版を確認し、あれば画面の上に案内を出す。 */
export function UpdateBanner() {
  const [state, setState] = useState<State>({ kind: "none" });

  useEffect(() => {
    (async () => {
      try {
        const update = await check();
        if (!update) return;
        const [info, config] = await Promise.all([getAppInfo(), getDefaultConfig()]);
        setState({
          kind: "available",
          update,
          installed: info.installed,
          pageUrl: config.update.releasesPageUrl,
        });
      } catch {
        // ネットにつながっていないときなどは、何も出さない
      }
    })();
  }, []);

  if (state.kind === "none") return null;

  const doUpdate = async (update: Update) => {
    let total = 0;
    let done = 0;
    setState({ kind: "updating", percent: null });
    try {
      await update.downloadAndInstall((ev) => {
        if (ev.event === "Started") total = ev.data.contentLength ?? 0;
        if (ev.event === "Progress") {
          done += ev.data.chunkLength;
          setState({ kind: "updating", percent: total ? Math.round((done / total) * 100) : null });
        }
      });
      await relaunch();
    } catch {
      setState({
        kind: "error",
        message: "更新できませんでした。ネットにつながっているか確かめて、アプリを開き直してください。",
      });
    }
  };

  return (
    <div className="flex items-center gap-3 bg-sky-100 px-4 py-2 text-sm text-sky-900 dark:bg-sky-900 dark:text-sky-50">
      {state.kind === "available" && (
        <>
          <span className="flex-1">
            新しいバージョン({state.update.version})があります。更新しますか?
          </span>
          {state.installed ? (
            <button
              className="rounded bg-sky-600 px-3 py-1 font-bold text-white hover:bg-sky-700"
              onClick={() => doUpdate(state.update)}
            >
              更新する
            </button>
          ) : (
            <button
              className="rounded bg-sky-600 px-3 py-1 font-bold text-white hover:bg-sky-700"
              onClick={() => openUrl(state.pageUrl)}
            >
              ダウンロードページを開く
            </button>
          )}
          <button className="px-2 py-1 hover:underline" onClick={() => setState({ kind: "none" })}>
            あとで
          </button>
        </>
      )}
      {state.kind === "updating" && (
        <span>
          更新しています…{state.percent !== null ? ` ${state.percent}%` : ""} 終わると自動で開き直します。
        </span>
      )}
      {state.kind === "error" && (
        <>
          <span className="flex-1">{state.message}</span>
          <button className="px-2 py-1 hover:underline" onClick={() => setState({ kind: "none" })}>
            閉じる
          </button>
        </>
      )}
    </div>
  );
}
