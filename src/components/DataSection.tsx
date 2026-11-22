import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { fullPackage, listBackups, writeBackup, type BackupInfo } from "../lib/backup";
import { useSettings } from "../lib/settings";
import { backupFileName, exportPackage, pickPackageFile } from "../lib/share";
import { useSkillMaster } from "../lib/skills/SkillMasterContext";
import { useUmas } from "../lib/uma/UmaContext";
import { Button, Notice } from "./ui";

/** 設定画面の「データの管理」:バックアップ・戻す・データフォルダ・ログ */
export function DataSection({ onOpenPackage }: { onOpenPackage: (path: string) => void }) {
  const { umas, sets } = useUmas();
  const { userSkills } = useSkillMaster();
  const { settings } = useSettings();
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  const reload = () => listBackups().then(setBackups).catch(() => {});
  useEffect(() => {
    reload();
  }, []);

  const pkg = () => fullPackage(umas, sets, userSkills, settings);

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <h3 className="text-lg font-bold">データの管理</h3>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        登録したウマ娘は、この PC の中に保存されています。PC を買い替えるときなどのために、ときどきバックアップのファイルを作って、
        USB メモリなどに残しておくと安心です。週に1回、アプリが自動でもバックアップを作ります(直近5つを残します)。
      </p>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={async () => {
            try {
              if (await exportPackage(pkg(), backupFileName())) setMessage({ tone: "info", text: "バックアップのファイルを作りました。" });
            } catch {
              setMessage({ tone: "error", text: "作れませんでした。保存先を変えてもう一度試してください。" });
            }
          }}
        >
          バックアップのファイルを作る
        </Button>
        <Button
          onClick={async () => {
            const p = await pickPackageFile().catch(() => null);
            if (p) onOpenPackage(p);
          }}
        >
          バックアップから戻す
        </Button>
        <Button
          onClick={async () => {
            const dir = await invoke<string>("data_folder").catch(() => null);
            if (dir) openPath(dir).catch(() => setMessage({ tone: "error", text: "フォルダを開けませんでした。" }));
          }}
        >
          データのフォルダを開く
        </Button>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold">自動バックアップ</p>
          <Button
            variant="ghost"
            className="px-2 py-0.5 text-sm"
            onClick={async () => {
              await writeBackup(pkg()).catch(() => setMessage({ tone: "error", text: "作れませんでした。" }));
              reload();
            }}
          >
            いま作る
          </Button>
        </div>
        {backups.length === 0 ? (
          <p className="text-sm text-slate-500">まだありません。</p>
        ) : (
          <ul className="text-sm">
            {backups.map((b) => (
              <li key={b.path} className="flex items-center gap-2 py-0.5">
                <span className="flex-1">
                  {new Date(b.modified * 1000).toLocaleString()}
                  <span className="ml-2 text-xs text-slate-500">{Math.max(1, Math.round(b.size / 1024))}KB</span>
                </span>
                <Button variant="ghost" className="px-2 py-0.5 text-sm" onClick={() => onOpenPackage(b.path)}>
                  これに戻す
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-200 pt-3 text-sm dark:border-slate-700">
        <span className="flex-1 text-slate-600 dark:text-slate-300">アプリの調子が悪いときは、ログを保存して、配った人に送ってください。</span>
        <Button
          onClick={async () => {
            const path = await save({ defaultPath: "mamusu_hikaku_log.txt", filters: [{ name: "テキスト", extensions: ["txt"] }] });
            if (!path) return;
            await invoke("export_logs", { path })
              .then(() => setMessage({ tone: "info", text: "ログを保存しました。" }))
              .catch(() => setMessage({ tone: "error", text: "ログを保存できませんでした。" }));
          }}
        >
          ログを保存
        </Button>
      </div>
    </section>
  );
}
