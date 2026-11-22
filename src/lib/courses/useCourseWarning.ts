import { useMemo } from "react";
import { useEvents } from "../events/EventsContext";
import { upcomingEvents } from "../events/labels";
import type { MasterSkill } from "../skills/types";
import { courseOfEvent, useCourses } from "./CoursesContext";
import { checkSkillOnCourse } from "./feasibility";
import { courseTitle } from "./types";

/**
 * 絞り込みで選んだイベントのコースに対して、スキルが発動できるか調べる関数を返す。
 * 発動しない可能性があるときは理由の文、なければ undefined。イベントを選んでいなければ常に undefined。
 */
export function useCourseWarning(eventLabel?: string) {
  const { events } = useEvents();
  const { tracks } = useCourses();
  return useMemo(() => {
    const ev = eventLabel ? upcomingEvents(events).find((o) => o.label === eventLabel)?.event : undefined;
    const found = courseOfEvent(ev, tracks);
    if (!found) return { course: null, warn: (_m?: MasterSkill) => undefined as string | undefined };
    const cache = new Map<string, string | undefined>();
    return {
      course: courseTitle(found.track, found.course),
      warn: (m?: MasterSkill) => {
        if (!m?.cond) return undefined;
        if (!cache.has(m.id)) {
          const r = checkSkillOnCourse(m.cond, found.course, found.track.id);
          cache.set(m.id, r.ok ? undefined : `${courseTitle(found.track, found.course)}では発動しない可能性があります(${r.reason})`);
        }
        return cache.get(m.id);
      },
    };
  }, [eventLabel, events, tracks]);
}
