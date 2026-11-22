import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { ImportPackageDialog } from "./components/ImportPackageDialog";
import { OnboardingDialog } from "./components/OnboardingDialog";
import { HelpPage } from "./pages/HelpPage";
import { buildPackage, exportPackage, pickPackageFile, shareFileName } from "./lib/share";
import { autoBackupIfDue, fullPackage } from "./lib/backup";
import { ConfirmDialog } from "./components/ui";
import { useEvents } from "./lib/events/EventsContext";
import { endedEventTags } from "./lib/events/ended";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { useEffect, useRef, useState } from "react";
import "./App.css";
import { getDefaultConfig } from "./lib/appInfo";
import { UpdateBanner } from "./components/UpdateBanner";
import type { ReviewSkill } from "./lib/ocr/buildDraft";
import { SettingsProvider, useSettings } from "./lib/settings";
import { SkillMasterProvider, useSkillMaster } from "./lib/skills/SkillMasterContext";
import { makeSampleUmas } from "./lib/uma/sampleData";
import { emptyUma, MAX_COMPARE, type UmaEntry } from "./lib/uma/types";
import { UmaProvider, useUmas } from "./lib/uma/UmaContext";
import { UmaDataProvider } from "./lib/umaData/UmaDataContext";
import { EventsProvider } from "./lib/events/EventsContext";
import { EventsPage } from "./pages/EventsPage";
import { AboutPage } from "./pages/AboutPage";
import { ComparePage } from "./pages/ComparePage";
import { ImportPage } from "./pages/ImportPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UmaEditor, type EditorReview } from "./pages/UmaEditor";
import { UmaListPage } from "./pages/UmaListPage";

type Page = "compare" | "events" | "list" | "import" | "settings" | "help" | "about";

const NAV: { page: Page; label: string }[] = [
  { page: "compare", label: "くらべる" },
  { page: "events", label: "イベント" },
  { page: "list", label: "ウマ娘一覧" },
  { page: "import", label: "画像から取り込む" },
  { page: "settings", label: "設定" },
  { page: "help", label: "ヘルプ" },
  { page: "about", label: "このアプリについて" },
];

type Editing = { uma: UmaEntry; skills?: ReviewSkill[]; review?: EditorReview; after: Page };

