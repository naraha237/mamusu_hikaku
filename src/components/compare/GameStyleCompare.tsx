import { useMemo, useState } from "react";
import { EMPTY_LIMIT_FILTER, matchesLimits, type LimitFilter } from "../../lib/skills/limits";
import { LimitFilterBar } from "./LimitFilterBar";
import { buildSkillRows, COLUMN_COLORS, extremes, rowKeyOf, skillKey } from "../../lib/compare";
import { useSkillMaster } from "../../lib/skills/SkillMasterContext";
import { getAptitude, gradeValue, STAT_KEYS, STAT_LABEL, statTotal, umaLabel, type Aptitude, type UmaEntry } from "../../lib/uma/types";
import { Portrait } from "../SkillIcon";
import { GradeBadge } from "../ui";
import { SkillName } from "./SkillName";

/** ゲームの詳細画面と同じ並び(ステータスの横一列・適性の3段・スキルの2列)で、横に並べて比べる */

const APT_LAYOUT: { label: string; group: keyof Aptitude; keys: { key: string; label: string }[] }[] = [
  { label: "バ場適性", group: "surface", keys: [{ key: "turf", label: "芝" }, { key: "dirt", label: "ダート" }] },
  {
    label: "距離適性",
    group: "distance",
    keys: [
      { key: "sprint", label: "短距離" },
      { key: "mile", label: "マイル" },
      { key: "medium", label: "中距離" },
      { key: "long", label: "長距離" },
    ],
  },
  {
    label: "脚質適性",
    group: "style",
    keys: [
      { key: "front", label: "逃げ" },
      { key: "pace", label: "先行" },
      { key: "late", label: "差し" },
      { key: "end", label: "追込" },
    ],
  },
];

function Mark({ kind }: { kind: "max" | "min" | null }) {
  if (kind === "max") return <span className="text-emerald-600 dark:text-emerald-400">▲</span>;
  if (kind === "min") return <span className="text-rose-600 dark:text-rose-400">▼</span>;
  return null;
}

const kindOf = (v: number, ex: { max: number; min: number } | null) => (!ex ? null : v === ex.max ? "max" : v === ex.min ? "min" : null);

