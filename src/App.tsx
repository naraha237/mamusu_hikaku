import { useEffect, useState } from "react";
import "./App.css";
import { UpdateBanner } from "./components/UpdateBanner";
import { getAppInfo, type AppInfo } from "./lib/appInfo";

function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    getAppInfo().then(setInfo).catch(() => setInfo(null));
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <UpdateBanner />
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-3xl font-bold">ウマ娘 比較ノート</h1>
        <p className="text-slate-600 dark:text-slate-300">
          殿堂入りウマ娘を並べて比べるアプリです。いま準備中です。
        </p>
        {info && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            バージョン {info.version}({info.installed ? "インストール版" : "単体版"})
          </p>
        )}
      </main>
    </div>
  );
}

export default App;
