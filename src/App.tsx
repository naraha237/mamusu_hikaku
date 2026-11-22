import { useState } from "react";
import "./App.css";
import { UpdateBanner } from "./components/UpdateBanner";
import { SettingsProvider } from "./lib/settings";
import { SkillMasterProvider, useSkillMaster } from "./lib/skills/SkillMasterContext";
import { makeSampleUmas } from "./lib/uma/sampleData";
import { emptyUma, MAX_COMPARE, type UmaEntry } from "./lib/uma/types";
import { UmaProvider, useUmas } from "./lib/uma/UmaContext";
import { AboutPage } from "./pages/AboutPage";
import { ComparePage } from "./pages/ComparePage";
import { SettingsPage } from "./pages/SettingsPage";
import { UmaEditor } from "./pages/UmaEditor";
import { UmaListPage } from "./pages/UmaListPage";

type Page = "compare" | "list" | "settings" | "about";

const NAV: { page: Page; label: string }[] = [
  { page: "compare", label: "くらべる" },
  { page: "list", label: "ウマ娘一覧" },
  { page: "settings", label: "設定" },
  { page: "about", label: "このアプリについて" },
];

function Main() {
  const { umas, save } = useUmas();
  const { skills } = useSkillMaster();
  const [page, setPage] = useState<Page>("compare");
  const [editing, setEditing] = useState<UmaEntry | null>(null);
  /** 比べる人(並び順がそのまま列の順になる) */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
        <nav className="flex gap-1">
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
          <UmaEditor key={editing.id} initial={editing} onDone={() => setEditing(null)} />
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
                onEdit={(u) => setEditing(u)}
                onNew={() => setEditing(emptyUma())}
                onCompare={() => setPage("compare")}
                onAddSamples={addSamples}
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
        <UmaProvider>
          <Main />
        </UmaProvider>
      </SkillMasterProvider>
    </SettingsProvider>
  );
}

export default App;
