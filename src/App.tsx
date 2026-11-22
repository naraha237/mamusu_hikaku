import { useState } from "react";
import "./App.css";
import { UpdateBanner } from "./components/UpdateBanner";
import type { ReviewSkill } from "./lib/ocr/buildDraft";
import { SettingsProvider } from "./lib/settings";
import { SkillMasterProvider, useSkillMaster } from "./lib/skills/SkillMasterContext";
import { makeSampleUmas } from "./lib/uma/sampleData";
import { emptyUma, MAX_COMPARE, type UmaEntry } from "./lib/uma/types";
import { UmaProvider, useUmas } from "./lib/uma/UmaContext";
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
                onNew={() => setEditing({ uma: emptyUma(), after: "list" })}
                onCompare={() => setPage("compare")}
                onAddSamples={addSamples}
              />
            )}
            {page === "import" && (
              <ImportPage
                onDone={(draft, images) =>
                  setEditing({
                    uma: draft.uma,
                    skills: draft.skills,
                    review: {
                      fields: draft.fields,
                      images: images.filter((i) => i.status === "done").map((i) => ({ url: i.url, name: i.name })),
                    },
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
        <UmaProvider>
          <Main />
        </UmaProvider>
      </SkillMasterProvider>
    </SettingsProvider>
  );
}

export default App;
