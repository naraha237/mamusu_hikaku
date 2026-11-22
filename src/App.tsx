import { useState } from "react";
import "./App.css";
import { UpdateBanner } from "./components/UpdateBanner";
import { SkillMasterProvider } from "./lib/skills/SkillMasterContext";
import { AboutPage } from "./pages/AboutPage";
import { SettingsPage } from "./pages/SettingsPage";

type Page = "home" | "settings" | "about";

const NAV: { page: Page; label: string }[] = [
  { page: "home", label: "くらべる" },
  { page: "settings", label: "設定" },
  { page: "about", label: "このアプリについて" },
];

function App() {
  const [page, setPage] = useState<Page>("home");

  return (
    <SkillMasterProvider>
      <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <UpdateBanner />
        <header className="flex items-center gap-4 border-b border-slate-200 px-4 py-2 dark:border-slate-700">
          <h1 className="text-lg font-bold">ウマ娘 比較ノート</h1>
          <nav className="flex gap-1">
            {NAV.map((n) => (
              <button
                key={n.page}
                className={`rounded px-3 py-1 ${
                  page === n.page
                    ? "bg-sky-600 font-bold text-white"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                onClick={() => setPage(n.page)}
              >
                {n.label}
              </button>
            ))}
          </nav>
        </header>
        <main className="flex-1">
          {page === "home" && (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-slate-600 dark:text-slate-300">
              <p>くらべる画面は準備中です。</p>
            </div>
          )}
          {page === "settings" && <SettingsPage />}
          {page === "about" && <AboutPage />}
        </main>
      </div>
    </SkillMasterProvider>
  );
}

export default App;
