// 動作確認・お試し用のダミーのウマ娘(数値は架空のもの)
import { findSkillByName } from "../skills/search";
import type { MasterSkill } from "../skills/types";
import { newId, type Aptitude, type Grade, type UmaEntry, type UmaSkill } from "./types";

export const SAMPLE_OWNER = "お試し";

type Sample = {
  name: string;
  outfit: string;
  nickname: string;
  rank: string;
  score: number;
  stats: [number, number, number, number, number];
  /** 芝 ダ / 短 マ 中 長 / 逃 先 差 追 */
  apt: string;
  skills: (string | [string, number])[];
};

const SAMPLES: Sample[] = [
  {
    name: "スペシャルウィーク",
    outfit: "スペシャルドリーマー",
    nickname: "中距離差し",
    rank: "UG",
    score: 21450,
    stats: [1650, 1210, 1180, 820, 1050],
    apt: "AG/FCAA/GAAC",
    skills: [["シューティングスター", 5], "末脚", "直線加速", "中距離直線○", "根幹距離○", "良バ場○", "コーナー加速○", "好位追走", "全身全霊", "冬ウマ娘◎"],
  },
  {
    name: "サイレンススズカ",
    outfit: "サイレントイノセンス",
    nickname: "マイル逃げ",
    rank: "UG",
    score: 20980,
    stats: [1780, 980, 1120, 760, 1240],
    apt: "AG/DAAE/AEGG",
    skills: [["先頭の景色は譲らない…！", 5], "地固め", "二の矢", "コーナー加速○", "直線巧者", "左回り◎", "晴れの日○", "弧線のプロフェッサー", "スリーセブン"],
  },
  {
    name: "トウカイテイオー",
    outfit: "ビヨンド・ザ・ホライズン",
    nickname: "先行テスト",
    rank: "SS+",
    score: 17220,
    stats: [1420, 1080, 1300, 950, 980],
    apt: "AE/FBAB/CAAG",
    skills: ["好位追走", "コーナー加速○", "根幹距離○", "迫る影", "ペースキープ", "秋ウマ娘○", "円弧のマエストロ"],
  },
  {
    name: "マンハッタンカフェ",
    outfit: "Creeping Black",
    nickname: "長距離追込",
    rank: "UG",
    score: 19870,
    stats: [1520, 1450, 1150, 1010, 1180],
    apt: "AG/GEBA/GCAA",
    skills: ["末脚", "直線加速", "鋼の意志", "善後策", "ありったけ", "レーンの魔術師", "弧線のプロフェッサー", "冬ウマ娘◎", "アガッてきた！"],
  },
  {
    name: "ゴールドシップ",
    outfit: "レッドストライフ",
    nickname: "",
    rank: "SS",
    score: 15430,
    stats: [1280, 1380, 1220, 1100, 870],
    apt: "AG/GCAA/GCAA",
    skills: ["乗り換え上手", "全身全霊", "ありったけ", "末脚", "良バ場○"],
  },
];

function parseApt(s: string): Aptitude {
  const [sf, ds, st] = s.split("/").map((p) => p.split("") as Grade[]);
  return {
    surface: { turf: sf[0], dirt: sf[1] },
    distance: { sprint: ds[0], mile: ds[1], medium: ds[2], long: ds[3] },
    style: { front: st[0], pace: st[1], late: st[2], end: st[3] },
  };
}

export function makeSampleUmas(master: MasterSkill[]): UmaEntry[] {
  const now = new Date().toISOString();
  return SAMPLES.map((s) => {
    const skills: UmaSkill[] = s.skills.map((entry) => {
      const [name, level] = Array.isArray(entry) ? entry : [entry, undefined];
      const m = findSkillByName(master, name);
      return { name: m?.nameJa ?? name, skillId: m?.id, type: m?.type, level };
    });
    return {
      id: newId(),
      name: s.name,
      outfit: s.outfit,
      nickname: s.nickname || undefined,
      owner: SAMPLE_OWNER,
      rank: s.rank,
      score: s.score,
      stats: { speed: s.stats[0], stamina: s.stats[1], power: s.stats[2], guts: s.stats[3], wit: s.stats[4] },
      aptitude: parseApt(s.apt),
      skills,
      factors: [
        { kind: "blue", name: "スピード", stars: 3 },
        { kind: "red", name: "中距離", stars: 2 },
      ],
      tags: ["サンプル"],
      createdAt: now,
      updatedAt: now,
    };
  });
}
