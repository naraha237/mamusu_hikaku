import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";
import { COLUMN_COLORS, extremes, formatDiff, heatLevel, isGold } from "../../lib/compare";
import {
  APTITUDE_ROWS,
  getAptitude,
  gradeValue,
  STAT_KEYS,
  STAT_LABEL,
  statTotal,
  umaLabel,
  type Grade,
  type UmaEntry,
} from "../../lib/uma/types";
import { useSkillMaster } from "../../lib/skills/SkillMasterContext";
import { GradeBadge } from "../ui";
import { Portrait } from "../SkillIcon";

const stickyHead =
  "sticky left-0 z-10 bg-slate-50 dark:bg-slate-800 text-left font-normal text-slate-600 dark:text-slate-300 whitespace-nowrap";

/** 最大・最小の印(色だけに頼らずアイコンも出す) */
function Mark({ kind }: { kind: "max" | "min" | null }) {
  if (kind === "max") return <span className="ml-1 text-emerald-600 dark:text-emerald-400" aria-label="最大">▲</span>;
  if (kind === "min") return <span className="ml-1 text-rose-600 dark:text-rose-400" aria-label="最小">▼</span>;
  return null;
}

const markClass = (kind: "max" | "min" | null) =>
  kind === "max" ? "font-bold text-emerald-700 dark:text-emerald-300" : kind === "min" ? "text-rose-700 dark:text-rose-300" : "";

function SortableHeader({ uma, index, children }: { uma: UmaEntry; index: number; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: uma.id });
  return (
    <th
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`w-44 min-w-44 border-b border-slate-200 px-3 py-2 text-left align-top dark:border-slate-700 ${
        isDragging ? "relative z-20 bg-white opacity-90 shadow-lg dark:bg-slate-800" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className="cursor-grab select-none text-slate-400 active:cursor-grabbing"
          title="ドラッグで並べ替え"
          {...attributes}
          {...listeners}
        >
          ⠿
        </span>
        <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${COLUMN_COLORS[index % COLUMN_COLORS.length].dot}`} />
        <Portrait png={uma.portrait} size={36} />
        <div className="min-w-0">{children}</div>
      </div>
    </th>
  );
}

