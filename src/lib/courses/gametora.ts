// GameTora の racetracks / racetracks_extended を、アプリの形(data/courses.json)に直す。同期スクリプトで使う。
import type { Course, Track } from "./types";

type GtCourse = {
  id: number;
  length: number;
  terrain: number;
  turn: number;
  inout: number;
  distance: number;
  corners?: { start: number; end: number; number: number }[];
  straights?: { start: number; end: number; frontType: number }[];
  slopes?: { start: number; end: number; slope: number }[];
  phases?: { start: number; end: number; id: number }[];
  spurtStart?: { meters?: number };
};
type GtTrack = { id: number | string; courses: GtCourse[] };
type GtTrackName = { id: number | string; name_ja: string };

const DIRECTION = { 1: "right", 2: "left", 4: "straight" } as const;
const INOUT = { 2: "inner", 3: "outer", 4: "outerToInner" } as const;
const DISTANCE = { 1: "sprint", 2: "mile", 3: "medium", 4: "long" } as const;

export function parseTracks(tracksData: unknown, namesData: unknown): Track[] {
  if (!Array.isArray(tracksData) || !Array.isArray(namesData)) throw new Error("GameTora のレース場のデータの形が想定と違います");
  const names = new Map((namesData as GtTrackName[]).map((n) => [String(n.id), n.name_ja]));
  return (tracksData as GtTrack[])
    .filter((t) => names.has(String(t.id)))
    .map((t) => ({
      id: Number(t.id),
      name: names.get(String(t.id))!,
      courses: t.courses.map(
        (c): Course => ({
          id: Number(c.id),
          trackId: Number(t.id),
          length: c.length,
          surface: c.terrain === 2 ? "dirt" : "turf",
          direction: DIRECTION[c.turn as keyof typeof DIRECTION] ?? "right",
          inout: INOUT[c.inout as keyof typeof INOUT],
          distance: DISTANCE[c.distance as keyof typeof DISTANCE] ?? "medium",
          corners: (c.corners ?? []).map(({ start, end, number }) => ({ start, end, number })),
          straights: (c.straights ?? []).map(({ start, end, frontType }) => ({ start, end, frontType })),
          slopes: (c.slopes ?? []).map(({ start, end, slope }) => ({ start, end, slope })),
          phases: (c.phases ?? []).map(({ start, end, id }) => ({ start, end, id })),
          spurtStart: c.spurtStart?.meters,
        }),
      ),
    }));
}
