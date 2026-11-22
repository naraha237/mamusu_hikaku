// スキルの発動条件を、コースの形(コーナー・直線・坂・フェーズ)と照らし合わせて、
// 「このコースでは発動できる場所がない」スキルを見つける。
//
// 条件は GameTora の書き方(例:"phase==1&corner!=0@distance_rate>=50&corner!=0")。
// 「@」は「または」、「&」は「かつ」。コースの場所に関係する条件だけを見て、
// 関係しない条件(順位・スタミナ・天気など)は「満たせる」とみなす。
import { isBasisDistance, type Course, type Segment } from "./types";

type Range = [number, number];

const intersect = (a: Range[], b: Range[]): Range[] => {
  const out: Range[] = [];
  for (const [s1, e1] of a) for (const [s2, e2] of b) {
    const s = Math.max(s1, s2);
    const e = Math.min(e1, e2);
    if (e - s > 0.5) out.push([s, e]);
  }
  return out;
};
const complement = (a: Range[], len: number): Range[] => {
  const sorted = [...a].sort((x, y) => x[0] - y[0]);
  const out: Range[] = [];
  let pos = 0;
  for (const [s, e] of sorted) {
    if (s > pos) out.push([pos, s]);
    pos = Math.max(pos, e);
  }
  if (pos < len) out.push([pos, len]);
  return out;
};
const seg = (list: Segment[]): Range[] => list.map((s) => [s.start, s.end]);

type Term = { key: string; op: string; value: number };

function parseTerm(s: string): Term | null {
  const m = s.trim().match(/^([a-z_0-9]+)(==|!=|>=|<=|>|<)(-?\d+)$/);
  return m ? { key: m[1], op: m[2], value: Number(m[3]) } : null;
}

const compare = (x: number, op: string, v: number) =>
  op === "==" ? x === v : op === "!=" ? x !== v : op === ">=" ? x >= v : op === "<=" ? x <= v : op === ">" ? x > v : x < v;