export function GameStyleCompare({ umas, hideAtOrBelow }: { umas: UmaEntry[]; hideAtOrBelow: "none" | "G" | "F" | "E" | "D" }) {
  const { skills: master } = useSkillMaster();
  const rows = useMemo(() => buildSkillRows(umas, master), [umas, master]);
  const countByKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);
  const masterById = useMemo(() => new Map(master.map((m) => [m.id, m])), [master]);
  const [limitFilter, setLimitFilter] = useState<LimitFilter>(EMPTY_LIMIT_FILTER);

  const statEx = STAT_KEYS.map((k) => extremes(umas.map((u) => u.stats[k])));
  const totalEx = extremes(umas.map((u) => statTotal(u.stats)));
  const scoreEx = extremes(umas.map((u) => u.score).filter((s): s is number => s !== undefined));
  const aptEx = (group: keyof Aptitude, key: string) => extremes(umas.map((u) => gradeValue(getAptitude(u.aptitude, group, key))));
  const hidden = (group: keyof Aptitude, key: string) =>
    hideAtOrBelow !== "none" && umas.every((u) => gradeValue(getAptitude(u.aptitude, group, key)) <= gradeValue(hideAtOrBelow));

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500">
        <span className="text-emerald-600">▲</span>一番高い <span className="text-rose-600">▼</span>一番低い ・スキルの <b>★</b>
        は、比べている中でその人だけが持っているスキルです。
      </p>
      <LimitFilterBar value={limitFilter} onChange={setLimitFilter} />
      <div className="flex gap-3 overflow-x-auto pb-2">
        {umas.map((u, col) => {
          const color = COLUMN_COLORS[col % COLUMN_COLORS.length];
          return (
            <div key={u.id} className="w-[26rem] shrink-0 overflow-hidden rounded-xl border-2 border-lime-500 bg-white shadow dark:bg-slate-900">
              {/* 見出し(ゲームの緑の帯) */}
              <div className="flex items-center gap-2 bg-lime-500 px-3 py-1 text-white">
                <span className={`h-3 w-3 rounded-full ring-2 ring-white ${color.dot}`} />
                <span className="truncate font-bold">{umaLabel(u)}</span>
              </div>
              {/* 名前・二つ名・ランク */}
              <div className="flex items-center gap-3 px-3 py-2">
                <Portrait png={u.portrait} size={56} />
                <div className="min-w-0 flex-1">
                  {u.outfit && <div className="truncate text-xs text-slate-500">[{u.outfit}]</div>}
                  <div className="truncate font-bold">{u.name}</div>
                  {u.eventTag && (
                    <span className="rounded bg-rose-100 px-1 text-[10px] text-rose-900 dark:bg-rose-900 dark:text-rose-50">{u.eventTag}</span>
                  )}
                  <div className="text-sm">
                    <b className="mr-2">{u.rank ?? "—"}</b>
                    {u.score?.toLocaleString() ?? "—"}
                    {u.score !== undefined && <Mark kind={kindOf(u.score, scoreEx)} />}
                  </div>
                </div>
              </div>
              {/* ステータス(横一列) */}
              <div className="mx-2 grid grid-cols-5 overflow-hidden rounded border border-lime-500 text-center">
                {STAT_KEYS.map((k, i) => {
                  const kind = kindOf(u.stats[k], statEx[i]);
                  return (
                    <div key={k} className="border-r border-lime-200 last:border-r-0 dark:border-lime-900">
                      <div className="bg-lime-500 text-[11px] font-bold text-white">{STAT_LABEL[k]}</div>
                      <div
                        className={`py-1 text-sm tabular-nums ${
                          kind === "max" ? "font-bold text-emerald-700 dark:text-emerald-300" : kind === "min" ? "text-rose-700 dark:text-rose-300" : ""
                        }`}
                      >
                        {u.stats[k]}
                        <Mark kind={kind} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mx-2 mt-1 text-right text-xs">
                合計 <b>{statTotal(u.stats)}</b>
                <Mark kind={kindOf(statTotal(u.stats), totalEx)} />
              </div>
              {/* 適性(3段) */}
              <div className="space-y-1 px-2 py-2">
                {APT_LAYOUT.map((row) => (
                  <div key={row.group} className="flex items-center gap-1">
                    <span className="w-12 shrink-0 whitespace-nowrap text-[10px] font-bold">{row.label}</span>
                    <div className="grid flex-1 grid-cols-4 gap-1">
                      {row.keys.map((c) => {
                        if (hidden(row.group, c.key)) return <span key={c.key} />;
                        const g = getAptitude(u.aptitude, row.group, c.key);
                        const kind = kindOf(gradeValue(g), aptEx(row.group, c.key));
                        return (
                          <span key={c.key} className="flex items-center justify-between gap-0.5 whitespace-nowrap rounded border border-slate-200 px-1 text-[10px] dark:border-slate-700">
                            {c.label}
                            <span className="flex items-center">
                              <GradeBadge grade={g} className="h-5 w-5 text-xs" />
                              <Mark kind={kind} />
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {/* スキル(2列) */}
              <div className="bg-lime-500 px-3 text-center text-xs font-bold text-white">スキル({u.skills.length}個)</div>
              <ul className="grid grid-cols-2 gap-1 p-2">
                {u.skills.map((s, i) => {
                  const own = s.skillId ? masterById.get(s.skillId) : undefined;
                  const row = countByKey.get(rowKeyOf(s, masterById));
                  if (!matchesLimits(own ?? row?.master, limitFilter)) return null;
                  const onlyMe = umas.length > 1 && row?.count === 1;
                  return (
                    <li
                      key={skillKey(s) + i}
                      className={`flex min-w-0 items-center gap-0.5 overflow-hidden whitespace-nowrap rounded border px-1 py-0.5 text-[11px] ${
                        onlyMe ? `${color.soft} border-transparent font-bold` : "border-slate-200 dark:border-slate-700"
                      }`}
                      title={s.name}
                    >
                      {onlyMe && "★"}
                      <SkillName compact name={own?.nameJa ?? s.name} type={own?.type ?? s.type} master={own} />
                      {s.level ? <span className="ml-1">Lv{s.level}</span> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
