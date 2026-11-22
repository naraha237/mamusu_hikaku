import { useMemo, useRef, useState } from "react";
import { useSkillMaster } from "../lib/skills/SkillMasterContext";
import { searchSkills, SKILL_TYPE_LABEL } from "../lib/skills/search";
import type { MasterSkill } from "../lib/skills/types";
import { inputClass } from "./ui";

/** スキル名の入力欄(候補つき)。決定すると onPick が呼ばれる */
export function SkillInput({
  onPick,
  placeholder = "スキル名を入れて Enter(ひらがなでも探せます)",
}: {
  onPick: (picked: { name: string; skill?: MasterSkill }) => void;
  placeholder?: string;
}) {
  const { skills } = useSkillMaster();
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => searchSkills(skills, text), [skills, text]);

  const pick = (skill?: MasterSkill) => {
    const name = skill?.nameJa ?? text.trim();
    if (!name) return;
    onPick({ name, skill });
    setText("");
    setActive(0);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        className={`${inputClass} w-full`}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(hits[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && text && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded border border-slate-300 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
          {hits.map((s, i) => (
            <li
              key={s.id}
              className={`flex cursor-pointer items-center gap-2 px-2 py-1 ${
                i === active ? "bg-sky-100 dark:bg-sky-900" : ""
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="w-10 shrink-0 text-center text-xs text-slate-500 dark:text-slate-400">
                {SKILL_TYPE_LABEL[s.type]}
              </span>
              <span>{s.nameJa}</span>
              {s.nameEn && <span className="truncate text-xs text-slate-400">{s.nameEn}</span>}
            </li>
          ))}
          <li
            className="cursor-pointer border-t border-slate-200 px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-700"
            onMouseDown={(e) => {
              e.preventDefault();
              pick(undefined);
            }}
          >
            「{text.trim()}」を一覧にないスキルとして追加
          </li>
        </ul>
      )}
    </div>
  );
}
