import { useMemo } from "react";
import { ExternalLink } from "../components/ExternalLink";
import { Portrait } from "../components/SkillIcon";
import { Button, GradeBadge, Notice } from "../components/ui";
import { useEvents } from "../lib/events/EventsContext";
import type { RaceEvent } from "../lib/events/parse";
import { useUmas } from "../lib/uma/UmaContext";
import { gradeValue, MAX_COMPARE, umaLabel, type UmaEntry } from "../lib/uma/types";

const SURFACE_LABEL = { turf: "芝", dirt: "ダート" } as const;
const DISTANCE_LABEL = { sprint: "短距離", mile: "マイル", medium: "中距離", long: "長距離" } as const;
const STYLE_LABEL = { front: "逃げ", pace: "先行", late: "差し", end: "追込" } as const;

const fmt = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** そのイベントのコースに合う(バ場・距離の適性が A 以上の)ウマ娘を、評価点の高い順に */
function suitable(ev: RaceEvent, umas: UmaEntry[]): UmaEntry[] {
  const c = ev.course;
  if (!c?.surface || !c.distance) return [];
  return umas
    .filter((u) => gradeValue(u.aptitude.surface[c.surface!]) >= gradeValue("A") && gradeValue(u.aptitude.distance[c.distance!]) >= gradeValue("A"))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/** いちばん適性の高い脚質 */
const bestStyle = (u: UmaEntry) =>
  (Object.keys(STYLE_LABEL) as (keyof typeof STYLE_LABEL)[]).reduce((best, k) =>
    gradeValue(u.aptitude.style[k]) > gradeValue(u.aptitude.style[best]) ? k : best,
  );

export function EventsPage({ onCompare }: { onCompare: (ids: string[]) => void }) {
  const data = useEvents();
  const { umas } = useUmas();
  const now = Date.now();
  // 終わったイベントは出さない
  const upcoming = useMemo(() => data.events.filter((e) => !e.end || Date.parse(e.end) >= now), [data, now]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex items-baseline gap-3">
        <h2 className="text-2xl font-bold">イベントの予定</h2>
        <span className="text-sm text-slate-500">チャンピオンズミーティング・リーグ オブ ヒーローズ など</span>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        公式サイトのお知らせから取っています(最終確認 {new Date(data.fetchedAt).toLocaleDateString()})。正式な日程や詳しい内容は
        <ExternalLink href={data.sourceUrl}>公式サイトのお知らせ</ExternalLink>で確かめてください。
      </p>

      {upcoming.length === 0 && <Notice>これからのイベントの予定はまだありません。</Notice>}

      {upcoming.map((ev, i) => {
        const fits = suitable(ev, umas);
        const running = ev.start && Date.parse(ev.start) <= now;
        return (
          <section key={`${ev.name}-${ev.when}-${i}`} className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex flex-wrap items-baseline gap-3">
              <h3 className="text-lg font-bold">{ev.name}</h3>
              {running && <span className="rounded bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">開催中</span>}
              <span className="text-sm">{ev.start ? `${fmt(ev.start)} 〜 ${fmt(ev.end)}` : ev.when}</span>
            </div>
            {ev.course && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {ev.course.surface && <span className="rounded bg-lime-100 px-2 py-0.5 font-bold text-lime-900 dark:bg-lime-900 dark:text-lime-50">{SURFACE_LABEL[ev.course.surface]}</span>}
                {ev.course.distance && <span className="rounded bg-sky-100 px-2 py-0.5 font-bold text-sky-900 dark:bg-sky-900 dark:text-sky-50">{DISTANCE_LABEL[ev.course.distance]}</span>}
                <span>{ev.course.text}</span>
              </div>
            )}
            {ev.rules?.map((r) => (
              <div key={r} className="text-sm">
                <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-900 dark:text-amber-50">特殊ルール</span> {r}
              </div>
            ))}

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold">
                  このコースに合うウマ娘
                  {ev.course?.surface && ev.course.distance && (
                    <span className="ml-1 font-normal text-slate-500">
                      ({SURFACE_LABEL[ev.course.surface]}・{DISTANCE_LABEL[ev.course.distance]}の適性が A 以上、評価点の高い順)
                    </span>
                  )}
                </p>
                <div className="flex-1" />
                {fits.length > 0 && (
                  <Button className="text-sm" onClick={() => onCompare(fits.slice(0, MAX_COMPARE).map((u) => u.id))}>
                    上位{Math.min(fits.length, MAX_COMPARE)}人をくらべる
                  </Button>
                )}
              </div>
              {!ev.course?.surface || !ev.course.distance ? (
                <p className="text-sm text-slate-500">コースの条件がまだ発表されていません。</p>
              ) : fits.length === 0 ? (
                <p className="text-sm text-slate-500">登録したウマ娘の中に、条件に合うウマ娘はいませんでした。</p>
              ) : (
                <ul className="grid gap-2 md:grid-cols-2">
                  {fits.slice(0, 6).map((u) => {
                    const style = bestStyle(u);
                    return (
                      <li key={u.id} className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1 text-sm dark:border-slate-700">
                        <Portrait png={u.portrait} size={32} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-bold">{umaLabel(u)}</div>
                          <div className="text-xs text-slate-500">
                            {u.rank ?? "—"} {u.score?.toLocaleString() ?? ""}
                          </div>
                        </div>
                        <span className="flex items-center gap-1 text-xs">
                          {SURFACE_LABEL[ev.course!.surface!]}
                          <GradeBadge grade={u.aptitude.surface[ev.course!.surface!]} className="h-5 w-5 text-xs" />
                          {DISTANCE_LABEL[ev.course!.distance!]}
                          <GradeBadge grade={u.aptitude.distance[ev.course!.distance!]} className="h-5 w-5 text-xs" />
                          {STYLE_LABEL[style]}
                          <GradeBadge grade={u.aptitude.style[style]} className="h-5 w-5 text-xs" />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className="text-xs text-slate-500">出典:{ev.sourceTitle}</p>
          </section>
        );
      })}
    </div>
  );
}
