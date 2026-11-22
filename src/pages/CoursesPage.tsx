import { useMemo, useState } from "react";
import { CourseDiagram } from "../components/CourseDiagram";
import { ExternalLink } from "../components/ExternalLink";
import { inputClass } from "../components/ui";
import { useCourses } from "../lib/courses/CoursesContext";
import { DIRECTION_LABEL, INOUT_LABEL } from "../lib/courses/types";

/** レース場とコースの形を見る画面 */
export function CoursesPage() {
  const data = useCourses();
  const [trackId, setTrackId] = useState<number>(data.tracks.find((t) => t.name === "東京")?.id ?? data.tracks[0]?.id);
  const [surface, setSurface] = useState<"all" | "turf" | "dirt">("all");
  const track = data.tracks.find((t) => t.id === trackId) ?? data.tracks[0];
  const courses = useMemo(
    () => (track?.courses ?? []).filter((c) => surface === "all" || c.surface === surface).sort((a, b) => (a.surface === b.surface ? a.length - b.length : a.surface === "turf" ? -1 : 1)),
    [track, surface],
  );
  const [courseId, setCourseId] = useState<number | null>(null);
  const course = courses.find((c) => c.id === courseId) ?? courses[0];

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <h2 className="text-2xl font-bold">レース場</h2>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          レース場
          <select
            className={inputClass}
            value={track?.id}
            onChange={(e) => {
              setTrackId(Number(e.target.value));
              setCourseId(null);
            }}
          >
            {data.tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          バ場
          <select className={inputClass} value={surface} onChange={(e) => setSurface(e.target.value as typeof surface)}>
            <option value="all">すべて</option>
            <option value="turf">芝</option>
            <option value="dirt">ダート</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-1">
        {courses.map((c) => (
          <button
            key={c.id}
            className={`rounded border px-2 py-1 text-sm ${
              c.id === course?.id ? "border-sky-600 bg-sky-600 font-bold text-white" : "border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
            }`}
            onClick={() => setCourseId(c.id)}
          >
            {c.surface === "turf" ? "芝" : "ダ"}
            {c.length}m{c.inout ? `(${INOUT_LABEL[c.inout]})` : ""}
          </button>
        ))}
      </div>
      {track && course && <CourseDiagram track={track} course={course} />}
      {course && (
        <p className="text-xs text-slate-500">
          {DIRECTION_LABEL[course.direction]}。出典:<ExternalLink href={data.sourceUrl}>GameTora</ExternalLink>(最終確認{" "}
          {new Date(data.fetchedAt).toLocaleDateString()})
        </p>
      )}
    </div>
  );
}
