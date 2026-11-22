import { useState, type ReactNode } from "react";
import { Button, inputClass, Notice } from "../components/ui";
import { SkillInput } from "../components/SkillInput";
import { useSkillMaster } from "../lib/skills/SkillMasterContext";
import { SKILL_TYPE_LABEL } from "../lib/skills/search";
import { useUmas } from "../lib/uma/UmaContext";
import {
  APTITUDE_ROWS,
  FACTOR_KIND_LABEL,
  getAptitude,
  GRADES,
  STAT_KEYS,
  STAT_LABEL,
  STAT_MAX,
  statTotal,
  type Aptitude,
  type Factor,
  type FactorKind,
  type Grade,
  type UmaEntry,
} from "../lib/uma/types";

const RANK_OPTIONS = ["UG", "SS+", "SS", "S+", "S", "A+", "A", "B+", "B", "C+", "C"];

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function GradePicker({ value, onChange }: { value: Grade; onChange: (g: Grade) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded border border-slate-300 dark:border-slate-600">
      {GRADES.map((g) => (
        <button
          key={g}
          type="button"
          className={`w-7 py-0.5 text-sm ${
            value === g ? "bg-sky-600 font-bold text-white" : "hover:bg-slate-100 dark:hover:bg-slate-700"
          }`}
          onClick={() => onChange(g)}
        >
          {g}
        </button>
      ))}
    </div>
  );
}

