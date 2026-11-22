import { isTauri } from "@tauri-apps/api/core";
import { emitTo } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useCallback, useEffect, useRef, useState } from "react";
import { getDefaultConfig, type DefaultConfig } from "../lib/appInfo";
import {
  captureThumbnail,
  findGameWindows,
  GUIDE_EVENT,
  onCaptureEvent,
  pickWindow,
  startCapture,
  stopCapture,
  type GameWindow,
  type GuideState,
} from "../lib/capture/api";
import { buildDraft, type Draft } from "../lib/ocr/buildDraft";
import { looksLikeNoise, normalizeForMatch, similarity } from "../lib/ocr/matchSkill";
import type { Analysis } from "../lib/ocr/types";
import { useSettings } from "../lib/settings";
import { useSkillMaster } from "../lib/skills/SkillMasterContext";
import { useUmaData } from "../lib/umaData/UmaDataContext";
import { Button, Notice } from "./ui";

type Phase =
  | { kind: "idle" }
  | { kind: "intro" }
  | { kind: "searching" }
  | { kind: "notFound" }
  | { kind: "choose"; windows: { w: GameWindow; thumb?: string }[] }
  | { kind: "confirm"; w: GameWindow; thumb?: string }
  | { kind: "running"; paused: boolean }
  /** スキルの数が一番下の段と合わない(読み落としがありそう) */
  | { kind: "parity"; lastRow: number; count: number };

type Frame = { analysis: Analysis; thumbJpeg: string };

/** 読み取ったスキルの行のうち、ちゃんとした文字のもの */
const lineTexts = (a: Analysis) =>
  a.skills
    .filter((s) => !s.partial && !/^lv\s*\d+$/i.test(s.text.trim()) && !looksLikeNoise(s.text))
    .map((s) => normalizeForMatch(s.text))
    .filter((t) => t.length >= 2);

/** 前の画像と今の画像で、同じスキルが1つも写っていない(スクロールが速すぎる)か */
function noOverlap(prev: Analysis, cur: Analysis): boolean {
  const a = lineTexts(prev);
  const b = lineTexts(cur);
  if (a.length < 2 || b.length < 2) return false;
  return !a.some((x) => b.some((y) => similarity(x, y) >= 0.75));
}

/** いちばん下に写っている段のスキルの数(1 か 2)。わからなければ null */
function bottomRowCount(a: Analysis): number | null {
  const lines = a.skills.filter((s) => !s.partial && !/^.?v\s*\d$/i.test(s.text.normalize("NFKC").trim()) && !looksLikeNoise(s.text));
  if (!lines.length) return null;
  const bottom = Math.max(...lines.map((s) => s.y));
  const row = lines.filter((s) => bottom - s.y < 0.03);
  return new Set(row.map((s) => s.column)).size;
}

const GUIDE_LABEL = "guide";

async function openGuide() {
  if (!isTauri() || (await WebviewWindow.getByLabel(GUIDE_LABEL))) return;
  new WebviewWindow(GUIDE_LABEL, {
    url: "index.html?view=guide",
    title: "取り込みの案内",
    width: 340,
    height: 230,
    resizable: false,
    alwaysOnTop: true,
    focus: false,
    minimizable: false,
  });
}

async function closeGuide() {
  if (!isTauri()) return;
  (await WebviewWindow.getByLabel(GUIDE_LABEL))?.close();
}

