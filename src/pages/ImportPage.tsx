import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Notice } from "../components/ui";
import { analyzeImage, listImagesInFolder, readImageFile } from "../lib/ocr/analyze";
import { buildDraft, type Draft } from "../lib/ocr/buildDraft";
import type { Analysis } from "../lib/ocr/types";
import { useSkillMaster } from "../lib/skills/SkillMasterContext";
import { newId } from "../lib/uma/types";

export type ImportedImage = {
  id: string;
  name: string;
  /** 表示用の URL(blob:) */
  url: string;
  bytes: Uint8Array;
  status: "waiting" | "reading" | "done" | "failed";
  analysis?: Analysis;
  error?: string;
};

const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;

export function ImportPage({ onDone }: { onDone: (draft: Draft, images: ImportedImage[]) => void }) {
  const { skills } = useSkillMaster();
  const [images, setImages] = useState<ImportedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<{ tone: "info" | "warn" | "error"; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const addBytes = useCallback((items: { name: string; bytes: Uint8Array }[]) => {
    if (!items.length) return;
    setImages((list) => [
      ...list,
      ...items.map((it) => ({
        id: newId(),
        name: it.name,
        bytes: it.bytes,
        url: URL.createObjectURL(new Blob([it.bytes as BlobPart])),
        status: "waiting" as const,
      })),
    ]);
    setMessage({ tone: "info", text: `${items.length}枚の画像を追加しました。` });
  }, []);

  const addPaths = useCallback(
    async (paths: string[]) => {
      const items: { name: string; bytes: Uint8Array }[] = [];
      let skipped = 0;
      for (const p of paths) {
        try {
          items.push({ name: fileName(p), bytes: await readImageFile(p) });
        } catch {
          skipped++;
        }
      }
      addBytes(items);
      if (skipped) setMessage({ tone: "warn", text: `${skipped}個のファイルは画像ではないため、読み込みませんでした(PNG か JPEG の画像を使ってください)。` });
    },
    [addBytes],
  );

  // Ctrl+V で貼り付け(続けて何枚でも)
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.items ?? [])].filter((i) => i.type.startsWith("image/")).map((i) => i.getAsFile());
      const items = await Promise.all(
        files.filter((f): f is File => !!f).map(async (f, i) => ({ name: `貼り付け ${new Date().toLocaleTimeString()}${i ? `-${i}` : ""}`, bytes: new Uint8Array(await f.arrayBuffer()) })),
      );
      if (items.length) addBytes(items);
      else if (e.clipboardData?.types.length) setMessage({ tone: "warn", text: "貼り付けたものが画像ではありませんでした。Win+Shift+S で画面を切り取ってから貼り付けてください。" });
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addBytes]);

  // ファイルのドラッグ&ドロップ(アプリの窓に落とす)
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    getCurrentWebview()
      .onDragDropEvent((e) => {
        if (e.payload.type === "enter" || e.payload.type === "over") setDragging(true);
        else if (e.payload.type === "leave") setDragging(false);
        else if (e.payload.type === "drop") {
          setDragging(false);
          addPaths(e.payload.paths);
        }
      })
      .then((f) => (unlisten = f));
    return () => unlisten?.();
  }, [addPaths]);

  // 表示用の URL は、確認画面でも使うので、この画面を閉じても片付けない
  const pickFiles = async () => {
    if (!isTauri()) return fileInput.current?.click();
    const picked = await open({ multiple: true, filters: [{ name: "画像", extensions: ["png", "jpg", "jpeg"] }] });
    if (picked) await addPaths(Array.isArray(picked) ? picked : [picked]);
  };

  const pickFolder = async () => {
    const dir = await open({ directory: true });
    if (!dir || Array.isArray(dir)) return;
    try {
      const paths = await listImagesInFolder(dir);
      if (!paths.length) setMessage({ tone: "warn", text: "そのフォルダには画像がありませんでした。" });
      else await addPaths(paths);
    } catch {
      setMessage({ tone: "error", text: "フォルダを開けませんでした。別のフォルダを選んでください。" });
    }
  };

  const move = (i: number, d: -1 | 1) =>
    setImages((list) => {
      const j = i + d;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const remove = (id: string) =>
    setImages((list) => {
      const target = list.find((x) => x.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return list.filter((x) => x.id !== id);
    });

  const readAll = async () => {
    setBusy(true);
    setMessage(null);
    const results: ImportedImage[] = images.map((i) => ({ ...i }));
    for (let i = 0; i < results.length; i++) {
      setProgress({ done: i, total: results.length });
      if (results[i].status === "done") continue;
      setImages((list) => list.map((x) => (x.id === results[i].id ? { ...x, status: "reading" } : x)));
      try {
        const analysis = await analyzeImage(results[i].bytes);
        results[i] = { ...results[i], analysis, status: analysis.panel ? "done" : "failed", error: analysis.panel ? undefined : "ウマ娘の詳細画面が見つかりませんでした" };
      } catch (e) {
        results[i] = { ...results[i], status: "failed", error: String(e) };
      }
      const r = results[i];
      setImages((list) => list.map((x) => (x.id === r.id ? r : x)));
    }
    setProgress(null);
    setBusy(false);

    const ok = results.filter((r) => r.analysis?.panel);
    if (!ok.length) {
      setMessage({
        tone: "error",
        text: "どの画像からもウマ娘の詳細画面を見つけられませんでした。殿堂入りウマ娘の「ウマ娘詳細」の画面を撮った画像か確かめてください。",
      });
      return;
    }
    onDone(buildDraft(ok.map((r) => r.analysis!), skills), results);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <h2 className="text-2xl font-bold">画面の画像から取り込む</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        ゲームで殿堂入りウマ娘の「ウマ娘詳細」を開き、スキル欄を少しずつスクロールしながら何枚か撮った画像を入れてください。
        <br />
        上から順に並べると、スキルの順番もそのとおりになります。ゲームの窓が大きいほど、正しく読み取れます。
      </p>

      <div
        className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 text-center ${
          dragging ? "border-sky-500 bg-sky-50 dark:bg-sky-950" : "border-slate-300 dark:border-slate-600"
        }`}
      >
        <p className="font-bold">ここに画像をドラッグ&ドロップ</p>
        <p className="text-sm text-slate-500">または Ctrl+V で貼り付け(Win+Shift+S で切り取った画像を続けて何枚でも)</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={pickFiles}>画像を選ぶ</Button>
          {isTauri() && <Button onClick={pickFolder}>フォルダの画像をまとめて読み込む</Button>}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = [...(e.target.files ?? [])];
            addBytes(await Promise.all(files.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }))));
            e.target.value = "";
          }}
        />
      </div>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {images.length > 0 && (
        <>
          <div className="flex items-center gap-3">
            <span className="font-bold">{images.length}枚</span>
            {progress && (
              <span className="text-sm">
                {progress.total}枚中 {progress.done + 1}枚目を読み取っています…
              </span>
            )}
            <div className="flex-1" />
            <Button
              disabled={busy}
              onClick={() => {
                images.forEach((i) => URL.revokeObjectURL(i.url));
                setImages([]);
                setMessage(null);
              }}
            >
              全部外す
            </Button>
            <Button variant="primary" disabled={busy} onClick={readAll}>
              {busy ? "画面から文字を読み取っています…" : "読み取って確認する →"}
            </Button>
          </div>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {images.map((img, i) => (
              <li key={img.id} className="overflow-hidden rounded border border-slate-200 dark:border-slate-700">
                <img src={img.url} alt={img.name} className="aspect-video w-full bg-slate-100 object-contain dark:bg-slate-800" />
                <div className="space-y-1 p-2 text-xs">
                  <div className="truncate" title={img.name}>
                    {i + 1}. {img.name}
                  </div>
                  <div>
                    {img.status === "waiting" && <span className="text-slate-500">まだ読み取っていません</span>}
                    {img.status === "reading" && <span className="text-sky-600">読み取っています…</span>}
                    {img.status === "done" && <span className="text-emerald-600">読み取りました</span>}
                    {img.status === "failed" && <span className="text-rose-600">{img.error ?? "読み取れませんでした"}</span>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" className="px-2 py-0.5" disabled={busy} onClick={() => move(i, -1)}>
                      ←
                    </Button>
                    <Button variant="ghost" className="px-2 py-0.5" disabled={busy} onClick={() => move(i, 1)}>
                      →
                    </Button>
                    <div className="flex-1" />
                    <Button variant="ghost" className="px-2 py-0.5 text-rose-600" disabled={busy} onClick={() => remove(img.id)}>
                      外す
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
