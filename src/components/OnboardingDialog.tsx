import { useState } from "react";
import { GUIDE_PAGES } from "./Guides";
import { Button } from "./ui";

/** 初めて起動したときの案内(3画面) */
export function OnboardingDialog({ onFinish, onTrySamples }: { onFinish: () => void; onTrySamples: () => void }) {
  const [step, setStep] = useState(0);
  const page = GUIDE_PAGES[step];
  const last = step === GUIDE_PAGES.length - 1;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          ようこそ
          <div className="flex-1" />
          {GUIDE_PAGES.map((_, i) => (
            <span key={i} className={`h-2 w-2 rounded-full ${i === step ? "bg-sky-600" : "bg-slate-300 dark:bg-slate-600"}`} />
          ))}
        </div>
        <h2 className="text-xl font-bold">{page.title}</h2>
        {page.body}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button variant="ghost" onClick={onFinish}>
            案内を閉じる
          </Button>
          <div className="flex-1" />
          {step > 0 && <Button onClick={() => setStep(step - 1)}>戻る</Button>}
          {last ? (
            <>
              <Button onClick={onTrySamples}>お試し用のウマ娘で試してみる</Button>
              <Button variant="primary" onClick={onFinish}>
                はじめる
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => setStep(step + 1)}>
              次へ
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