export function StatTable({
  umas,
  onReorder,
  heatmap,
  baselineId,
  hideAtOrBelow,
}: {
  umas: UmaEntry[];
  onReorder: (ids: string[]) => void;
  heatmap: boolean;
  baselineId: string | null;
  /** 全員がこの評価以下の適性の行を隠す */
  hideAtOrBelow: Grade | "none";
}) {
  const aptitudeRows =
    hideAtOrBelow === "none"
      ? APTITUDE_ROWS
      : APTITUDE_ROWS.filter((r) =>
          umas.some((u) => gradeValue(getAptitude(u.aptitude, r.group, r.key)) > gradeValue(hideAtOrBelow)),
        );
  const hiddenAptitudes = APTITUDE_ROWS.length - aptitudeRows.length;
  const { skills: master } = useSkillMaster();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const baseline = umas.find((u) => u.id === baselineId) ?? null;
  const masterById = new Map(master.map((m) => [m.id, m]));

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = umas.map((u) => u.id);
    onReorder(arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))));
  };

  /** 数値の行(ステータス・合計・評価点) */
  const numberRow = (label: string, get: (u: UmaEntry) => number | undefined, opts: { heat?: boolean; bold?: boolean } = {}) => {
    const values = umas.map(get);
    const present = values.filter((v): v is number => v !== undefined);
    const ex = extremes(present);
    const base = baseline ? get(baseline) : undefined;
    return (
      <tr key={label} className="border-b border-slate-100 dark:border-slate-800">
        <th className={`${stickyHead} px-3 py-1.5 ${opts.bold ? "font-bold" : ""}`}>{label}</th>
        {umas.map((u, i) => {
          const v = values[i];
          const kind = v === undefined || !ex ? null : v === ex.max ? "max" : v === ex.min ? "min" : null;
          const level = opts.heat && heatmap && v !== undefined && present.length > 1 ? heatLevel(v, present) : null;
          return (
            <td
              key={u.id}
              className="px-3 py-1.5 text-right tabular-nums"
              style={level !== null ? { backgroundColor: `rgba(14, 165, 233, ${0.08 + level * 0.42})` } : undefined}
            >
              {v === undefined ? (
                <span className="text-slate-400">—</span>
              ) : (
                <>
                  <span className={`${markClass(kind)} ${opts.bold ? "font-bold" : ""}`}>{v.toLocaleString()}</span>
                  <Mark kind={kind} />
                  {baseline && base !== undefined && u.id !== baseline.id && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">{formatDiff(v - base)}</div>
                  )}
                </>
              )}
            </td>
          );
        })}
      </tr>
    );
  };

  const textRow = (label: string, get: (u: UmaEntry) => ReactNode) => (
    <tr key={label} className="border-b border-slate-100 dark:border-slate-800">
      <th className={`${stickyHead} px-3 py-1.5`}>{label}</th>
      {umas.map((u) => (
        <td key={u.id} className="px-3 py-1.5">
          {get(u) || <span className="text-slate-400">—</span>}
        </td>
      ))}
    </tr>
  );

  const section = (label: string) => (
    <tr key={`section-${label}`}>
      <th colSpan={umas.length + 1} className="sticky left-0 bg-slate-100 px-3 py-1 text-left text-sm font-bold dark:bg-slate-700">
        {label}
      </th>
    </tr>
  );

  return (
    <div className="w-fit max-w-full overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <table className="w-max border-collapse text-sm">
          <thead>
            <tr>
              <th className={`${stickyHead} border-b border-slate-200 px-3 py-2 dark:border-slate-700`}>項目</th>
              <SortableContext items={umas.map((u) => u.id)} strategy={horizontalListSortingStrategy}>
                {umas.map((u, i) => (
                  <SortableHeader key={u.id} uma={u} index={i}>
                    <div className="font-bold">{umaLabel(u)}</div>
                    {u.nickname && <div className="text-xs font-normal text-slate-500">{u.name}</div>}
                    {baselineId === u.id && (
                      <div className="text-xs font-normal text-sky-700 dark:text-sky-300">(基準)</div>
                    )}
                  </SortableHeader>
                ))}
              </SortableContext>
            </tr>
          </thead>
          <tbody>
            {section("基本情報")}
            {textRow("衣装・二つ名", (u) => u.outfit)}
            {textRow("使う予定", (u) => u.eventTag)}
            {textRow("評価ランク", (u) => u.rank && <span className="font-bold">{u.rank}</span>)}
            {numberRow("評価点", (u) => u.score)}

            {section("ステータス")}
            {STAT_KEYS.map((k) => numberRow(STAT_LABEL[k], (u) => u.stats[k], { heat: true }))}
            {numberRow("合計", (u) => statTotal(u.stats), { heat: true, bold: true })}

            {section("適性")}
            {aptitudeRows.map((r) => {
              const grades = umas.map((u) => getAptitude(u.aptitude, r.group, r.key));
              const ex = extremes(grades.map(gradeValue));
              return (
                <tr key={r.group + r.key} className="border-b border-slate-100 dark:border-slate-800">
                  <th className={`${stickyHead} px-3 py-1`}>
                    <span className="text-xs text-slate-400">{r.groupLabel}</span> {r.label}
                  </th>
                  {grades.map((g, i) => {
                    const v = gradeValue(g);
                    const kind = !ex ? null : v === ex.max ? "max" : v === ex.min ? "min" : null;
                    return (
                      <td key={umas[i].id} className="px-3 py-1">
                        <GradeBadge grade={g} className={kind === "max" ? "ring-2 ring-emerald-500" : ""} />
                        <Mark kind={kind} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {hiddenAptitudes > 0 && (
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td colSpan={umas.length + 1} className="sticky left-0 px-3 py-1 text-xs text-slate-500 dark:text-slate-400">
                  全員が {hideAtOrBelow === "G" ? "G" : `${hideAtOrBelow}以下`} の適性({hiddenAptitudes}つ)を隠しています。設定で変えられます。
                </td>
              </tr>
            )}

            {section("スキル")}
            {textRow("スキルの数", (u) => (
              <span>
                {u.skills.length}個
                <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">
                  金 {u.skills.filter((s) => isGold((s.skillId ? masterById.get(s.skillId)?.type : undefined) ?? s.type)).length}個
                </span>
              </span>
            ))}

            {section("因子")}
            {textRow(
              "因子",
              (u) =>
                (u.factors ?? []).length > 0 && (
                  <ul className="space-y-0.5">
                    {(u.factors ?? []).map((f, i) => (
                      <li key={i} className="whitespace-nowrap">
                        {f.name} <span className="text-amber-500">{"★".repeat(f.stars)}</span>
                      </li>
                    ))}
                  </ul>
                ),
            )}
          </tbody>
        </table>
      </DndContext>
    </div>
  );
}
