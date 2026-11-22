import { useMemo, useState } from "react";
import { Portrait } from "../components/SkillIcon";
import { Button, ConfirmDialog, GradeBadge, inputClass, Notice } from "../components/ui";
import { normalizeForSearch } from "../lib/text";
import { useUmas } from "../lib/uma/UmaContext";
import { MAX_COMPARE, statTotal, type UmaEntry } from "../lib/uma/types";

export function UmaListPage({
  selectedIds,
  onToggleSelect,
  onEdit,
  onNew,
  onCompare,
  onAddSamples,
}: {
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onEdit: (uma: UmaEntry) => void;
  onNew: () => void;
  onCompare: () => void;
  onAddSamples: () => void;
}) {
  const { umas, loaded, error, remove } = useUmas();
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<UmaEntry | null>(null);
  const [limitMsg, setLimitMsg] = useState(false);

  const shown = useMemo(() => {
    const q = normalizeForSearch(query);
    return umas.filter((u) => {
      if (!q) return true;
      const text = normalizeForSearch([u.name, u.outfit, u.nickname, ...(u.tags ?? [])].filter(Boolean).join(" "));
      return text.includes(q);
    });
  }, [umas, query]);

  const toggle = (id: string) => {
    if (!selectedIds.includes(id) && selectedIds.length >= MAX_COMPARE) {
      setLimitMsg(true);
      return;
    }
    setLimitMsg(false);
    onToggleSelect(id);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold">ウマ娘一覧</h2>
        <span className="text-sm text-slate-500">{umas.length}人</span>
        <div className="flex-1" />
        <Button variant="primary" onClick={onNew}>
          ＋ 画像から取り込む
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${inputClass} w-64`}
          placeholder="名前・メモ名・タグで探す"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex-1" />
        <span className="text-sm">
          比べる人:{selectedIds.length} / {MAX_COMPARE}
        </span>
        <Button variant="primary" disabled={selectedIds.length === 0} onClick={onCompare}>
          くらべる →
        </Button>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {limitMsg && <Notice tone="warn">比べられるのは {MAX_COMPARE}人までです。ほかの人のチェックを外してから選んでください。</Notice>}

      {loaded && umas.length === 0 && (
        <div className="space-y-2">
          <Notice>まだウマ娘が登録されていません。「画像から取り込む」から入れてください。</Notice>
          <Button onClick={onAddSamples}>お試し用のウマ娘を5人入れてみる</Button>
        </div>
      )}

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
        {shown.map((u) => {
          const checked = selectedIds.includes(u.id);
          return (
            <li key={u.id} className={`flex items-center gap-3 px-3 py-2 ${checked ? "bg-sky-50 dark:bg-sky-950" : ""}`}>
              <input
                type="checkbox"
                className="h-5 w-5 accent-sky-600"
                checked={checked}
                onChange={() => toggle(u.id)}
                aria-label={`${u.name} を比べる`}
              />
              <Portrait png={u.portrait} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-bold">{u.name}</span>
                  {u.outfit && <span className="text-sm text-slate-500">[{u.outfit}]</span>}
                  {u.nickname && <span className="text-sm">「{u.nickname}」</span>}
                  {(u.tags ?? []).map((t) => (
                    <span key={t} className="rounded bg-sky-100 px-1.5 text-xs text-sky-900 dark:bg-sky-900 dark:text-sky-50">
                      #{t}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                  {u.rank && <span>{u.rank}</span>}
                  {u.score !== undefined && <span>{u.score.toLocaleString()}点</span>}
                  <span>合計 {statTotal(u.stats)}</span>
                  <span>スキル {u.skills.length}個</span>
                  <span className="flex items-center gap-1">
                    芝<GradeBadge grade={u.aptitude.surface.turf} className="h-5 w-5 text-xs" />
                    ダ<GradeBadge grade={u.aptitude.surface.dirt} className="h-5 w-5 text-xs" />
                  </span>
                </div>
              </div>
              <Button onClick={() => onEdit(u)}>直す</Button>
              <Button variant="ghost" className="text-rose-600" onClick={() => setDeleting(u)}>
                消す
              </Button>
            </li>
          );
        })}
        {loaded && umas.length > 0 && shown.length === 0 && (
          <li className="p-3 text-sm text-slate-500">条件に合うウマ娘がいません。</li>
        )}
      </ul>

      {deleting && (
        <ConfirmDialog
          danger
          confirmLabel="消す"
          message={
            <>
              <p className="font-bold">「{deleting.nickname || deleting.name}」を消しますか?</p>
              <p className="text-sm">消したウマ娘は元に戻せません。</p>
            </>
          }
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            const id = deleting.id;
            setDeleting(null);
            await remove(id).catch(() => {});
            if (selectedIds.includes(id)) onToggleSelect(id);
          }}
        />
      )}
    </div>
  );
}
