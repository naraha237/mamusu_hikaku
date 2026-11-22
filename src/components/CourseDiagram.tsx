// コースの形の図。
// 上:レース場の形のおおまかな絵(⊂=⊃)と回る向き。
// 下:スタートからゴールまでを横一本の帯にして、直線・コーナー・坂・フェーズの場所を示す。
import { courseTitle, PHASE_LABEL, type Course, type Track } from "../lib/courses/types";

/** レース場の形のおおまかな絵(楕円のトラックと、回る向きの矢印) */
function OvalIcon({ course }: { course: Course }) {
  if (course.direction === "straight") {
    return (
      <svg viewBox="0 0 120 50" className="h-12 w-28" aria-label="直線コース">
        <rect x="6" y="20" width="108" height="10" rx="2" className="fill-lime-200 stroke-lime-600 dark:fill-lime-900" />
        <path d="M 20 25 L 100 25" className="stroke-slate-600 dark:stroke-slate-300" strokeWidth="2" markerEnd="url(#arrow)" />
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" className="fill-slate-600 dark:fill-slate-300" />
          </marker>
        </defs>
      </svg>
    );
  }
  const clockwise = course.direction === "right";
  return (
    <svg viewBox="0 0 120 60" className="h-14 w-28" aria-label={clockwise ? "右回り" : "左回り"}>
      {/* ⊂=⊃ のような楕円のトラック */}
      <rect x="6" y="6" width="108" height="48" rx="24" className="fill-lime-100 stroke-lime-600 dark:fill-lime-950" strokeWidth="6" />
      <rect x="30" y="22" width="60" height="16" rx="8" className="fill-white dark:fill-slate-900" />
      {/* ゴール(正面の直線) */}
      <line x1="60" y1="48" x2="60" y2="58" className="stroke-rose-600" strokeWidth="2" />
      {/* 回る向き */}
      <path
        d={clockwise ? "M 40 54 L 24 54" : "M 80 54 L 96 54"}
        className="stroke-slate-700 dark:stroke-slate-200"
        strokeWidth="2.5"
        markerEnd="url(#arrow2)"
      />
      <defs>
        <marker id="arrow2" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" className="fill-slate-700 dark:fill-slate-200" />
        </marker>
      </defs>
      <text x="60" y="34" textAnchor="middle" className="fill-slate-500 text-[9px]">
        {clockwise ? "右回り" : "左回り"}
      </text>
    </svg>
  );
}

const pct = (m: number, L: number) => `${(m / L) * 100}%`;

/** スタートからゴールまでの帯 */
function Strip({ course }: { course: Course }) {
  const L = course.length;
  const lastCorner = [...course.corners].sort((a, b) => b.start - a.start)[0];
  const lastStraight = [...course.straights].sort((a, b) => b.start - a.start)[0];
  return (
    <div className="space-y-1 text-[10px]">
      {/* 直線とコーナー */}
      <div className="relative h-7 rounded bg-slate-200 dark:bg-slate-700">
        {course.straights.map((s, i) => (
          <div
            key={`s${i}`}
            className={`absolute inset-y-0 flex items-center justify-center overflow-hidden border-x border-white/40 ${
              s === lastStraight ? "bg-sky-400 text-white" : "bg-slate-300 text-slate-700 dark:bg-slate-600 dark:text-slate-200"
            }`}
            style={{ left: pct(s.start, L), width: pct(s.end - s.start, L) }}
            title={`${s === lastStraight ? "最終直線" : s.frontType === 1 ? "正面の直線" : "向正面の直線"} ${s.start}〜${s.end}m`}
          >
            {s === lastStraight ? "最終直線" : "直線"}
          </div>
        ))}
        {course.corners.map((c, i) => (
          <div
            key={`c${i}`}
            className={`absolute inset-y-0 flex items-center justify-center overflow-hidden border-x border-white/40 font-bold ${
              c === lastCorner ? "bg-orange-500 text-white" : "bg-amber-300 text-amber-900"
            }`}
            style={{ left: pct(c.start, L), width: pct(c.end - c.start, L) }}
            title={`${c === lastCorner ? "最終コーナー" : `第${c.number}コーナー`} ${c.start}〜${c.end}m`}
          >
            {c.number}
          </div>
        ))}
      </div>
      {/* 坂 */}
      <div className="relative h-4">
        {course.slopes.map((s, i) => (
          <div
            key={i}
            className={`absolute inset-y-0 flex items-center justify-center rounded ${s.slope > 0 ? "bg-emerald-200 text-emerald-900" : "bg-indigo-200 text-indigo-900"}`}
            style={{ left: pct(s.start, L), width: pct(Math.max(s.end - s.start, L * 0.02), L) }}
            title={`${s.slope > 0 ? "上り坂" : "下り坂"} ${s.start}〜${s.end}m`}
          >
            {s.slope > 0 ? "↗" : "↘"}
          </div>
        ))}
      </div>
      {/* フェーズ */}
      <div className="relative h-4">
        {course.phases.map((p) => (
          <div
            key={p.id}
            className="absolute inset-y-0 overflow-hidden border-l border-slate-400 pl-0.5 text-slate-500"
            style={{ left: pct(p.start, L), width: pct(p.end - p.start, L) }}
          >
            {PHASE_LABEL[p.id]}
          </div>
        ))}
      </div>
      {/* 目盛り */}
      <div className="relative h-4 text-slate-400">
        {[0, 25, 50, 75, 100].map((r) => (
          <span key={r} className="absolute -translate-x-1/2" style={{ left: `${r}%` }}>
            {r === 0 ? "スタート" : r === 100 ? "ゴール" : `${r}%`}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CourseDiagram({ track, course }: { track: Track; course: Course }) {
  const lastStraight = [...course.straights].sort((a, b) => b.start - a.start)[0];
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex flex-wrap items-center gap-3">
        <OvalIcon course={course} />
        <div className="text-sm">
          <div className="font-bold">{courseTitle(track, course)}</div>
          <div className="text-xs text-slate-500">
            コーナー {course.corners.length}回 ・ 最終直線 {lastStraight ? `${lastStraight.end - lastStraight.start}m` : "—"} ・ 坂{" "}
            {course.slopes.length ? `${course.slopes.filter((s) => s.slope > 0).length}か所(上り)・${course.slopes.filter((s) => s.slope < 0).length}か所(下り)` : "なし"}
            {course.length % 400 === 0 ? " ・ 根幹距離" : " ・ 非根幹距離"}
          </div>
        </div>
      </div>
      <Strip course={course} />
      <p className="text-[10px] text-slate-500">
        <span className="rounded bg-amber-300 px-1 text-amber-900">数字</span> コーナー(
        <span className="rounded bg-orange-500 px-1 text-white">最終コーナー</span>)・<span className="rounded bg-sky-400 px-1 text-white">最終直線</span>・↗ 上り坂 ・↘ 下り坂。
        項目にカーソルを合わせると、何m地点かが出ます。
      </p>
    </div>
  );
}
