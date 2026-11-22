// 初回の案内とヘルプで使う、説明のページ(3つ)
import type { ReactNode } from "react";

/** 取り込み方の図:ゲームの「ウマ娘詳細」の画面と、スクロールの速さの見本 */
export function ImportGuideFigure() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      {/* ゲームの詳細画面の見取り図 */}
      <div className="w-48 overflow-hidden rounded-lg border-2 border-lime-500 bg-white text-[9px] text-slate-700 shadow">
        <div className="bg-lime-500 py-0.5 text-center font-bold text-white">ウマ娘詳細</div>
        <div className="flex items-center gap-1 p-1">
          <div className="h-8 w-8 rounded-full bg-amber-200" />
          <div>
            <div>[二つ名]</div>
            <div className="font-bold">ウマ娘の名前</div>
          </div>
        </div>
        <div className="mx-1 grid grid-cols-5 rounded border border-lime-500 text-center">
          {["速", "持", "力", "根", "賢"].map((s) => (
            <div key={s} className="border-r border-lime-200 last:border-r-0">
              <div className="bg-lime-500 text-white">{s}</div>
              <div>1200</div>
            </div>
          ))}
        </div>
        <div className="mx-1 my-1 space-y-0.5">
          {["バ場", "距離", "脚質"].map((r) => (
            <div key={r} className="flex gap-0.5">
              <span className="w-6">{r}</span>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="flex-1 rounded border border-slate-200 text-center">A</span>
              ))}
            </div>
          ))}
        </div>
        <div className="mx-1 rounded bg-lime-500 text-center text-white">スキル</div>
        {/* スキル欄(ここを手でスクロールする) */}
        <div className="relative mx-1 mb-1 h-20 overflow-hidden rounded border-2 border-dashed border-rose-500">
          <div className="guide-scroll absolute inset-x-1 top-1 grid grid-cols-2 gap-1">
            {Array.from({ length: 16 }, (_, i) => (
              <div key={i} className={`h-3.5 rounded ${i % 5 === 0 ? "bg-amber-300" : "bg-slate-300"}`} />
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-xs space-y-2 text-sm">
        <p>
          <b className="text-rose-600">赤い点線</b>のスキル欄を、マウスのホイールで<b>1段ずつ</b>、左の見本くらいの速さで下へスクロールします。
        </p>
        <p>1段スクロールしたら、ほんの少し止まるくらいがちょうどよい速さです。速すぎると「少しゆっくり」と案内が出ます。</p>
        <p>いちばん下まで行ったら、そのまま5秒待つと自動で止まります。</p>
      </div>
    </div>
  );
}

export type GuidePage = { title: string; body: ReactNode };

export const GUIDE_PAGES: GuidePage[] = [
  {
    title: "このアプリでできること",
    body: (
      <div className="space-y-2 text-sm">
        <p>育成が終わった殿堂入りウマ娘を登録して、<b>最大5人を並べて比べられます</b>。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>ステータス・適性で、いちばん高い人に ▲、いちばん低い人に ▼ が付きます。</li>
          <li>スキルは「その人だけが持っているもの」に ★ が付きます。</li>
          <li>「イベント」では、チャンピオンズミーティングなどの予定と、コースに合うウマ娘がわかります。</li>
        </ul>
        <p>このアプリはゲームの画面を<b>見るだけ</b>で、ゲームを操作したり、ゲームの中身を書き換えたりすることはありません。</p>
      </div>
    ),
  },
  {
    title: "ウマ娘の取り込み方",
    body: (
      <div className="space-y-3 text-sm">
        <p>
          ゲームで「殿堂入りウマ娘」の一覧からウマ娘を選び、<b>「ウマ娘詳細」</b>を開きます。アプリの<b>「画像から取り込む」→「取り込み開始」</b>を押して、
          スキル欄をスクロールします。ゲームは<b>全画面</b>にしておくと、正しく読み取れます。
        </p>
        <ImportGuideFigure />
        <p>止まると確認の画面が出ます。黄色のところは読み取りが不確かなので、ゲームの画面と見比べて直してから保存してください。</p>
      </div>
    ),
  },
  {
    title: "データのバックアップと共有",
    body: (
      <div className="space-y-2 text-sm">
        <p>登録したウマ娘は、この PC の中に保存されます。アプリが週に1回、自動でバックアップを作ります。</p>
        <p>
          PC を買い替えるときなどは、<b>「設定」→「バックアップのファイルを作る」</b>で作ったファイルを USB メモリなどに残し、新しい PC で
          「バックアップから戻す」を押します。
        </p>
        <p>
          家族にウマ娘を見せたいときは、<b>「ウマ娘一覧」</b>でチェックを付けて<b>「選んだウマ娘を書き出す」</b>を押し、できたファイルを渡します。
          受け取った人は、そのファイルをアプリの窓に<b>ドラッグ&ドロップ</b>する(またはダブルクリックする)と読み込めます。
        </p>
      </div>
    ),
  },
];
