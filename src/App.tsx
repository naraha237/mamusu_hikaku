import { isTauri } from "@tauri-apps/api/core";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { useEffect, useState } from "react";
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
import { AboutPage } from "./pages/AboutPage";
import { ComparePage } from "./pages/ComparePage";
import { ImportPage } from "./pages/ImportPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UmaEditor, type EditorReview } from "./pages/UmaEditor";
import { UmaListPage } from "./pages/UmaListPage";

type Page = "compare" | "list" | "import" | "settings" | "about";

const NAV: { page: Page; label: string }[] = [
  { page: "compare", label: "くらべる" },
  { page: "list", label: "ウマ娘一覧" },
  { page: "import", label: "画像から取り込む" },
  { page: "settings", label: "設定" },
  { page: "about", label: "このアプリについて" },
];

type Editing = { uma: UmaEntry; skills?: ReviewSkill[]; review?: EditorReview; after: Page };

function Main() {
  const { umas, save } = useUmas();
  const { skills } = useSkillMaster();
  const [page, setPage] = useState<Page>("compare");
  const [editing, setEditing] = useState<Editing | null>(null);
  /** 比べる人(並び順がそのまま列の順になる) */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { settings } = useSettings();
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

  const selected = selectedIds.map((id) => umas.find((u) => u.id === id)).filter((u): u is UmaEntry => !!u);

  const toggle = (id: string) =>
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= MAX_COMPARE ? ids : [...ids, id]));

  const addSamples = async () => {
    const samples = makeSampleUmas(skills);
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
                onReorder={setSelectedIds}
                onRemove={(id) => setSelectedIds((ids) => ids.filter((x) => x !== id))}
                onLoadSet={(ids) => setSelectedIds(ids.slice(0, MAX_COMPARE))}
                onGoList={() => setPage("list")}
              />
            )}
            {page === "list" && (
              <UmaListPage
                selectedIds={selectedIds}
                onToggleSelect={toggle}
                onEdit={(u) => setEditing({ uma: u, after: "list" })}
                onNew={() => setPage("import")}
                onCompare={() => setPage("compare")}
                onAddSamples={addSamples}
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
            {page === "settings" && <SettingsPage />}
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
          <UmaProvider>
            <Main />
          </UmaProvider>
        </UmaDataProvider>
      </SkillMasterProvider>
    </SettingsProvider>
  );
}

export default App;
