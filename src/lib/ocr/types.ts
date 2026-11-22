// Rust の screenshot::Analysis と同じ形
export type EndGlyph = "double" | "single" | "cross" | "none" | "other";

export type SkillLine = {
  text: string;
  column: 0 | 1;
  y: number;
  partial: boolean;
  endGlyph: EndGlyph;
};

export type GradeGuess = { key: string; grade: string; sure: boolean };

export type Analysis = {
  width: number;
  height: number;
  panel: { x: number; y: number; w: number } | null;
  headerLines: string[];
  scoreText: string;
  statCandidates: string[][];
  aptitudes: GradeGuess[];
  skills: SkillLine[];
  portraitPng: string | null;
};