export function UmaEditor({ initial, onDone }: { initial: UmaEntry; onDone: () => void }) {
  const { save, umas } = useUmas();
  const { skills: master } = useSkillMaster();
  const [uma, setUma] = useState<UmaEntry>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isNew = !umas.some((u) => u.id === initial.id);
  const owners = [...new Set(umas.map((u) => u.owner).filter(Boolean))] as string[];

  const set = (patch: Partial<UmaEntry>) => setUma((u) => ({ ...u, ...patch }));

  const statErrors = STAT_KEYS.filter((k) => !Number.isInteger(uma.stats[k]) || uma.stats[k] < 0 || uma.stats[k] > STAT_MAX);

  const setAptitude = (group: keyof Aptitude, key: string, g: Grade) =>
    setUma((u) => ({ ...u, aptitude: { ...u.aptitude, [group]: { ...u.aptitude[group], [key]: g } } }));

  const onSave = async () => {
    if (!uma.name.trim()) {
      setError("ウマ娘の名前を入れてください。");
      return;
    }
    if (statErrors.length) {
      setError(`ステータスは 0〜${STAT_MAX} の数字で入れてください(${statErrors.map((k) => STAT_LABEL[k]).join("・")})。`);
      return;
    }
    setSaving(true);
    try {
      await save({ ...uma, name: uma.name.trim() });
      onDone();
    } catch {
      setError("保存できませんでした。もう一度「保存する」を押してください。");
    } finally {
      setSaving(false);
    }
  };

  const moveSkill = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= uma.skills.length) return;
    const list = [...uma.skills];
    [list[i], list[j]] = [list[j], list[i]];
    set({ skills: list });
  };

  const factors = uma.factors ?? [];
  const setFactor = (i: number, patch: Partial<Factor>) =>
    set({ factors: factors.map((f, k) => (k === i ? { ...f, ...patch } : f)) });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{isNew ? "ウマ娘を登録する" : "ウマ娘を直す"}</h2>
        <div className="flex gap-2">
          <Button onClick={onDone}>やめる</Button>
          <Button variant="primary" onClick={onSave} disabled={saving}>
            {saving ? "保存しています…" : "保存する"}
          </Button>
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Field label="ウマ娘の名前(必須)">
          <input className={inputClass} value={uma.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="衣装・二つ名">
          <input className={inputClass} value={uma.outfit ?? ""} onChange={(e) => set({ outfit: e.target.value || undefined })} />
        </Field>
        <Field label="メモ名" hint="例:チャンミ用逃げ">
          <input className={inputClass} value={uma.nickname ?? ""} onChange={(e) => set({ nickname: e.target.value || undefined })} />
        </Field>
        <Field label="誰の育成か" hint="例:父、妹">
          <input
            className={inputClass}
            list="owner-options"
            value={uma.owner ?? ""}
            onChange={(e) => set({ owner: e.target.value || undefined })}
          />
          <datalist id="owner-options">
            {owners.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </Field>
        <Field label="評価ランク">
          <input
            className={inputClass}
            list="rank-options"
            value={uma.rank ?? ""}
            onChange={(e) => set({ rank: e.target.value || undefined })}
          />
          <datalist id="rank-options">
            {RANK_OPTIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
        <Field label="評価点">
          <input
            className={inputClass}
            inputMode="numeric"
            value={uma.score ?? ""}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d]/g, "");
              set({ score: v ? Number(v) : undefined });
            }}
          />
        </Field>
        <Field label="タグ" hint="「、」か「,」で区切って複数入れられます">
          <input
            className={inputClass}
            value={(uma.tags ?? []).join("、")}
            onChange={(e) =>
              set({ tags: e.target.value.split(/[、,]/).map((t) => t.trim()).filter(Boolean) })
            }
          />
        </Field>
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-bold">ステータス(合計 {statTotal(uma.stats)})</h3>
        <div className="grid grid-cols-5 gap-3">
          {STAT_KEYS.map((k) => (
            <Field key={k} label={STAT_LABEL[k]}>
              <input
                className={`${inputClass} ${statErrors.includes(k) ? "border-rose-500" : ""}`}
                inputMode="numeric"
                value={uma.stats[k]}
                onChange={(e) => {
                  const v = e.target.value.normalize("NFKC").replace(/[^\d]/g, "");
                  set({ stats: { ...uma.stats, [k]: v ? Number(v) : 0 } });
                }}
              />
            </Field>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-bold">適性</h3>
        <div className="grid gap-x-6 gap-y-2 md:grid-cols-2">
          {APTITUDE_ROWS.map((r) => (
            <div key={r.group + r.key} className="flex items-center gap-3">
              <span className="w-24 text-sm text-slate-600 dark:text-slate-300">
                {r.groupLabel}・{r.label}
              </span>
              <GradePicker value={getAptitude(uma.aptitude, r.group, r.key)} onChange={(g) => setAptitude(r.group, r.key, g)} />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-bold">スキル({uma.skills.length}個)</h3>
        <SkillInput
          onPick={({ name, skill }) => {
            if (uma.skills.some((s) => (skill ? s.skillId === skill.id : s.name === name))) {
              setError(`「${name}」はもう入っています。`);
              return;
            }
            setError(null);
            set({
              skills: [
                ...uma.skills,
                { name, skillId: skill?.id, type: skill?.type, level: skill?.type === "unique" ? 1 : undefined },
              ],
            });
          }}
        />
        <ul className="divide-y divide-slate-200 rounded border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
          {uma.skills.length === 0 && <li className="p-2 text-sm text-slate-500">まだスキルがありません。</li>}
          {uma.skills.map((s, i) => {
            const m = s.skillId ? master.find((x) => x.id === s.skillId) : undefined;
            return (
              <li key={(s.skillId ?? s.name) + i} className="flex items-center gap-2 px-2 py-1">
                <span className="w-10 shrink-0 text-center text-xs text-slate-500">
                  {s.type ? SKILL_TYPE_LABEL[s.type] : ""}
                </span>
                <span className="flex-1">
                  {s.name}
                  {!m && (
                    <span className="ml-2 rounded bg-amber-100 px-1 text-xs text-amber-900 dark:bg-amber-900 dark:text-amber-50">
                      一覧にないスキル
                    </span>
                  )}
                </span>
                {s.type === "unique" && (
                  <label className="flex items-center gap-1 text-sm">
                    Lv
                    <select
                      className={inputClass}
                      value={s.level ?? 1}
                      onChange={(e) =>
                        set({ skills: uma.skills.map((x, k) => (k === i ? { ...x, level: Number(e.target.value) } : x)) })
                      }
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                )}
                <Button variant="ghost" className="px-2 py-0.5" onClick={() => moveSkill(i, -1)} aria-label="上へ">
                  ↑
                </Button>
                <Button variant="ghost" className="px-2 py-0.5" onClick={() => moveSkill(i, 1)} aria-label="下へ">
                  ↓
                </Button>
                <Button
                  variant="ghost"
                  className="px-2 py-0.5 text-rose-600"
                  onClick={() => set({ skills: uma.skills.filter((_, k) => k !== i) })}
                >
                  外す
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-bold">因子(入れなくてもかまいません)</h3>
        {factors.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <select className={inputClass} value={f.kind} onChange={(e) => setFactor(i, { kind: e.target.value as FactorKind })}>
              {(Object.keys(FACTOR_KIND_LABEL) as FactorKind[]).map((k) => (
                <option key={k} value={k}>
                  {FACTOR_KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <input
              className={`${inputClass} flex-1`}
              placeholder="因子の名前(例:スピード、中距離)"
              value={f.name}
              onChange={(e) => setFactor(i, { name: e.target.value })}
            />
            <select
              className={inputClass}
              value={f.stars}
              onChange={(e) => setFactor(i, { stars: Number(e.target.value) as 1 | 2 | 3 })}
            >
              <option value={1}>★1</option>
              <option value={2}>★2</option>
              <option value={3}>★3</option>
            </select>
            <Button variant="ghost" className="text-rose-600" onClick={() => set({ factors: factors.filter((_, k) => k !== i) })}>
              外す
            </Button>
          </div>
        ))}
        <Button onClick={() => set({ factors: [...factors, { kind: "blue", name: "", stars: 3 }] })}>因子を足す</Button>
      </section>

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
        <Button onClick={onDone}>やめる</Button>
        <Button variant="primary" onClick={onSave} disabled={saving}>
          {saving ? "保存しています…" : "保存する"}
        </Button>
      </div>
    </div>
  );
}