function Main() {
  const { umas, save, remove, loaded, sets } = useUmas();
  const { skills, userSkills } = useSkillMaster();
  const [page, setPage] = useState<Page>("compare");
  const [editing, setEditing] = useState<Editing | null>(null);
  /** 比べる人(並び順がそのまま列の順になる) */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { settings, update, ready } = useSettings();
  const [showOnboarding, setShowOnboarding] = useState(false);
  // 初めて起動したときだけ、はじめの案内を出す
  useEffect(() => {
    if (ready && !settings.onboardingDone) setShowOnboarding(true);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const finishOnboarding = () => {
    setShowOnboarding(false);
    update({ onboardingDone: true });
  };
  const [hotkeyTick, setHotkeyTick] = useState(0);

  // 取り込みの開始・停止のキー(OS にキーを登録して受け取るだけ。ゲームにキーを送ることはない)
  useEffect(() => {
    if (!isTauri()) return;
    let key: string | null = null;
    let cancelled = false;
    (async () => {
      const config = await getDefaultConfig().catch(() => null);
      key = settings.captureHotkey || config?.capture.hotkey || "Ctrl+Alt+U";
      try {
        await register(key, (e) => {
          if (e.state !== "Pressed") return;
          setEditing(null);
          setPage("import");
          setHotkeyTick((t) => t + 1);
        });
        if (cancelled) await unregister(key);
      } catch {
        key = null; // ほかのアプリが同じキーを使っているときなど
      }
    })();
    return () => {
      cancelled = true;
      if (key) unregister(key).catch(() => {});
    };
  }, [settings.captureHotkey]);

  // .umacmp(共有・バックアップのファイル)を読み込む
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!isTauri()) return;
    const isPkg = (p: string) => p.toLowerCase().endsWith(".umacmp");
    // ダブルクリックで起動したとき
    invoke<string | null>("take_open_file")
      .then((p) => p && setOpeningPath(p))
      .catch(() => {});
    // アプリが開いているときにダブルクリックしたとき
    const unOpen = listen<string>("open-file", (e) => setOpeningPath(e.payload));
    // アプリの窓にドラッグ&ドロップしたとき(どの画面でも)
    const unDrop = getCurrentWebview().onDragDropEvent((e) => {
      if (e.payload.type === "drop") {
        const pkg = e.payload.paths.find(isPkg);
        if (pkg) setOpeningPath(pkg);
      }
    });
    return () => {
      unOpen.then((f) => f());
      unDrop.then((f) => f());
    };
  }, []);

  // 週に1回、自動でバックアップを作る(起動して、データを読み込んだあと1回だけ)
  const backupChecked = useRef(false);
  useEffect(() => {
    if (!isTauri() || !loaded || backupChecked.current) return;
    backupChecked.current = true;
    autoBackupIfDue(() => fullPackage(umas, sets, userSkills, settings)).catch(() => {});
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // 比べるのは、チェックした中で新しい順に5人まで
  const compareIds = selectedIds.slice(-MAX_COMPARE);
  const selected = compareIds.map((id) => umas.find((u) => u.id === id)).filter((u): u is UmaEntry => !!u);
  // 書き出すのは、チェックした全員
  const checked = selectedIds.map((id) => umas.find((u) => u.id === id)).filter((u): u is UmaEntry => !!u);

  // 終わったイベント用のウマ娘を消すか、起動したときに1回だけ聞く
  const { events } = useEvents();
  const [endedAsk, setEndedAsk] = useState<{ tag: string; ids: string[] } | null>(null);
  useEffect(() => {
    if (!ready || !loaded || endedAsk) return;
    const handled = settings.handledEndedEvents ?? [];
    const tag = endedEventTags(events).find((t) => !handled.includes(t) && umas.some((u) => u.eventTag === t));
    if (tag) setEndedAsk({ tag, ids: umas.filter((u) => u.eventTag === tag).map((u) => u.id) });
  }, [ready, loaded, events, settings.handledEndedEvents]); // eslint-disable-line react-hooks/exhaustive-deps
  const closeEndedAsk = () => {
    if (endedAsk) update({ handledEndedEvents: [...(settings.handledEndedEvents ?? []), endedAsk.tag] });
    setEndedAsk(null);
  };

  const toggle = (id: string) =>
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const addSamples = async () => {
    // お試しモード:サンプルのウマ娘3人を入れて、くらべる画面を開く
    const samples = makeSampleUmas(skills).slice(0, 3);
    for (const s of samples) await save(s).catch(() => {});
    setSelectedIds(samples.slice(0, MAX_COMPARE).map((s) => s.id));
    setPage("compare");
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <UpdateBanner />
      <header className="flex items-center gap-4 border-b border-slate-200 px-4 py-2 dark:border-slate-700">
        <h1 className="text-lg font-bold">ウマ娘 比較ノート</h1>
        <nav className="flex flex-wrap gap-1">
          {NAV.map((n) => (
            <button
              key={n.page}
              className={`rounded px-3 py-1 ${
                page === n.page && !editing ? "bg-sky-600 font-bold text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              onClick={() => {
                setEditing(null);
                setPage(n.page);
              }}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </header>
      {toast && (
        <div className="flex items-center gap-2 bg-emerald-100 px-4 py-2 text-sm text-emerald-900 dark:bg-emerald-900 dark:text-emerald-50">
          <span className="flex-1">{toast}</span>
          <button className="hover:underline" onClick={() => setToast(null)}>
            閉じる
          </button>
        </div>
      )}
      {endedAsk && !showOnboarding && (
        <ConfirmDialog
          danger
          confirmLabel={`人を消す`}
          message={
            <>
              <p className="font-bold">「{endedAsk.tag}」が終わりました。</p>
              <p className="text-sm">
                このイベント用のウマ娘({endedAsk.ids.length}人)を消しますか?あとからでも「ウマ娘一覧」の
                「「{endedAsk.tag}」用のウマ娘を消す」で消せます。
              </p>
            </>
          }
          cancelLabel="消さない"
          onCancel={closeEndedAsk}
          onConfirm={async () => {
            const { ids } = endedAsk;
            closeEndedAsk();
            for (const id of ids) await remove(id).catch(() => {});
            setSelectedIds((prev) => prev.filter((x) => !ids.includes(x)));
            setToast(`人のウマ娘を消しました。`);
          }}
        />
      )}
      {showOnboarding && (
        <OnboardingDialog
          onFinish={finishOnboarding}
          onTrySamples={() => {
            finishOnboarding();
            addSamples();
          }}
        />
      )}
      {openingPath && (
        <ImportPackageDialog
          path={openingPath}
          onClose={(msg) => {
            setOpeningPath(null);
            if (msg) {
              setToast(msg);
              setEditing(null);
              setPage("list");
            }
          }}
        />
      )}
      <main className="min-w-0 flex-1">
        {editing ? (
          <UmaEditor
            key={editing.uma.id}
            initial={editing.uma}
            initialSkills={editing.skills}
            review={editing.review}
            onDone={() => {
              setPage(editing.after);
              setEditing(null);
            }}
          />
        ) : (
          <>
            {page === "compare" && (
              <ComparePage
                umas={selected}
                onReorder={(ids) => setSelectedIds((prev) => [...prev.filter((x) => !ids.includes(x)), ...ids])}
                onRemove={(id) => setSelectedIds((ids) => ids.filter((x) => x !== id))}
                onLoadSet={(ids) => setSelectedIds(ids.slice(0, MAX_COMPARE))}
                onGoList={() => setPage("list")}
              />
            )}
            {page === "list" && (
              <UmaListPage
                selectedIds={selectedIds}
                onToggleSelect={toggle}
                onUnselect={(ids) => setSelectedIds((prev) => prev.filter((x) => !ids.includes(x)))}
                onEdit={(u) => setEditing({ uma: u, after: "list" })}
                onNew={() => setPage("import")}
                onCompare={() => setPage("compare")}
                onAddSamples={addSamples}
                onExportSelected={async () => {
                  try {
                    if (await exportPackage(buildPackage("share", checked), shareFileName(checked)))
                      setToast(`人のウマ娘をファイルに書き出しました。家族に渡して、アプリにドラッグ&ドロップしてもらってください。`);
                  } catch {
                    setToast("書き出せませんでした。保存先を変えてもう一度試してください。");
                  }
                }}
                onImportFile={async () => {
                  const p = await pickPackageFile().catch(() => null);
                  if (p) setOpeningPath(p);
                }}
              />
            )}
            {page === "import" && (
              <ImportPage
                hotkeyTick={hotkeyTick}
                onManual={() => setEditing({ uma: emptyUma(), after: "list" })}
                onDone={(draft, images) =>
                  setEditing({
                    uma: draft.uma,
                    skills: draft.skills,
                    review: { fields: draft.fields, images },
                    after: "list",
                  })
                }
              />
            )}
            {page === "events" && (
              <EventsPage
                onCompare={(ids) => {
                  setSelectedIds(ids.slice(0, MAX_COMPARE));
                  setPage("compare");
                }}
              />
            )}
            {page === "settings" && <SettingsPage onOpenPackage={setOpeningPath} />}
            {page === "help" && <HelpPage onShowOnboarding={() => setShowOnboarding(true)} onTrySamples={addSamples} />}
            {page === "about" && <AboutPage />}
          </>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <SettingsProvider>
      <SkillMasterProvider>
        <UmaDataProvider>
          <EventsProvider>
            <UmaProvider>
              <Main />
            </UmaProvider>
          </EventsProvider>
        </UmaDataProvider>
      </SkillMasterProvider>
    </SettingsProvider>
  );
}

export default App;
