import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

/** つまんで並べ替えられる項目(≡ の部分をつまむ) */
export function SortableItem({ id, className, children }: { id: string; className?: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <span
      className="cursor-grab touch-none select-none px-1 text-lg leading-none text-slate-400 hover:text-slate-600 active:cursor-grabbing dark:hover:text-slate-200"
      title="つまんで並べ替え"
      {...attributes}
      {...listeners}
    >
      ≡
    </span>
  );
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`${className ?? ""} ${isDragging ? "relative z-20 opacity-80 shadow-lg" : ""}`}
    >
      {children(handle)}
    </li>
  );
}
