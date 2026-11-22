import { useState } from "react";
import { SkillDiffTwo } from "../components/compare/SkillDiffTwo";
import { SkillTable } from "../components/compare/SkillTable";
import { StatRadar } from "../components/compare/StatRadar";
import { StatTable } from "../components/compare/StatTable";
import { Button, ConfirmDialog, inputClass, Notice } from "../components/ui";
import { useSettings } from "../lib/settings";
import { useUmas } from "../lib/uma/UmaContext";
import { newId, umaLabel, type UmaEntry } from "../lib/uma/types";

type Tab = "table" | "skills" | "two";

export function ComparePage({
  umas,
  onReorder,
  onRemove,
  onLoadSet,
  onGoList,
}: {
  umas: UmaEntry[];
  onReorder: (ids: string[]) => void;
  onRemove: (id: string) => void;
  onLoadSet: (ids: string[]) => void;
  onGoList: () => void;
}) {
  const { settings, update } = useSettings();
  const { sets, saveSet, removeSet, umas: all } = useUmas();
  const [tab, setTab] = useState<Tab>("table");
  const [baselineId, setBaselineId] = useState<string | null>(null);
  const [setName, setSetName] = useState("");
  const [naming, setNaming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deletingSet, setDeletingSet] = useState<string | null>(null);
  const [pairA, setPairA] = useState<string | null>(null);
  const [pairB, setPairB] = useState<string | null>(null);

  const baseline = umas.some((u) => u.id === baselineId) ? baselineId : null;
  const a = umas.find((u) => u.id === pairA) ?? umas[0];
  const b = umas.find((u) => u.id === pairB && u.id !== a?.id) ?? umas.find((u) => u.id !== a?.id);

  const setSelect = (
    <div className="flex items-center gap-2">
      <select
        className={inputClass}
        value=""
        onChange={(e) => {
          const set = sets.find((s) => s.id === e.target.value);
          if (!set) return;
          const ids = set.umaIds.filter((id) => all.some((u) => u.id === id));
          onLoadSet(ids);
          setMessage(
            ids.length < set.umaIds.length
              ? `「${set.name}」を呼び出しました(消されたウマ娘 ${set.umaIds.length - ids.length}人は外しました)。`
              : `「${set.name}」を呼び出しました。`,
          );
        }}
      >
        <option value="">保存した組み合わせを呼び出す…</option>
        {sets.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}({s.umaIds.length}人)
          </option>
        ))}
      </select>
      {sets.length > 0 && (
        <select className={inputClass} value="" onChange={(e) => e.target.value && setDeletingSet(e.target.value)}>
          <option value="">組み合わせを消す…</option>
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  if (umas.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <h2 className="text-2xl font-bold">くらべる</h2>
        <Notice>比べるウマ娘がまだ選ばれていません。「ウマ娘一覧」でチェックを付けてください(5人まで)。</Notice>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={onGoList}>
            ウマ娘一覧へ
          </Button>
          {sets.length > 0 && setSelect}
        </div>
        {message && <Notice>{message}</Notice>}
      </div>
    );
  }

  const tabs: { key: Tab; label: string; disabled?: boolean }[] = [
    { key: "table", label: "ステータス・適性" },
    { key: "skills", label: "スキル" },
    { key: "two", label: "2人のスキルの差", disabled: umas.length < 2 },
  ];

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold">くらべる</h2>
        <span className="text-sm text-slate-500">{umas.length}人</span>
        <div className="flex-1" />
        {setSelect}
        {naming ? (
          <form
            className="flex items-center gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const name = setName.trim() || umas.map(umaLabel).join("・");
              await saveSet({ id: newId(), name, umaIds: umas.map((u) => u.id), updatedAt: new Date().toISOString() }).catch(() => {});
              setNaming(false);
              setSetName("");
              setMessage(`「${name}」として保存しました。`);
            }}
          >
            <input
              autoFocus
              className={inputClass}
              placeholder="組み合わせの名前"
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
            />
            <Button variant="primary" type="submit">
              保存
            </Button>
            <Button type="button" onClick={() => setNaming(false)}>
              やめる
            </Button>
          </form>
        ) : (
          <Button onClick={() => setNaming(true)}>この組み合わせを保存</Button>
        )}
      </div>
      {message && <Notice>{message}</Notice>}

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700">
        {tabs.map((t) => (
          <button
            key={t.key}
            disabled={t.disabled}
            title={t.disabled ? "2人以上選ぶと使えます" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 disabled:opacity-40 ${
              tab === t.key ? "border-sky-600 font-bold text-sky-700 dark:text-sky-300" : "border-transparent"
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "table" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-sky-600"
                checked={settings.heatmap}
                onChange={(e) => update({ heatmap: e.target.checked })}
              />
              ステータスの大きさを色の濃さで表示
            </label>
            <label className="flex items-center gap-2">
              基準にする人
              <select className={inputClass} value={baseline ?? ""} onChange={(e) => setBaselineId(e.target.value || null)}>
                <option value="">なし</option>
                {umas.map((u) => (
                  <option key={u.id} value={u.id}>
                    {umaLabel(u)}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-slate-500">
              <span className="text-emerald-600">▲</span>一番高い <span className="text-rose-600">▼</span>一番低い
              ・列の見出しの ⠿ をドラッグすると並べ替えられます
            </span>
            <div className="flex-1" />
            <label className="flex items-center gap-2">
              比べる人から外す
              <select className={inputClass} value="" onChange={(e) => e.target.value && onRemove(e.target.value)}>
                <option value="">選んでください</option>
                {umas.map((u) => (
                  <option key={u.id} value={u.id}>
                    {umaLabel(u)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <StatTable umas={umas} onReorder={onReorder} heatmap={settings.heatmap} baselineId={baseline} />
          <h3 className="text-lg font-bold">ステータスのグラフ</h3>
          <p className="text-sm text-slate-500">下の名前を押すと、その人の線を隠したり出したりできます。</p>
          <StatRadar umas={umas} />
        </div>
      )}

      {tab === "skills" && <SkillTable umas={umas} />}

      {tab === "two" && a && b && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select className={inputClass} value={a.id} onChange={(e) => setPairA(e.target.value)}>
              {umas.map((u) => (
                <option key={u.id} value={u.id}>
                  {umaLabel(u)}
                </option>
              ))}
            </select>
            と
            <select className={inputClass} value={b.id} onChange={(e) => setPairB(e.target.value)}>
              {umas
                .filter((u) => u.id !== a.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {umaLabel(u)}
                  </option>
                ))}
            </select>
            を比べる
          </div>
          <SkillDiffTwo a={a} b={b} colorA={umas.indexOf(a)} colorB={umas.indexOf(b)} />
        </div>
      )}

      {deletingSet && (
        <ConfirmDialog
          danger
          confirmLabel="消す"
          message={<p>保存した組み合わせ「{sets.find((s) => s.id === deletingSet)?.name}」を消しますか?(ウマ娘のデータは消えません)</p>}
          onCancel={() => setDeletingSet(null)}
          onConfirm={async () => {
            await removeSet(deletingSet).catch(() => {});
            setDeletingSet(null);
          }}
        />
      )}
    </div>
  );
}