/** 1つの「かつ」の組が、このコースで満たせる場所(距離の範囲)。場所に関係しない組なら全体 */
function feasibleRanges(terms: Term[], c: Course, trackId: number): { ranges: Range[]; why?: string } {
  const L = c.length;
  let r: Range[] = [[0, L]];
  const phase = (id: number) => seg(c.phases.filter((p) => p.id === id));
  const phasePart = (id: number, from: number, to: number): Range[] =>
    c.phases.filter((p) => p.id === id).map((p) => [p.start + (p.end - p.start) * from, p.start + (p.end - p.start) * to]);
  const corners = (n?: number) => seg(n === undefined ? c.corners : c.corners.filter((x) => x.number === n));
  const lastCorner = [...c.corners].sort((a, b) => b.start - a.start)[0];
  const lastStraight = [...c.straights].sort((a, b) => b.start - a.start)[0];
  const ups = seg(c.slopes.filter((s) => s.slope > 0));
  const downs = seg(c.slopes.filter((s) => s.slope < 0));

  for (const t of terms) {
    const v = t.value;
    switch (t.key) {
      // ---- コースそのものの決まり ----
      case "track_id":
        if (!compare(trackId, t.op, v)) return { ranges: [], why: "このレース場では発動しません" };
        break;
      case "rotation": {
        const dir = c.direction === "right" ? 1 : c.direction === "left" ? 2 : 4;
        if (!compare(dir, t.op, v)) return { ranges: [], why: v === 1 ? "右回りのコースでだけ発動します" : "左回りのコースでだけ発動します" };
        break;
      }
      case "is_basis_distance":
        if (!compare(isBasisDistance(c) ? 1 : 0, t.op, v))
          return { ranges: [], why: v === 1 ? "根幹距離(400mの倍数)でだけ発動します" : "非根幹距離でだけ発動します" };
        break;
      case "course_distance":
        if (!compare(L, t.op, v)) return { ranges: [], why: `距離の決まり(${t.op}${v}m)に合いません` };
        break;
      case "corner_count":
        if (!compare(c.corners.length, t.op, v)) return { ranges: [], why: "コーナーの数の決まりに合いません" };
        break;
      case "ground_type":
        if (!compare(c.surface === "turf" ? 1 : 2, t.op, v)) return { ranges: [], why: v === 1 ? "芝でだけ発動します" : "ダートでだけ発動します" };
        break;

      // ---- 場所の決まり ----
      case "distance_rate":
        if (t.op === ">=" || t.op === ">") r = intersect(r, [[(L * v) / 100, L]]);
        else if (t.op === "<=" || t.op === "<") r = intersect(r, [[0, (L * v) / 100]]);
        break;
      case "remain_distance":
        if (t.op === "<=" || t.op === "<") r = intersect(r, [[L - v, L]]);
        else if (t.op === ">=" || t.op === ">") r = intersect(r, [[0, L - v]]);
        else if (t.op === "==") r = intersect(r, [[L - v - 1, L - v + 1]]);
        break;
      case "phase":
      case "phase_random": {
        const ids = [0, 1, 2, 3].filter((id) => compare(id, t.key === "phase_random" ? "==" : t.op, v));
        r = intersect(r, ids.flatMap(phase));
        break;
      }
      case "phase_firsthalf":
      case "phase_firsthalf_random":
        r = intersect(r, phasePart(v, 0, 0.5));
        break;
      case "phase_laterhalf":
      case "phase_laterhalf_random":
        r = intersect(r, phasePart(v, 0.5, 1));
        break;
      case "phase_firstquarter":
      case "phase_firstquarter_random":
        r = intersect(r, phasePart(v, 0, 0.25));
        break;
      case "corner":
        if (t.op === "!=" && v === 0) r = intersect(r, corners());
        else if (t.op === "==" && v === 0) r = intersect(r, complement(corners(), L));
        else if (t.op === "==") r = intersect(r, corners(v));
        else if (t.op === "!=") r = intersect(r, complement(corners(v), L));
        break;
      case "all_corner_random":
      case "corner_random":
        r = intersect(r, t.key === "corner_random" && v > 0 ? corners(v) : corners());
        break;
      case "phase_corner_random":
        r = intersect(intersect(r, phase(v)), corners());
        break;
      case "is_finalcorner":
        if (!lastCorner) {
          if (v === 1) return { ranges: [], why: "最終コーナーがないコースです" };
        } else r = intersect(r, v === 1 ? [[lastCorner.start, L]] : [[0, lastCorner.start]]);
        break;
      case "is_finalcorner_random":
      case "is_finalcorner_laterhalf":
        if (!lastCorner) return { ranges: [], why: "最終コーナーがないコースです" };
        r = intersect(r, [[t.key === "is_finalcorner_laterhalf" ? (lastCorner.start + lastCorner.end) / 2 : lastCorner.start, lastCorner.end]]);
        break;
      case "is_last_straight":
      case "is_last_straight_onetime":
      case "last_straight_random":
        if (lastStraight) r = intersect(r, [[lastStraight.start, lastStraight.end]]);
        break;
      case "straight_random":
        r = intersect(r, seg(c.straights));
        break;
      case "straight_front_type":
        r = intersect(r, seg(c.straights.filter((s) => s.frontType === v)));
        break;
      case "phase_straight_random":
        r = intersect(intersect(r, phase(v)), seg(c.straights));
        break;
      case "phase_first_half_straight_random":
        r = intersect(intersect(r, [[0, L / 2]]), seg(c.straights));
        break;
      case "phase_latter_half_straight_random":
        r = intersect(intersect(r, [[L / 2, L]]), seg(c.straights));
        break;
      case "slope":
        if (v === 1) r = intersect(r, ups);
        else if (v === 2) r = intersect(r, downs);
        else if (v === 0) r = intersect(r, complement([...ups, ...downs], L));
        break;
      case "up_slope_random":
        r = intersect(r, ups);
        break;
      case "up_slope_random_later_half":
        r = intersect(intersect(r, ups), [[L / 2, L]]);
        break;
      case "down_slope_random":
        r = intersect(r, downs);
        break;
      case "is_lastspurt":
        if (v === 1) r = intersect(r, [[c.spurtStart ?? (L * 2) / 3, L]]);
        break;
      default:
        // 場所に関係しない条件(順位・持久力・天気など)は、ここでは見ない
        break;
    }
    if (!r.length) return { ranges: [] };
  }
  return { ranges: r };
}

export type Feasibility = { ok: true } | { ok: false; reason: string };

/** このコースで、そのスキルが発動できる場所があるか */
export function checkSkillOnCourse(cond: string | undefined, c: Course, trackId: number): Feasibility {
  if (!cond) return { ok: true };
  const reasons: string[] = [];
  for (const alt of cond.split("@")) {
    const terms = alt.split("&").map(parseTerm).filter((t): t is Term => !!t);
    const { ranges, why } = feasibleRanges(terms, c, trackId);
    if (ranges.length) return { ok: true };
    if (why) reasons.push(why);
  }
  return { ok: false, reason: reasons[0] ?? "このコースには、発動する条件に合う場所(コーナー・直線・坂など)がありません" };
}
