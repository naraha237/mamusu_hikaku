import { useMemo, useState } from "react";
import { Portrait } from "../components/SkillIcon";
import { Button, ConfirmDialog, GradeBadge, inputClass, Notice } from "../components/ui";
import { useEvents } from "../lib/events/EventsContext";
import { endedEventTags } from "../lib/events/ended";
import { normalizeForSearch } from "../lib/text";
import { useUmas } from "../lib/uma/UmaContext";
import { allTags, MAX_COMPARE, statTotal, type UmaEntry } from "../lib/uma/types";

/** まとめて消すときの確認 */
type BulkDelete = { title: string; ids: string[] };

export function UmaListPage({
  selectedIds,
  onToggleSelect,
  onUnselect,
  onEdit,
  onNew,
  onCompare,
  onAddSamples,
  onExportSelected,
  onImportFile,
}: {
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  /** 消したウマ娘のチェックを外す */
  onUnselect: (ids: string[]) => void;
  onEdit: (uma: UmaEntry) => void;
  onNew: () => void;
  onCompare: () => void;
  onAddSamples: () => void;
  /** チェックしたウマ娘をファイルに書き出す(家族に渡す用) */
  onExportSelected: () => void;
  /** .umacmp を選んで読み込む */
  onImportFile: () => void;
}) {
  const { umas, loaded, error, remove } = useUmas();
  const { events } = useEvents();
  const [query, setQuery] = useState("");
  /** イベントのタグで絞り込む(空ならすべて) */
  const [eventFilter, setEventFilter] = useState("");
  const [deleting, setDeleting] = useState<UmaEntry | null>(null);
  const [bulk, setBulk] = useState<BulkDelete | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const eventTags = useMemo(() => [...new Set(umas.map((u) => u.eventTag).filter((t): t is string => !!t))], [umas]);
  // 終わったイベント用のウマ娘(終わった日の次の日から)
  const ended = useMemo(() => endedEventTags(events).filter((t) => umas.some((u) => u.eventTag === t)), [events, umas]);

  const shown = useMemo(() => {
    const q = normalizeForSearch(query);
    return umas.filter((u) => {
      if (eventFilter && u.eventTag !== eventFilter) return false;
      if (!q) return true;
      return normalizeForSearch([u.name, u.outfit, u.nickname, ...allTags(u)].filter(Boolean).join(" ")).includes(q);
    });
  }, [umas, query, eventFilter]);

  // 比べるのは、チェックした中で新しい順に5人まで
  const comparing = selectedIds.slice(-MAX_COMPARE);

  const removeMany = async (ids: string[]) => {
    for (const id of ids) await remove(id).catch(() => {});
    onUnselect(ids);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold">ウマ娘一覧</h2>
        <span className="text-sm text-slate-500">{umas.length}人</span>
        <div className="flex-1" />
        <Button onClick={onImportFile}>ファイルから読み込む</Button>
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
        <label className="flex items-center gap-2 text-sm">
          使う予定
          <select className={inputClass} value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
            <option value="">すべて</option>
            {eventTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {ended.map((t) => (
          <Button
            key={t}
            variant="ghost"
            className="text-sm text-rose-600"
            onClick={() => setBulk({ title: `終わったイベント「${t}」用のウマ娘`, ids: umas.filter((u) => u.eventTag === t).map((u) => u.id) })}
          >
            「{t}」用のウマ娘を消す
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
        <span>
          チェック:{selectedIds.length}人
          {selectedIds.length > MAX_COMPARE && <span className="ml-1 text-slate-500">(くらべるには新しくチェックした{MAX_COMPARE}人を出します)</span>}
        </span>
        <div className="flex-1" />
        {selectedIds.length > 0 && (
          <>
            <Button variant="ghost" className="px-2 py-0.5 text-sm" onClick={() => onUnselect(selectedIds)}>
              チェックを全部外す
            </Button>
            <Button
              variant="ghost"
              className="px-2 py-0.5 text-sm text-rose-600"
              onClick={() => setBulk({ title: "チェックしたウマ娘", ids: selectedIds })}
            >
              チェックしたウマ娘を消す
            </Button>
          </>
        )}
        <Button disabled={selectedIds.length === 0} onClick={onExportSelected} title="チェックしたウマ娘を、家族に渡すファイルにします">
          チェックしたウマ娘を書き出す
        </Button>
        <Button variant="primary" disabled={selectedIds.length === 0} onClick={onCompare}>
          くらべる →
        </Button>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice>{message}</Notice>}

      {loaded && umas.length === 0 && (
        <div className="space-y-2">
          <Notice>まだウマ娘が登録されていません。「画像から取り込む」から入れてください。</Notice>
          <Button onClick={onAddSamples}>お試し用のウマ娘を3人入れてみる</Button>
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
                onChange={() => onToggleSelect(u.id)}
                aria-label={`${u.name} をチェック`}
              />
              <Portrait png={u.portrait} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-bold">{u.name}</span>
                  {u.outfit && <span className="text-sm text-slate-500">[{u.outfit}]</span>}
                  {u.nickname && <span className="text-sm">「{u.nickname}」</span>}
                  {comparing.includes(u.id) && (
                    <span className="rounded bg-sky-600 px-1.5 text-xs text-white">くらべる</span>
                  )}
                  {u.eventTag && (
                    <span className="rounded bg-rose-100 px-1.5 text-xs text-rose-900 dark:bg-rose-900 dark:text-rose-50">{u.eventTag}</span>
                  )}
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
        {loaded && umas.length > 0 && shown.length === 0 && <li className="p-3 text-sm text-slate-500">条件に合うウマ娘がいません。</li>}
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
            await removeMany([id]);
          }}
        />
      )}
      {bulk && (
        <ConfirmDialog
          danger
          confirmLabel={`${bulk.ids.length}人を消す`}
          message={
            <>
              <p className="font-bold">
                {bulk.title}({bulk.ids.length}人)を消しますか?
              </p>
              <p className="text-sm">消したウマ娘は元に戻せません(自動バックアップからは戻せます)。</p>
            </>
          }
          onCancel={() => setBulk(null)}
          onConfirm={async () => {
            const { ids } = bulk;
            setBulk(null);
            await removeMany(ids);
            setMessage(`${ids.length}人のウマ娘を消しました。`);
          }}
        />
      )}
    </div>
  );
}
