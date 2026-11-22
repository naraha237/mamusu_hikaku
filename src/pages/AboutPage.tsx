import { useEffect, useState } from "react";
import { ExternalLink } from "../components/ExternalLink";
import { getAppInfo, type AppInfo } from "../lib/appInfo";
import { GAMETORA_SOURCE, WIKI_SOURCE } from "../lib/skills/constants";

export function AboutPage() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  useEffect(() => {
    getAppInfo().then(setInfo).catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h2 className="text-2xl font-bold">このアプリについて</h2>

      <section className="space-y-1">
        <p className="text-lg font-bold">ウマ娘 比較ノート</p>
        {info && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            バージョン {info.version}({info.installed ? "インストール版" : "単体版"})
          </p>
        )}
        <p>殿堂入りウマ娘を最大5人並べて、ステータス・適性・スキルを比べるアプリです。</p>
        <p className="text-sm">
          このアプリはゲームの画面を見るだけで、ゲームを操作したり、ゲームの中身を読み書きしたりすることはありません。
        </p>
      </section>

      <section className="space-y-2 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <h3 className="text-lg font-bold">出典</h3>
        <div>
          <p className="font-bold">スキルの一覧</p>
          <p className="text-sm">
            <ExternalLink href={WIKI_SOURCE.url}>{WIKI_SOURCE.name}「Game:List of Skills」</ExternalLink>
            <br />
            {WIKI_SOURCE.url}
            <br />
            ライセンス:<ExternalLink href={WIKI_SOURCE.licenseUrl}>{WIKI_SOURCE.license}</ExternalLink>
            (アプリで使いやすいように形を変えて利用しています)
          </p>
        </div>
        <div>
          <p className="font-bold">スキルの一覧・説明・アイコン</p>
          <p className="text-sm">
            <ExternalLink href={GAMETORA_SOURCE.url}>{GAMETORA_SOURCE.name}</ExternalLink>
            <br />
            {GAMETORA_SOURCE.url}
            <br />
            スキルの日本語の説明・進化スキル・アイコンの画像を取得して利用しています。
          </p>
        </div>
        <div>
          <p className="font-bold">イベントの予定</p>
          <p className="text-sm">
            <ExternalLink href="https://umamusume.jp/news/">ウマ娘 プリティーダービー 公式ポータルサイト「お知らせ」</ExternalLink>
            <br />
            対戦レースイベントの予定・開催期間・コースを、お知らせから読み取って表示しています。
          </p>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          「ウマ娘 プリティーダービー」は株式会社Cygamesの作品です。このアプリは非公式のもので、Cygames とは関係ありません。
        </p>
      </section>
    </div>
  );
}
