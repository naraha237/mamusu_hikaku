import { useState } from "react";
import { createPortal } from "react-dom";
import { SKILL_TYPE_LABEL } from "../../lib/skills/search";
import type { MasterSkill, SkillType } from "../../lib/skills/types";
import { SkillIcon } from "../SkillIcon";
import { limitsText } from "../../lib/skills/limits";

export const TYPE_CHIP: Record<SkillType, string> = {
  unique: "bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-900 dark:text-fuchsia-50",
  rare: "bg-amber-200 text-amber-900 dark:bg-amber-700 dark:text-amber-50",
  evolved: "bg-orange-200 text-orange-900 dark:bg-orange-700 dark:text-orange-50",
  normal: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100",
  inherited: "bg-teal-100 text-teal-900 dark:bg-teal-900 dark:text-teal-50",
  other: "bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-100",
};

export function TypeChip({ type }: { type?: SkillType }) {
  if (!type) return <span className="inline-block w-9" />;
  return (
    <span className={`inline-block w-9 shrink-0 rounded px-1 text-center text-xs ${TYPE_CHIP[type]}`}>
      {SKILL_TYPE_LABEL[type]}
    </span>
  );
}

/** スキル名。カーソルを合わせると説明と必要SPを出す(表のスクロールで隠れないよう、画面の上に重ねて出す) */
export function SkillName({ name, type, master, compact, warning }: { name: string; type?: SkillType; master?: MasterSkill; /** 種類の札を出さない(狭い所用) */ compact?: boolean; /** 選んだイベントのコースで発動しない可能性があるとき、その理由 */ warning?: string }) {
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean } | null>(null);
  const hasInfo = !!master && (!!master.description || (master.sp ?? 0) > 0 || !!master.limits);

  return (
    <span
      className="inline-flex items-center gap-2"
      onMouseEnter={(e) => {
        if (!hasInfo) return;
        const r = e.currentTarget.getBoundingClientRect();
        const x = Math.min(r.left, window.innerWidth - 340);
        const above = r.bottom + 120 > window.innerHeight;
        setPos({ x, y: above ? r.top - 4 : r.bottom + 4, above });
      }}
      onMouseLeave={() => setPos(null)}
    >
      {!compact && <TypeChip type={type} />}
      <SkillIcon iconId={master?.iconId} size={compact ? 16 : 20} />
      <span className={hasInfo ? "cursor-help underline decoration-dotted underline-offset-4" : ""}>{name}</span>
      {!master && (
        <span className="rounded bg-amber-100 px-1 text-xs text-amber-900 dark:bg-amber-900 dark:text-amber-50">
          一覧にない
        </span>
      )}
      {warning && (
        <span className="cursor-help rounded bg-amber-200 px-1 text-xs font-bold text-amber-900 dark:bg-amber-700 dark:text-amber-50" title={warning}>
          ⚠{compact ? "" : " 発動しない可能性があります"}
        </span>
      )}
      {pos &&
        master &&
        createPortal(
          <span
            className="pointer-events-none fixed z-50 w-80 rounded bg-slate-900 p-2 text-xs text-white shadow-lg"
            style={{
              left: pos.x,
              top: pos.y,
              transform: pos.above ? "translateY(-100%)" : undefined,
            }}
          >
            <span className="mb-1 block font-bold">{master.nameJa}</span>
            {master.description && <span className="block">{master.description}</span>}
            {master.limits && <span className="mt-1 block text-sky-300">発動するのは:{limitsText(master.limits)}</span>}
            {(master.sp ?? 0) > 0 && <span className="mt-1 block text-amber-300">必要SP:{master.sp}</span>}
          </span>,
          document.body,
        )}
    </span>
  );
}
