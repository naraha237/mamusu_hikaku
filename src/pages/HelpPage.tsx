import { useState } from "react";
import { GUIDE_PAGES } from "../components/Guides";
import { Button, ConfirmDialog, Notice } from "../components/ui";
import { useUmas } from "../lib/uma/UmaContext";
import { SAMPLE_TAG } from "../lib/uma/sampleData";

/** ヘルプ:案内をいつでも見直せる。お試し用のウマ娘の出し入れもここで */
export function HelpPage({ onShowOnboarding, onTrySamples }: { onShowOnboarding: () => void; onTrySamples: () => void }) {
  const { umas, remove } = useUmas();
  const samples = umas.filter((u) => u.tags?.includes(SAMPLE_TAG));
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <h2 className="flex-1 text-2xl font-bold">ヘルプ</h2>
        <Button onClick={onShowOnboarding}>はじめの案内をもう一度見る</Button>
      </div>
      {message && <Notice>{message}</Notice>}

      <section className="space-y-2 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <h3 className="text-lg font-bold">お試しモード</h3>
        <p className="text-sm">お試し用のウマ娘(3人)を入れて、くらべる画面を試せます。あとで消せます。</p>
        <div className="flex gap-2">
          <Button onClick={onTrySamples}>お試し用のウマ娘を入れて試す</Button>
          {samples.length > 0 && (
            <Button variant="ghost" className="text-rose-600" onClick={() => setConfirm(true)}>
              お試し用のウマ娘を消す({samples.length}人)
            </Button>
          )}
        </div>
      </section>

      {GUIDE_PAGES.map((p) => (
        <section key={p.title} className="space-y-2 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="text-lg font-bold">{p.title}</h3>
          {p.body}
        </section>
      ))}

      <section className="space-y-2 rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-700">
        <h3 className="text-lg font-bold">こまったときは</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>「ウマ娘の画面が見つかりません」と出る:ゲームを起動してから、もう一度「取り込み開始」を押してください。見つからないときは「自分で選ぶ」でゲームの画面を選べます。</li>
          <li>スキルの読み取りがおかしい:ゲームを全画面にすると、正しく読み取れることが多いです。確認の画面で「直す」から直せます。</li>
          <li>アプリの調子が悪い:「設定」→「ログを保存」で保存したファイルを、配った人に送ってください。</li>
        </ul>
      </section>

      {confirm && (
        <ConfirmDialog
          danger
          confirmLabel="消す"
          message={<p>お試し用のウマ娘({samples.length}人)を消しますか?自分で登録したウマ娘は消えません。</p>}
          onCancel={() => setConfirm(false)}
          onConfirm={async () => {
            setConfirm(false);
            for (const s of samples) await remove(s.id).catch(() => {});
            setMessage("お試し用のウマ娘を消しました。");
          }}
        />
      )}
    </div>
  );
}
