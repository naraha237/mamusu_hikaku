// 画面の設定(ダークモード・文字サイズなど)。データフォルダの settings.json に保存する。
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { readJson, writeJson } from "./dataFiles";

export type Theme = "system" | "light" | "dark";
export type FontSize = "normal" | "large";

export type UiSettings = {
  theme: Theme;
  fontSize: FontSize;
  /** 比較表のステータスに濃淡の背景を付ける */
  heatmap: boolean;
  /** 比べる人全員がこの評価以下の適性の行を隠す("none" なら隠さない) */
  hideAptitudeAtOrBelow: "none" | "G" | "F" | "E" | "D";
  /** 「このウィンドウで合っています」と答えたゲームのウィンドウ(次からは確認しない) */
  rememberedWindow?: { title: string; className: string };
  /** 初めての取り込みのときの説明を見たか */
  captureIntroShown?: boolean;
  /** 取り込みの開始・停止のキー(空なら設定ファイルの既定) */
  captureHotkey?: string;
  /** ゲームのウィンドウを探す条件(空なら設定ファイルの既定) */
  windowCandidates?: { title: string; className: string }[];
};

const DEFAULTS: UiSettings = { theme: "system", fontSize: "normal", heatmap: true, hideAptitudeAtOrBelow: "none" };
const FILE = "settings.json";

type Ctx = { settings: UiSettings; update: (patch: Partial<UiSettings>) => void };
const SettingsContext = createContext<Ctx | null>(null);

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UiSettings>(DEFAULTS);

  useEffect(() => {
    readJson<Partial<UiSettings>>(FILE).then((s) => s && setSettings({ ...DEFAULTS, ...s }));
  }, []);

  useEffect(() => {
    applyTheme(settings.theme);
    document.documentElement.style.fontSize = settings.fontSize === "large" ? "18px" : "16px";
    // Windows の設定が変わったら追従する
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(settings.theme);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [settings.theme, settings.fontSize]);

  const update = (patch: Partial<UiSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      writeJson(FILE, next).catch(() => {});
      return next;
    });
  };

  return <SettingsContext.Provider value={{ settings, update }}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("SettingsProvider の中で使ってください");
  return ctx;
}
