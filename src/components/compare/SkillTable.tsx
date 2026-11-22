import { useMemo, useState } from "react";
import { buildSkillRows, COLUMN_COLORS, isGold, type SkillRow } from "../../lib/compare";
import { useSkillMaster } from "../../lib/skills/SkillMasterContext";
import { SKILL_TYPE_LABEL } from "../../lib/skills/search";
import type { SkillType } from "../../lib/skills/types";
import { normalizeForSearch } from "../../lib/text";
import { umaLabel, type UmaEntry } from "../../lib/uma/types";
import { inputClass } from "../ui";
import { SkillName, TYPE_CHIP } from "./SkillName";

const FILTER_TYPES: SkillType[] = ["unique", "rare", "normal", "inherited", "evolved", "other"];

export function SkillTable({ umas }: { umas: UmaEntry[] }) {
  const { skills: master } = useSkillMaster();
  const [types, setTypes] = useState<Set<SkillType>>(new Set());
  const [query, setQuery] = useState("");
  const rows = useMemo(() => buildSkillRows(umas, master), [umas, master]);
  const n = umas.length;

  const filtered = useMemo(() => {
    const q = normalizeForSearch(query);
    return rows.filter((r) => {
      if (types.size && !(r.type && types.has(r.type))) return false;
      return !q || normalizeForSearch(r.name).includes(q) || normalizeForSearch(r.master?.nameEn ?? "").includes(q);
    });
  }, [rows, types, query]);

  const groups: { key: string; title: string; note?: string; rows: SkillRow[]; onlyOne?: boolean }[] =
    n === 1
      ? [{ key: "all", title: "スキル", rows: filtered }]
      : [
          { key: "only", title: "1人だけが持っているスキル", note: "その人だけの強みです", rows: filtered.filter((r) => r.count === 1), onlyOne: true },
          { key: "some", title: "一部の人が持っているスキル", rows: filtered.filter((r) => r.count > 1 && r.count < n) },
          { key: "all", title: "全員が持っているスキル", rows: filtered.filter((r) => r.count === n) },
        ];

  const toggleType = (t: SkillType) =>
    setTypes((s) => {
      const next = new Set(s);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} w-56`}
          placeholder="スキル名で探す"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="ml-2 text-sm text-slate-500">種類:</span>
        {FILTER_TYPES.map((t) => (
          <button
            key={t}
            className={`rounded-full border px-3 py-0.5 text-sm ${
              types.has(t) ? `${TYPE_CHIP[t]} border-transparent font-bold` : "border-slate-300 dark:border-slate-600"
            }`}
            onClick={() => toggleType(t)}
          >
            {SKILL_TYPE_LABEL[t]}
          </button>
        ))}
        {types.size > 0 && (
          <button className="text-sm text-sky-700 underline dark:text-sky-300" onClick={() => setTypes(new Set())}>
            すべて表示
          </button>
        )}
      </div>

      {/* 表の中だけをスクロールさせ、ウマ娘名の行(見出し)を上に固定する */}
      <div className="max-h-[calc(100vh-13rem)] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-20 bg-slate-50 shadow-sm dark:bg-slate-800">
            <tr>
              <th className="sticky left-0 z-30 min-w-64 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left font-normal text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                スキル
              </th>
              {umas.map((u, i) => {
                const gold = u.skills.filter((s) => {
                  const m = s.skillId ? master.find((x) => x.id === s.skillId) : undefined;
                  return isGold(m?.type ?? s.type);
                }).length;
                return (
                  <th
                    key={u.id}
                    className="min-w-28 border-b border-slate-200 bg-slate-50 px-3 py-2 text-center align-top dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span className={`h-3 w-3 rounded-full ${COLUMN_COLORS[i % COLUMN_COLORS.length].dot}`} />
                      <span className="font-bold">{umaLabel(u)}</span>
                    </div>
                    <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                      スキル {u.skills.length}個・<span className="text-amber-700 dark:text-amber-300">金 {gold}個</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <SkillGroup key={g.key} title={g.title} note={g.note} rows={g.rows} umas={umas} onlyOne={g.onlyOne} />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={n + 1} className="px-3 py-3 text-slate-500">
                  {rows.length === 0 ? "スキルが登録されていません。" : "条件に合うスキルがありません。"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SkillGroup({
  title,
  note,
  rows,
  umas,
  onlyOne,
}: {
  title: string;
  note?: string;
  rows: SkillRow[];
  umas: UmaEntry[];
  onlyOne?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <tr>
        <th
          colSpan={umas.length + 1}
          className={`sticky left-0 z-10 px-3 py-1 text-left font-bold ${
            onlyOne ? "bg-amber-100 dark:bg-amber-900" : "bg-slate-100 dark:bg-slate-700"
          }`}
        >
          {onlyOne && "★ "}
          {title}({rows.length})
          {note && <span className="ml-2 text-xs font-normal">{note}</span>}
        </th>
      </tr>
      {rows.map((r) => (
        <tr key={r.key}>
          <th className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-1 text-left font-normal dark:border-slate-800 dark:bg-slate-900">
            <SkillName name={r.name} type={r.type} master={r.master} />
          </th>
          {r.owned.map((s, i) => (
            <td
              key={umas[i].id}
              className={`border-b border-slate-100 px-3 py-1 text-center dark:border-slate-800 ${
                onlyOne && s ? COLUMN_COLORS[i % COLUMN_COLORS.length].soft : ""
              }`}
            >
              {s ? (
                <span aria-label="所持">
                  ●{s.level ? <span className="ml-1 text-xs">Lv{s.level}</span> : null}
                </span>
              ) : (
                <span className="text-slate-300 dark:text-slate-600" aria-label="なし">
                  ・
                </span>
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
