import { useState } from "react";
import { useSkillMaster } from "../lib/skills/SkillMasterContext";
import type { MasterOrigin } from "../lib/skills/master";
import type { MasterSkill } from "../lib/skills/types";
import { GAMETORA_SOURCE, WIKI_SOURCE } from "../lib/skills/constants";
import { ExternalLink } from "../components/ExternalLink";
import { UserSkillsSection } from "../components/UserSkillsSection";
import { AdvancedSettings } from "../components/AdvancedSettings";
import { useSettings, type FontSize, type Theme, type UiSettings } from "../lib/settings";

const ORIGIN_LABEL: Record<MasterOrigin, string> = {
  distribution: "インターネットから取得したもの",
  wiki: "取得元のサイトから直接取得したもの",
  cache: "前回取得したもの",
  bundled: "アプリに最初から入っているもの",
};

const FIELD_LABEL: Record<string, string> = {
  nameJa: "名前",
  nameEn: "英語名",
  type: "種類",
  description: "説明",
  sp: "必要SP",
  negative: "マイナスの効果",
};

const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function SkillList({ title, items }: { title: string; items: { skill: MasterSkill; note?: string }[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div>
      <button className="font-bold hover:underline" onClick={() => setOpen(!open)}>
        {open ? "▼" : "▶"} {title}({items.length}件)
      </button>
      {open && (
        <ul className="mt-1 max-h-64 overflow-y-auto rounded border border-slate-200 p-2 text-sm dark:border-slate-700">
          {items.map(({ skill, note }) => (
            <li key={skill.id} className="py-0.5">
              {skill.nameJa}
              {note && <span className="ml-2 text-slate-500 dark:text-slate-400">{note}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Choice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded border border-slate-300 dark:border-slate-600">
      {options.map((o) => (
        <button
          key={o.value}
          className={`px-3 py-1 text-sm ${
            value === o.value ? "bg-sky-600 font-bold text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DisplaySettings() {
  const { settings, update } = useSettings();
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <h3 className="text-lg font-bold">画面の見た目</h3>
      <div className="grid grid-cols-[10rem_1fr] items-center gap-y-3 text-sm">
        <span>明るさ</span>
        <Choice<Theme>
          value={settings.theme}
          onChange={(theme) => update({ theme })}
          options={[
            { value: "system", label: "Windows に合わせる" },
            { value: "light", label: "明るい" },
            { value: "dark", label: "暗い" },
          ]}
        />
        <span>文字の大きさ</span>
        <Choice<FontSize>
          value={settings.fontSize}
          onChange={(fontSize) => update({ fontSize })}
          options={[
            { value: "normal", label: "標準" },
            { value: "large", label: "大きめ" },
          ]}
        />
        <span>適性を隠す</span>
        <div className="space-y-1">
          <Choice<UiSettings["hideAptitudeAtOrBelow"]>
            value={settings.hideAptitudeAtOrBelow}
            onChange={(hideAptitudeAtOrBelow) => update({ hideAptitudeAtOrBelow })}
            options={[
              { value: "none", label: "隠さない" },
              { value: "G", label: "G" },
              { value: "F", label: "F以下" },
              { value: "E", label: "E以下" },
              { value: "D", label: "D以下" },
            ]}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            比べる人が全員この評価以下の適性(例:全員ダートが G)は、くらべる画面に出しません。
          </p>
        </div>
      </div>
    </section>
  );
}

export function SettingsPage() {
  const { status, skills, busy, refresh } = useSkillMaster();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h2 className="text-2xl font-bold">設定</h2>

      <DisplaySettings />

      <section className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <h3 className="text-lg font-bold">スキルの一覧</h3>
        {status ? (
          <dl className="grid grid-cols-[10rem_1fr] gap-y-1 text-sm">
            <dt className="text-slate-500 dark:text-slate-400">最終更新</dt>
            <dd>{fmtDate(status.file.fetchedAt).slice(0, 10)}</dd>
            <dt className="text-slate-500 dark:text-slate-400">件数</dt>
            <dd>
              {skills.length} 件
              {skills.length !== status.file.skills.length &&
                `(自分で追加した ${skills.length - status.file.skills.length} 件を含む)`}
            </dd>
            <dt className="text-slate-500 dark:text-slate-400">取得元</dt>
            <dd>
              <ExternalLink href={WIKI_SOURCE.url}>{WIKI_SOURCE.name}</ExternalLink>・
              <ExternalLink href={GAMETORA_SOURCE.url}>{GAMETORA_SOURCE.name}</ExternalLink>({ORIGIN_LABEL[status.origin]})
            </dd>
            <dt className="text-slate-500 dark:text-slate-400">最後に確認した日時</dt>
            <dd>{fmtDate(status.lastCheckedAt)}</dd>
          </dl>
        ) : (
          <p className="text-sm">読み込んでいます…</p>
        )}

        {status?.warning && (
          <p className="rounded bg-amber-100 p-2 text-sm text-amber-900 dark:bg-amber-900 dark:text-amber-50">
            {status.warning}
          </p>
        )}

        <button
          className="rounded bg-sky-600 px-4 py-2 font-bold text-white hover:bg-sky-700 disabled:opacity-50"
          disabled={busy}
          onClick={() => refresh(true)}
        >
          {busy ? "確認しています…" : "今すぐ新しくする"}
        </button>

        {status?.lastDiff && (
          <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
            <p className="text-sm">前回の更新({fmtDate(status.lastDiff.at)})で変わったスキル</p>
            <SkillList title="追加" items={status.lastDiff.added.map((s) => ({ skill: s }))} />
            <SkillList
              title="変更"
              items={status.lastDiff.changed.map((c) => ({
                skill: c.after,
                note: c.fields.map((f) => FIELD_LABEL[f] ?? f).join("・") + " が変わりました",
              }))}
            />
            <SkillList title="なくなった" items={status.lastDiff.removed.map((s) => ({ skill: s }))} />
          </div>
        )}
      </section>

      <UserSkillsSection />

      <AdvancedSettings />
    </div>
  );
}
