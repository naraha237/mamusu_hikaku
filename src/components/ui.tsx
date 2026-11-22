import type { ButtonHTMLAttributes, ReactNode } from "react";
import { type Grade } from "../lib/uma/types";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT: Record<Variant, string> = {
  primary: "bg-sky-600 text-white font-bold hover:bg-sky-700",
  secondary:
    "border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700",
  danger: "bg-rose-600 text-white font-bold hover:bg-rose-700",
  ghost: "hover:bg-slate-100 dark:hover:bg-slate-800",
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`rounded px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${className}`}
      {...props}
    />
  );
}

/** 適性のバッジ(S/A=緑、B/C=黄、D以下=灰) */
export function GradeBadge({ grade, className = "" }: { grade: Grade; className?: string }) {
  const color =
    grade === "S" || grade === "A"
      ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-100 dark:border-emerald-700"
      : grade === "B" || grade === "C"
        ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900 dark:text-amber-100 dark:border-amber-700"
        : "bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600";
  return (
    <span className={`inline-flex h-7 w-7 items-center justify-center rounded border font-bold ${color} ${className}`}>
      {grade}
    </span>
  );
}

/** 確認の小窓 */
export function ConfirmDialog({
  message,
  confirmLabel,
  cancelLabel = "やめる",
  danger,
  onConfirm,
  onCancel,
}: {
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md space-y-4 rounded-lg bg-white p-5 shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div>{message}</div>
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** 下に一時的に出すお知らせ */
export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "error" }) {
  const cls =
    tone === "error"
      ? "bg-rose-100 text-rose-900 dark:bg-rose-900 dark:text-rose-50"
      : tone === "warn"
        ? "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-50"
        : "bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-50";
  return <p className={`rounded p-2 text-sm ${cls}`}>{children}</p>;
}

export const inputClass =
  "rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500";
