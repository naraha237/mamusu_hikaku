import { useMemo } from "react";
import { buildSkillRows, COLUMN_COLORS, type SkillRow } from "../../lib/compare";
import { useSkillMaster } from "../../lib/skills/SkillMasterContext";
import { umaLabel, type UmaEntry } from "../../lib/uma/types";
import { SkillName } from "./SkillName";

/** 2人のスキルを「Aだけ / 共通 / Bだけ」に分ける */
export function SkillDiffTwo({ a, b, colorA, colorB }: { a: UmaEntry; b: UmaEntry; colorA: number; colorB: number }) {
  const { skills: master } = useSkillMaster();
  const rows = useMemo(() => buildSkillRows([a, b], master), [a, b, master]);
  const onlyA = rows.filter((r) => r.owned[0] && !r.owned[1]);
  const both = rows.filter((r) => r.owned[0] && r.owned[1]);
  const onlyB = rows.filter((r) => !r.owned[0] && r.owned[1]);

  const column = (title: string, list: SkillRow[], color?: number) => (
    <div className="min-w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-700">
      <div
        className={`flex items-center gap-2 border-b border-slate-200 px-3 py-2 font-bold dark:border-slate-700 ${
          color !== undefined ? COLUMN_COLORS[color % COLUMN_COLORS.length].soft : "bg-slate-100 dark:bg-slate-700"
        }`}
      >
        {color !== undefined && <span className={`h-3 w-3 rounded-full ${COLUMN_COLORS[color % COLUMN_COLORS.length].dot}`} />}
        {title}({list.length})
      </div>
      <ul className="space-y-1 p-2 text-sm">
        {list.map((r) => (
          <li key={r.key}>
            <SkillName name={r.name} type={r.type} master={r.master} />
          </li>
        ))}
        {list.length === 0 && <li className="text-slate-400">なし</li>}
      </ul>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 md:flex-row">
      {column(`${umaLabel(a)}だけ`, onlyA, colorA)}
      {column("共通", both)}
      {column(`${umaLabel(b)}だけ`, onlyB, colorB)}
    </div>
  );
}
