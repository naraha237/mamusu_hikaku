import { useEffect, useState } from "react";
import { applyImport, planImport, readPackage, type ImportChoice, type ImportItem, type PackageFile } from "../lib/share";
import { useSkillMaster } from "../lib/skills/SkillMasterContext";
import { useUmas } from "../lib/uma/UmaContext";
import { newId, umaLabel } from "../lib/uma/types";
import { Portrait } from "./SkillIcon";
import { Button, Notice } from "./ui";

const CHOICE_LABEL: Record<ImportChoice, string> = { overwrite: "上書きする", keepBoth: "両方残す", skip: "読み込まない" };

/** .umacmp を読み込む小窓(同じウマ娘がいるときは、どうするか選んでもらう) */
export function ImportPackageDialog({ path, onClose }: { path: string; onClose: (message?: string) => void }) {
  const { umas, save, sets, saveSet } = useUmas();
  const { userSkills, saveUserSkill } = useSkillMaster();
  const [pkg, setPkg] = useState<PackageFile | null>(null);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    readPackage(path)
      .then((p) => {
        setPkg(p);
        setItems(planImport(p, umas));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  const setChoice = (i: number, choice: ImportChoice) => setItems((list) => list.map((it, k) => (k === i ? { ...it, choice } : it)));
  const dupCount = items.filter((i) => i.duplicateOf).length;

  const run = async () => {
    if (!pkg) return;
    setBusy(true);
    try {
      const toSave = applyImport(items, newId);
      for (const u of toSave) await save(u);
      // バックアップから戻すときは、比較の組み合わせと自分で追加したスキルも戻す(同じものは足さない)
      if (pkg.kind === "backup") {
        for (const s of pkg.compareSets ?? []) if (!sets.some((x) => x.id === s.id)) await saveSet(s);
        for (const s of pkg.userSkills ?? []) if (!userSkills.some((x) => x.id === s.id)) await saveUserSkill(s);
      }
      onClose(`${toSave.length}人のウマ娘を読み込みました。`);
    } catch {
      setError("読み込みの途中で失敗しました。もう一度試してください。");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-lg bg-white p-5 shadow-xl dark:bg-slate-800">
        <h3 className="text-lg font-bold">{pkg?.kind === "backup" ? "バックアップから戻す" : "ファイルからウマ娘を読み込む"}</h3>
        <p className="truncate text-xs text-slate-500">{path}</p>
        {error && <Notice tone="error">{error}</Notice>}
        {pkg && (
          <>
            <p className="text-sm">
              {pkg.umas.length}人のウマ娘が入っています({new Date(pkg.exportedAt).toLocaleString()} に作られたファイル)。
              {dupCount > 0 && ` そのうち${dupCount}人は、同じウマ娘がすでに登録されています。どうするか選んでください。`}
            </p>
            {dupCount > 1 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                同じウマ娘を全部:
                {(Object.keys(CHOICE_LABEL) as ImportChoice[]).map((c) => (
                  <Button key={c} className="px-2 py-0.5 text-sm" onClick={() => setItems((l) => l.map((it) => (it.duplicateOf ? { ...it, choice: c } : it)))}>
                    {CHOICE_LABEL[c]}
                  </Button>
                ))}
              </div>
            )}
            <ul className="divide-y divide-slate-200 rounded border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
              {items.map((it, i) => (
                <li key={it.uma.id + i} className="flex flex-wrap items-center gap-2 px-2 py-1.5 text-sm">
                  <Portrait png={it.uma.portrait} size={32} />
                  <span className="min-w-0 flex-1">
                    <b>{umaLabel(it.uma)}</b>
                    <span className="ml-2 text-xs text-slate-500">
                      {it.uma.rank ?? ""} {it.uma.score?.toLocaleString() ?? ""}点
                    </span>
                    {it.duplicateOf && <span className="ml-2 rounded bg-amber-100 px-1 text-xs text-amber-900 dark:bg-amber-900 dark:text-amber-50">同じウマ娘がいます</span>}
                  </span>
                  {it.duplicateOf ? (
                    <select className="rounded border border-slate-300 bg-white px-1 py-0.5 dark:border-slate-600 dark:bg-slate-800" value={it.choice} onChange={(e) => setChoice(i, e.target.value as ImportChoice)}>
                      {(Object.keys(CHOICE_LABEL) as ImportChoice[]).map((c) => (
                        <option key={c} value={c}>
                          {CHOICE_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-emerald-700 dark:text-emerald-300">新しく追加</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={() => onClose()}>やめる</Button>
          <Button variant="primary" disabled={!pkg || busy} onClick={run}>
            {busy ? "読み込んでいます…" : "読み込む"}
          </Button>
        </div>
      </div>
    </div>
  );
}
