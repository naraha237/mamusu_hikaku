import { useEvents } from "../../lib/events/EventsContext";
import { upcomingEvents } from "../../lib/events/labels";
import { DISTANCE_LABEL, STYLE_LABEL, SURFACE_LABEL, type LimitFilter } from "../../lib/skills/limits";

/** 脚質・距離・バ場で、スキルを絞り込むボタンの列 */
export function LimitFilterBar({ value, onChange }: { value: LimitFilter; onChange: (f: LimitFilter) => void }) {
  const chip = <K extends string>(axis: "style" | "distance" | "surface", key: K, label: string) => {
    const list = value[axis] as K[];
    const on = list.includes(key);
    return (
      <button
        key={key}
        className={`rounded-full border px-2.5 py-0.5 text-sm ${
          on ? "border-transparent bg-sky-600 font-bold text-white" : "border-slate-300 dark:border-slate-600"
        }`}
        onClick={() => onChange({ ...value, [axis]: on ? list.filter((k) => k !== key) : [...list, key] })}
      >
        {label}
      </button>
    );
  };
  const any = value.style.length + value.distance.length + value.surface.length > 0;
  // イベントを選ぶと、そのコースの距離・バ場で絞り込む(合わない条件のスキルを外す)
  const { events } = useEvents();
  const options = upcomingEvents(events).filter((o) => o.event.course?.distance || o.event.course?.surface);
  const current = options.find(
    (o) =>
      JSON.stringify(value.distance) === JSON.stringify(o.event.course?.distance ? [o.event.course.distance] : []) &&
      JSON.stringify(value.surface) === JSON.stringify(o.event.course?.surface ? [o.event.course.surface] : []),
  );
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {options.length > 0 && (
        <label className="flex items-center gap-1 text-sm">
          <span className="text-slate-500">イベント:</span>
          <select
            className="rounded border border-slate-300 bg-white px-1 py-0.5 dark:border-slate-600 dark:bg-slate-800"
            value={current?.label ?? ""}
            onChange={(e) => {
              const o = options.find((x) => x.label === e.target.value);
              onChange({
                ...value,
                distance: o?.event.course?.distance ? [o.event.course.distance] : [],
                surface: o?.event.course?.surface ? [o.event.course.surface] : [],
              });
            }}
          >
            <option value="">選ばない</option>
            {options.map((o) => (
              <option key={o.label} value={o.label}>
                {o.label}({[o.event.course?.surface && SURFACE_LABEL[o.event.course.surface], o.event.course?.distance && DISTANCE_LABEL[o.event.course.distance]].filter(Boolean).join("・")})
              </option>
            ))}
          </select>
        </label>
      )}
      <span className="flex flex-wrap items-center gap-1">
        <span className="text-sm text-slate-500">脚質:</span>
        {(Object.keys(STYLE_LABEL) as (keyof typeof STYLE_LABEL)[]).map((k) => chip("style", k, STYLE_LABEL[k]))}
      </span>
      <span className="flex flex-wrap items-center gap-1">
        <span className="text-sm text-slate-500">距離:</span>
        {(Object.keys(DISTANCE_LABEL) as (keyof typeof DISTANCE_LABEL)[]).map((k) => chip("distance", k, DISTANCE_LABEL[k]))}
      </span>
      <span className="flex flex-wrap items-center gap-1">
        <span className="text-sm text-slate-500">バ場:</span>
        {(Object.keys(SURFACE_LABEL) as (keyof typeof SURFACE_LABEL)[]).map((k) => chip("surface", k, SURFACE_LABEL[k]))}
      </span>
      {any && (
        <>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              className="accent-sky-600"
              checked={value.includeGeneral}
              onChange={(e) => onChange({ ...value, includeGeneral: e.target.checked })}
            />
            どれでも発動するスキルも出す
          </label>
          <button className="text-sm text-sky-700 underline dark:text-sky-300" onClick={() => onChange({ style: [], distance: [], surface: [], includeGeneral: true })}>
            絞り込みをやめる
          </button>
        </>
      )}
    </div>
  );
}