/** ゲームの画面を取り込む(取り込み開始〜停止まで) */
export function LiveCapture({
  hotkeyTick,
  onDone,
}: {
  /** ホットキーが押されるたびに増える数 */
  hotkeyTick: number;
  onDone: (draft: Draft, images: { url: string; name: string }[]) => void;
}) {
  const { settings, update } = useSettings();
  const { skills } = useSkillMaster();
  const umaData = useUmaData();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [message, setMessage] = useState<{ tone: "info" | "warn" | "error"; text: string } | null>(null);
  const [found, setFound] = useState<string[]>([]);
  const [frameCount, setFrameCount] = useState(0);
  const [tooFast, setTooFast] = useState(false);
  const frames = useRef<Frame[]>([]);
  const lastHwnd = useRef<number | null>(null);
  const config = useRef<DefaultConfig | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    getDefaultConfig()
      .then((c) => (config.current = c))
      .catch(() => {});
  }, []);

  const sendGuide = useCallback((s: GuideState) => {
    if (isTauri()) emitTo(GUIDE_LABEL, GUIDE_EVENT, s).catch(() => {});
  }, []);

  /** 確認画面へ進む */
  const complete = useCallback(() => {
    const list = frames.current;
    const draft = buildDraft(
      list.map((f) => f.analysis),
      skills,
      umaData,
      { voting: true },
    );
    // 確認画面で見る画像は、多すぎないように間引く(最大12枚)
    const step = Math.max(1, Math.ceil(list.length / 12));
    const images = list
      .filter((_, i) => i % step === 0 || i === list.length - 1)
      .map((f, i) => ({ url: `data:image/jpeg;base64,${f.thumbJpeg}`, name: `取り込み ${i + 1}` }));
    setPhase({ kind: "idle" });
    onDone(draft, images);
  }, [onDone, skills, umaData]);

  const finish = useCallback(
    (reason: string, errorText?: string) => {
      closeGuide();
      setPhase({ kind: "idle" });
      const list = frames.current;
      if (reason === "error") {
        setMessage({ tone: "error", text: `取り込みが止まりました。もう一度「取り込み開始」を押してください。(${errorText ?? ""})` });
        return;
      }
      if (!list.length) {
        setMessage({
          tone: "warn",
          text:
            reason === "closed"
              ? "ゲームが閉じられたため、取り込みを止めました。"
              : "ウマ娘の詳細画面が写っていませんでした。ゲームで殿堂入りウマ娘の「ウマ娘詳細」を開いてから、もう一度押してください。",
        });
        return;
      }
      if (reason === "closed") {
        setMessage({ tone: "info", text: "ゲームが閉じられたため、そこまでの内容で確認画面を開きました。" });
        complete();
        return;
      }
      // スキルの数が、一番下の段の数(1つなら奇数・2つなら偶数)と合っているか確かめる
      const lastRow = bottomRowCount(list[list.length - 1].analysis);
      const count = buildDraft(
        list.map((f) => f.analysis),
        skills,
        undefined,
        { voting: true },
      ).skills.length;
      if (lastRow && count % 2 !== lastRow % 2) {
        setPhase({ kind: "parity", lastRow, count });
        return;
      }
      complete();
    },
    [complete, skills],
  );

  // 取り込みの知らせを受け取る
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    onCaptureEvent((e) => {
      if (phaseRef.current.kind !== "running") return;
      if (e.kind === "frame") {
        const prev = frames.current[frames.current.length - 1];
        frames.current = [...frames.current, { analysis: e.analysis, thumbJpeg: e.thumbJpeg }];
        const fast = prev ? noOverlap(prev.analysis, e.analysis) : false;
        setTooFast(fast);
        const draft = buildDraft(
          frames.current.map((f) => f.analysis),
          skills,
          undefined,
          { voting: true },
        );
        const names = draft.skills.map((s) => s.name);
        setFound(names);
        setFrameCount(frames.current.length);
        sendGuide({ status: "running", found: names.length, tooFast: fast });
      } else if (e.kind === "paused") {
        setPhase({ kind: "running", paused: true });
        sendGuide({ status: "paused", found: 0, tooFast: false, message: "ゲームが最小化されています" });
      } else if (e.kind === "resumed") {
        setPhase({ kind: "running", paused: false });
      } else if (e.kind === "stopped") {
        sendGuide({ status: "stopped", found: 0, tooFast: false });
        finish(e.reason, e.message);
      }
    }).then((f) => (unlisten = f));
    return () => unlisten?.();
  }, [finish, sendGuide, skills]);

  const run = async (hwnd: number | null, keepFrames = false) => {
    lastHwnd.current = hwnd;
    if (!keepFrames) {
      frames.current = [];
      setFound([]);
      setFrameCount(0);
    }
    setTooFast(false);
    setMessage(null);
    const c = config.current?.capture;
    try {
      await startCapture(hwnd, c?.framesPerSecond ?? 3, c?.autoStopSeconds ?? 5);
      setPhase({ kind: "running", paused: false });
      openGuide();
    } catch (e) {
      setPhase({ kind: "idle" });
      setMessage({ tone: "error", text: `取り込みを始められませんでした。ゲームが最小化されていないか確かめてください。(${String(e)})` });
    }
  };

  const begin = async (introSeen = false) => {
    setMessage(null);
    if (!settings.captureIntroShown && !introSeen) {
      setPhase({ kind: "intro" });
      return;
    }
    setPhase({ kind: "searching" });
    const remembered = settings.rememberedWindow;
    const base = settings.windowCandidates?.length ? settings.windowCandidates : (config.current?.gameWindow.candidates ?? []);
    const candidates = remembered ? [remembered, ...base] : base;
    const windows = await findGameWindows(candidates).catch(() => []);
    if (!windows.length) {
      setPhase({ kind: "notFound" });
      return;
    }
    // 前に「合っている」と答えたウィンドウがあれば、確認なしで始める
    const known = remembered && windows.find((w) => w.title === remembered.title && w.className === remembered.className);
    if (known) return run(known.hwnd);
    if (windows.length === 1) {
      setPhase({ kind: "confirm", w: windows[0] });
      const thumb = await captureThumbnail(windows[0].hwnd).catch(() => undefined);
      setPhase((p) => (p.kind === "confirm" ? { ...p, thumb } : p));
      return;
    }
    setPhase({ kind: "choose", windows: windows.map((w) => ({ w })) });
    const thumbs = await Promise.all(windows.map((w) => captureThumbnail(w.hwnd).catch(() => undefined)));
    setPhase((p) => (p.kind === "choose" ? { kind: "choose", windows: windows.map((w, i) => ({ w, thumb: thumbs[i] })) } : p));
  };

  const accept = (w: GameWindow) => {
    update({ rememberedWindow: { title: w.title, className: w.className } });
    run(w.hwnd);
  };

  const pickByMyself = async () => {
    const name = await pickWindow().catch(() => null);
    if (name) run(null);
  };

  // ホットキーで開始・停止
  const firstTick = useRef(hotkeyTick);
  useEffect(() => {
    if (hotkeyTick === firstTick.current) return;
    if (phaseRef.current.kind === "running") stopCapture();
    else if (phaseRef.current.kind === "idle") begin();
  }, [hotkeyTick]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isTauri()) {
    return <Notice>ゲームの画面からの取り込みは、アプリ(exe)の中でだけ使えます。</Notice>;
  }

  const running = phase.kind === "running";
  const hotkey = settings.captureHotkey || config.current?.capture.hotkey || "Ctrl+Alt+U";

  return (
    <section className={`space-y-3 rounded-lg border-2 p-4 ${running ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-bold">ゲームの画面から取り込む</h3>
        {running && (
          <span className="animate-pulse rounded bg-rose-600 px-2 py-0.5 text-sm font-bold text-white">
            {phase.paused ? "一時停止中" : "● 取り込み中"}
          </span>
        )}
        <div className="flex-1" />
        {running ? (
          <Button variant="danger" onClick={() => stopCapture()}>
            停止
          </Button>
        ) : (
          <Button variant="primary" disabled={phase.kind === "searching"} onClick={() => begin()}>
            {phase.kind === "searching" ? "ゲームの画面を探しています…" : "取り込み開始"}
          </Button>
        )}
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        ゲームで殿堂入りウマ娘の「ウマ娘詳細」を開いてから押してください。取り込み中は、スキル欄を自分の手でゆっくりスクロールします。
        画面が{config.current?.capture.autoStopSeconds ?? 5}秒間変わらないと、自動で止まります。キーボードの {hotkey} でも開始・停止できます。
      </p>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {phase.kind === "intro" && (
        <div className="space-y-2 rounded bg-sky-50 p-3 dark:bg-sky-950">
          <p className="font-bold">はじめに</p>
          <p className="text-sm">
            このアプリはゲームの画面を見るだけで、ゲームを操作することはありません。取り込み中は、Windows がゲームの窓のまわりに黄色い枠を表示します。
            取り込んだ画面はこの PC の中だけで使い、確認が終わったら捨てます。
          </p>
          <Button
            variant="primary"
            onClick={() => {
              update({ captureIntroShown: true });
              begin(true);
            }}
          >
            わかりました
          </Button>
        </div>
      )}

      {phase.kind === "parity" && (
        <div className="space-y-2 rounded bg-amber-50 p-3 dark:bg-amber-950">
          <p className="font-bold">スキルを読み落としているかもしれません</p>
          <p className="text-sm">
            いちばん下の段のスキルが{phase.lastRow}個なので、スキルの数は{phase.lastRow === 1 ? "奇数" : "偶数"}のはずですが、
            {phase.count}個見つかりました。スキル欄をいちばん上に戻してから、もう一度ゆっくり下までスクロールすると、読み取りを足して精度を上げます。
          </p>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => run(lastHwnd.current, true)}>
              もう一度スクロールする
            </Button>
            <Button onClick={complete}>このまま確認画面へ</Button>
          </div>
        </div>
      )}

      {phase.kind === "notFound" && (
        <div className="space-y-2">
          <Notice tone="warn">ウマ娘の画面が見つかりません。ゲームを起動してから、もう一度押してください。</Notice>
          <div className="flex gap-2">
            <Button onClick={() => begin()}>もう一度探す</Button>
            <Button onClick={pickByMyself}>自分で選ぶ</Button>
            <Button variant="ghost" onClick={() => setPhase({ kind: "idle" })}>
              やめる
            </Button>
          </div>
        </div>
      )}

      {phase.kind === "confirm" && (
        <div className="space-y-2">
          <p className="font-bold">このウィンドウで合っていますか?</p>
          {phase.thumb ? (
            <img src={`data:image/png;base64,${phase.thumb}`} alt="" className="max-w-md rounded border border-slate-300 dark:border-slate-600" />
          ) : (
            <p className="text-sm text-slate-500">画面を確認しています…</p>
          )}
          <p className="text-sm text-slate-500">{phase.w.title}</p>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => accept(phase.w)}>
              はい(次からは確認しません)
            </Button>
            <Button onClick={pickByMyself}>違う(自分で選ぶ)</Button>
          </div>
        </div>
      )}

      {phase.kind === "choose" && (
        <div className="space-y-2">
          <p className="font-bold">ウマ娘の画面が複数見つかりました。取り込むものを選んでください。</p>
          <div className="flex flex-wrap gap-3">
            {phase.windows.map(({ w, thumb }) => (
              <button key={w.hwnd} className="w-60 space-y-1 rounded border border-slate-300 p-2 text-left hover:border-sky-500 dark:border-slate-600" onClick={() => accept(w)}>
                {thumb ? <img src={`data:image/png;base64,${thumb}`} alt="" className="w-full" /> : <div className="aspect-video bg-slate-100 dark:bg-slate-800" />}
                <div className="truncate text-xs">{w.title}</div>
              </button>
            ))}
          </div>
          <Button onClick={pickByMyself}>この中にない(自分で選ぶ)</Button>
        </div>
      )}

      {running && (
        <div className="space-y-2">
          {phase.paused && <Notice tone="warn">ゲームが最小化されているので、一時停止しています。ゲームの画面を元に戻すと続きから取り込みます。</Notice>}
          {tooFast && <Notice tone="warn">少しゆっくりスクロールしてください。</Notice>}
          <p className="text-sm">
            <span className="text-2xl font-bold">{found.length}</span> 個のスキルが見つかりました
            <span className="ml-2 text-slate-500">(読み取った画面 {frameCount}枚)</span>
          </p>
          <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
            {found.map((n, i) => (
              <span key={n + i} className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                {n}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
