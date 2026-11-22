// レース場・コースのデータ(GameTora の racetracks から作る data/courses.json)

export type Segment = { start: number; end: number };
export type Corner = Segment & { number: number };
/** frontType:1 = 正面(ゴールのある直線)、2 = 向正面 */
export type Straight = Segment & { frontType: number };
/** slope:プラスが上り坂、マイナスが下り坂(1万で 1%) */
export type Slope = Segment & { slope: number };
/** id:0 序盤 / 1 中盤 / 2 終盤 / 3 ラストスパート */
export type Phase = Segment & { id: number };

export type Course = {
  id: number;
  trackId: number;
  /** 距離(m) */
  length: number;
  surface: "turf" | "dirt";
  /** 右回り / 左回り / 直線 */
  direction: "right" | "left" | "straight";
  /** 内回り / 外回り / 外→内 / なし */
  inout?: "inner" | "outer" | "outerToInner";
  distance: "sprint" | "mile" | "medium" | "long";
  corners: Corner[];
  straights: Straight[];
  slopes: Slope[];
  phases: Phase[];
  /** ラストスパートが始まる位置(m) */
  spurtStart?: number;
};

export type Track = { id: number; name: string; courses: Course[] };

export type CoursesFile = { source: string; sourceUrl: string; fetchedAt: string; tracks: Track[] };

export const DIRECTION_LABEL = { right: "右回り", left: "左回り", straight: "直線" } as const;
export const INOUT_LABEL = { inner: "内回り", outer: "外回り", outerToInner: "外→内" } as const;
export const PHASE_LABEL = ["序盤", "中盤", "終盤", "ラストスパート"];

/** 「京都 芝 3000m 右・外」のような説明 */
export function courseTitle(track: Track, c: Course): string {
  const surface = c.surface === "turf" ? "芝" : "ダート";
  const inout = c.inout ? `・${INOUT_LABEL[c.inout]}` : "";
  return `${track.name} ${surface} ${c.length}m(${DIRECTION_LABEL[c.direction]}${inout})`;
}

/** 根幹距離(400m の倍数)か */
export const isBasisDistance = (c: Course) => c.length % 400 === 0;
