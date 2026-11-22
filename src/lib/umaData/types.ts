// ウマ娘の名前・衣装(二つ名)・評価ランクの表(GameTora のデータから作る data/umas.json)

export type UmaCard = {
  /** 衣装ごとの ID */
  cardId: number;
  /** キャラごとの ID */
  charId: number;
  /** ウマ娘の名前(例:マンハッタンカフェ) */
  name: string;
  /** 衣装・二つ名(かっこは除く。例:柳緑小夜) */
  outfit: string;
};

/** 評価点がこれ以上ならこのランク */
export type RankStep = { min: number; name: string };

export type UmaDataFile = {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  gametoraVersion?: string;
  cards: UmaCard[];
  ranks: RankStep[];
};

/** 評価点から評価ランク(例:58367 → UA3)を求める */
export function rankFromScore(score: number | undefined, ranks: RankStep[]): string | undefined {
  if (score === undefined || !ranks.length) return undefined;
  let name: string | undefined;
  for (const r of ranks) if (score >= r.min) name = r.name;
  return name;
}
