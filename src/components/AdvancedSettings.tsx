import { useEffect, useState } from "react";
import { getDefaultConfig, type DefaultConfig } from "../lib/appInfo";
import { useSettings } from "../lib/settings";
import { Button, inputClass, Notice } from "./ui";

type Row = { title: string; className: string };

/** 詳細設定(上級者向け):ゲームのウィンドウを探す条件・覚えたウィンドウ・取り込みのキー */
export function AdvancedSettings() {
  const { settings, update } = useSettings();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<DefaultConfig | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [hotkey, setHotkey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getDefaultConfig()
      .then((c) => {
        setConfig(c);
        setRows(settings.windowCandidates?.length ? settings.windowCandidates : c.gameWindow.candidates.map(({ title, className }) => ({ title, className })));
        setHotkey(settings.captureHotkey || c.capture.hotkey);
      })
      .catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <button className="text-lg font-bold hover:underline" onClick={() => setOpen(!open)}>
        {open ? "▼" : "▶"} 詳細設定(ふつうは変えなくて大丈夫です)
      </button>
      {open && config && (
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <p className="font-bold">ゲームのウィンドウを探す条件</p>
            <p className="text-xs text-slate-500">
              ウィンドウのタイトルに含まれる文字(大文字・小文字は区別しません)と、クラス名で探します。クラス名を空にすると、タイトルだけで探します。
            </p>
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={`${inputClass} w-64`} placeholder="タイトル" value={r.title} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} />
                <input className={`${inputClass} w-48`} placeholder="クラス名" value={r.className} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, className: e.target.value } : x)))} />
                <Button variant="ghost" className="text-rose-600" onClick={() => setRows(rows.filter((_, k) => k !== i))}>
                  外す
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button onClick={() => setRows([...rows, { title: "", className: "" }])}>条件を足す</Button>
              <Button onClick={() => setRows(config.gameWindow.candidates.map(({ title, className }) => ({ title, className })))}>最初の状態に戻す</Button>
            </div>
          </div>

          <div className="space-y-1">
            <p className="font-bold">覚えているウィンドウ</p>
            {settings.rememberedWindow ? (
              <div className="flex items-center gap-2">
                <span>
                  {settings.rememberedWindow.title}({settings.rememberedWindow.className})
                </span>
                <Button onClick={() => update({ rememberedWindow: undefined })}>忘れる(次に確認し直す)</Button>
              </div>
            ) : (
              <p className="text-slate-500">まだありません。</p>
            )}
          </div>

          <div className="space-y-1">
            <p className="font-bold">取り込みの開始・停止のキー</p>
            <input className={`${inputClass} w-48`} value={hotkey} onChange={(e) => setHotkey(e.target.value)} />
            <p className="text-xs text-slate-500">例:Ctrl+Alt+U、Ctrl+Shift+F9。ほかのアプリと同じキーにすると使えません。</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={() => {
                const cleaned = rows.map((r) => ({ title: r.title.trim(), className: r.className.trim() })).filter((r) => r.title);
                update({ windowCandidates: cleaned, captureHotkey: hotkey.trim() || undefined });
                setSaved(true);
                setTimeout(() => setSaved(false), 2500);
              }}
            >
              保存
            </Button>
            {saved && <Notice>保存しました。</Notice>}
          </div>
        </div>
      )}
    </section>
  );
}
