import { openUrl } from "@tauri-apps/plugin-opener";
import { useState, type ReactNode } from "react";
import { Portrait, SkillIcon } from "../components/SkillIcon";
import { SkillInput } from "../components/SkillInput";
import { Button, inputClass, Notice } from "../components/ui";
import type { FieldReview, ReviewSkill } from "../lib/ocr/buildDraft";
import { GAMETORA_SOURCE } from "../lib/skills/constants";
import { SKILL_TYPE_LABEL } from "../lib/skills/search";
import { useSkillMaster } from "../lib/skills/SkillMasterContext";
import type { MasterSkill, SkillType } from "../lib/skills/types";
import { useUmas } from "../lib/uma/UmaContext";
import {
  APTITUDE_ROWS,
  FACTOR_KIND_LABEL,
  getAptitude,
  GRADES,
  newId,
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

/** 取り込んだ画像から作ったときの、確認用の情報 */
export type EditorReview = {
  fields: Record<string, FieldReview>;
  images: { url: string; name: string }[];
};

const CHECK_RING = "ring-2 ring-amber-400 bg-amber-50 dark:bg-amber-950";

function Field({ label, children, hint, check }: { label: string; children: ReactNode; hint?: string; check?: FieldReview }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-600 dark:text-slate-300">
        {label}
        {check?.status === "check" && <span className="ml-1 text-amber-600">要確認</span>}
      </span>
      {children}
      {check?.reason && <span className="text-xs text-amber-700 dark:text-amber-300">{check.reason}</span>}
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function GradePicker({ value, onChange, check }: { value: Grade; onChange: (g: Grade) => void; check?: boolean }) {
  return (
    <div className={`inline-flex overflow-hidden rounded border border-slate-300 dark:border-slate-600 ${check ? CHECK_RING : ""}`}>
      {GRADES.map((g) => (
        <button
          key={g}
          type="button"
          className={`w-7 py-0.5 text-sm ${value === g ? "bg-sky-600 font-bold text-white" : "hover:bg-slate-100 dark:hover:bg-slate-700"}`}
          onClick={() => onChange(g)}
        >
          {g}
        </button>
      ))}
    </div>
  );
}

/** 元の画像を見るための欄(取り込みのときだけ) */
function ImageViewer({ images }: { images: { url: string; name: string }[] }) {
  const [index, setIndex] = useState(0);
  const current = images[index];
  return (
    <div className="space-y-2 lg:sticky lg:top-4 lg:self-start">
      <p className="text-sm font-bold">取り込んだ画像</p>
      {current && <img src={current.url} alt={current.name} className="w-full rounded border border-slate-200 dark:border-slate-700" />}
      <div className="flex flex-wrap gap-1">
        {images.map((img, i) => (
          <button
            key={img.url}
            className={`h-12 w-20 overflow-hidden rounded border-2 ${i === index ? "border-sky-500" : "border-transparent"}`}
            onClick={() => setIndex(i)}
            title={img.name}
          >
            <img src={img.url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** 一覧にないスキルを、自分のスキルとして登録する小窓 */
function RegisterSkill({ name, onDone, onCancel }: { name: string; onDone: (s: MasterSkill) => void; onCancel: () => void }) {
  const { saveUserSkill } = useSkillMaster();
  const [nameJa, setNameJa] = useState(name);
  const [type, setType] = useState<SkillType>("normal");
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 rounded bg-white p-2 text-sm dark:bg-slate-800">
      <input className={`${inputClass} w-56`} value={nameJa} onChange={(e) => setNameJa(e.target.value)} />
      <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as SkillType)}>
        {(Object.keys(SKILL_TYPE_LABEL) as SkillType[]).map((t) => (
          <option key={t} value={t}>
            {SKILL_TYPE_LABEL[t]}
          </option>
        ))}
      </select>
      <Button
        variant="primary"
        disabled={!nameJa.trim()}
        onClick={async () => {
          const skill: MasterSkill = { id: `user-${newId()}`, nameJa: nameJa.trim(), type };
          await saveUserSkill(skill).catch(() => {});
          onDone(skill);
        }}
      >
        登録する
      </Button>
      <Button onClick={onCancel}>やめる</Button>
    </div>
  );
}

export function UmaEditor({
  initial,
  initialSkills,
  review,
  onDone,
}: {
  initial: UmaEntry;
  /** 確認用の情報つきのスキル(取り込みのとき) */
  initialSkills?: ReviewSkill[];
  review?: EditorReview;
  onDone: () => void;
}) {
  const { save, umas } = useUmas();
  const { skills: master } = useSkillMaster();
  const [uma, setUma] = useState<UmaEntry>(initial);
  const [skills, setSkills] = useState<ReviewSkill[]>(initialSkills ?? initial.skills);
  const [fields, setFields] = useState<Record<string, FieldReview>>(review?.fields ?? {});
  const [registering, setRegistering] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isNew = !umas.some((u) => u.id === initial.id);
  const owners = [...new Set(umas.map((u) => u.owner).filter(Boolean))] as string[];
  const masterById = new Map(master.map((m) => [m.id, m]));

  const set = (patch: Partial<UmaEntry>) => setUma((u) => ({ ...u, ...patch }));
  /** 手で直した項目は「要確認」を外す */
  const touched = (key: string) =>
    setFields((f) => {
      if (!f[key]) return f;
      const next = { ...f };
      delete next[key];
      return next;
    });

  const statErrors = STAT_KEYS.filter((k) => !Number.isInteger(uma.stats[k]) || uma.stats[k] < 0 || uma.stats[k] > STAT_MAX);
  const checkCount =
    Object.values(fields).filter((f) => f.status === "check").length + skills.filter((s) => s.review && s.review.status !== "ok").length;

  const setAptitude = (group: keyof Aptitude, key: string, g: Grade) => {
    touched(`aptitude.${group}.${key}`);
    setUma((u) => ({ ...u, aptitude: { ...u.aptitude, [group]: { ...u.aptitude[group], [key]: g } } }));
  };

  const setSkill = (i: number, patch: Partial<ReviewSkill>) => setSkills((list) => list.map((s, k) => (k === i ? { ...s, ...patch } : s)));

  /** 候補のスキルに置き換え、「確認済み」にする */
  const chooseSkill = (i: number, m: MasterSkill) =>
    setSkill(i, {
      skillId: m.id,
      name: m.nameJa,
      type: m.type,
      level: m.type === "unique" ? (skills[i].level ?? 1) : undefined,
      review: skills[i].review ? { ...skills[i].review!, status: "ok", reason: undefined } : undefined,
    });

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
      // 確認用の情報は保存しない
      const cleanSkills = skills.map(({ review: _review, ...s }) => s);
      await save({ ...uma, name: uma.name.trim(), skills: cleanSkills });
      onDone();
    } catch {
      setError("保存できませんでした。もう一度「保存する」を押してください。");
    } finally {
      setSaving(false);
    }
  };

  const moveSkill = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= skills.length) return;
    const list = [...skills];
    [list[i], list[j]] = [list[j], list[i]];
    setSkills(list);
  };

  const factors = uma.factors ?? [];
  const setFactor = (i: number, patch: Partial<Factor>) => set({ factors: factors.map((f, k) => (k === i ? { ...f, ...patch } : f)) });

  const form = (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Portrait png={uma.portrait} size={56} />
        <h2 className="flex-1 text-2xl font-bold">{review ? "読み取った内容を確かめる" : isNew ? "ウマ娘を登録する" : "ウマ娘を直す"}</h2>
        <Button onClick={onDone}>やめる</Button>
        <Button variant="primary" onClick={onSave} disabled={saving}>
          {saving ? "保存しています…" : "保存する"}
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {review && (
        <Notice tone={checkCount ? "warn" : "info"}>
          {checkCount
            ? `黄色の項目(${checkCount}か所)は、読み取りが不確かです。左の画像と見比べて、違っていたら直してください。`
            : "読み取った内容に、気になるところはありませんでした。念のため左の画像と見比べてから保存してください。"}
        </Notice>
      )}

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Field label="ウマ娘の名前(必須)" check={fields.name}>
          <input
            className={`${inputClass} ${fields.name ? CHECK_RING : ""}`}
            value={uma.name}
            onChange={(e) => {
              touched("name");
              set({ name: e.target.value });
            }}
          />
        </Field>
        <Field label="衣装・二つ名" check={fields.outfit}>
          <input
            className={`${inputClass} ${fields.outfit ? CHECK_RING : ""}`}
            value={uma.outfit ?? ""}
            onChange={(e) => {
              touched("outfit");
              set({ outfit: e.target.value || undefined });
            }}
          />
        </Field>
        <Field label="メモ名" hint="例:チャンミ用逃げ">
          <input className={inputClass} value={uma.nickname ?? ""} onChange={(e) => set({ nickname: e.target.value || undefined })} />
        </Field>
        <Field label="誰の育成か" hint="例:父、妹">
          <input className={inputClass} list="owner-options" value={uma.owner ?? ""} onChange={(e) => set({ owner: e.target.value || undefined })} />
          <datalist id="owner-options">
            {owners.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </Field>
        <Field label="評価ランク" hint={review ? "ランクは画面から読み取れないので、手で入れてください" : undefined}>
          <input className={inputClass} list="rank-options" value={uma.rank ?? ""} onChange={(e) => set({ rank: e.target.value || undefined })} />
          <datalist id="rank-options">
            {RANK_OPTIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
        <Field label="評価点" check={fields.score}>
          <input
            className={`${inputClass} ${fields.score ? CHECK_RING : ""}`}
            inputMode="numeric"
            value={uma.score ?? ""}
            onChange={(e) => {
              touched("score");
              const v = e.target.value.normalize("NFKC").replace(/[^\d]/g, "");
              set({ score: v ? Number(v) : undefined });
            }}
          />
        </Field>
        <Field label="タグ" hint="「、」か「,」で区切って複数入れられます">
          <input
            className={inputClass}
            value={(uma.tags ?? []).join("、")}
            onChange={(e) => set({ tags: e.target.value.split(/[、,]/).map((t) => t.trim()).filter(Boolean) })}
          />
        </Field>
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-bold">ステータス(合計 {statTotal(uma.stats)})</h3>
        <div className="grid grid-cols-5 gap-3">
          {STAT_KEYS.map((k) => (
            <Field key={k} label={STAT_LABEL[k]} check={fields[`stats.${k}`]}>
              <input
                className={`${inputClass} ${statErrors.includes(k) ? "border-rose-500" : ""} ${fields[`stats.${k}`] ? CHECK_RING : ""}`}
                inputMode="numeric"
                value={uma.stats[k]}
                onChange={(e) => {
                  touched(`stats.${k}`);
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
          {APTITUDE_ROWS.map((r) => {
            const key = `aptitude.${r.group}.${r.key}`;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="w-24 text-sm text-slate-600 dark:text-slate-300">
                  {r.groupLabel}・{r.label}
                </span>
                <GradePicker value={getAptitude(uma.aptitude, r.group, r.key)} onChange={(g) => setAptitude(r.group, r.key, g)} check={!!fields[key]} />
                {fields[key] && <span className="text-xs text-amber-700 dark:text-amber-300">要確認</span>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-bold">スキル({skills.length}個)</h3>
        <SkillInput
          onPick={({ name, skill }) => {
            if (skills.some((s) => (skill ? s.skillId === skill.id : s.name === name))) {
              setError(`「${name}」はもう入っています。`);
              return;
            }
            setError(null);
            setSkills([...skills, { name, skillId: skill?.id, type: skill?.type, level: skill?.type === "unique" ? 1 : undefined }]);
          }}
        />
        <ul className="divide-y divide-slate-200 rounded border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
          {skills.length === 0 && <li className="p-2 text-sm text-slate-500">まだスキルがありません。</li>}
          {skills.map((s, i) => {
            const m = s.skillId ? masterById.get(s.skillId) : undefined;
            const r = s.review;
            const rowColor =
              r?.status === "check" ? "bg-amber-50 dark:bg-amber-950" : r?.status === "unknown" || !m ? "bg-orange-50 dark:bg-orange-950" : "";
            return (
              <li key={(s.skillId ?? s.name) + i} className={`px-2 py-1 ${rowColor}`}>
                <div className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-center text-xs text-slate-500">{s.type ? SKILL_TYPE_LABEL[s.type] : ""}</span>
                  <SkillIcon iconId={m?.iconId} />
                  <span className="flex-1">
                    {s.name}
                    {r?.status === "check" && (
                      <span className="ml-2 rounded bg-amber-200 px-1 text-xs text-amber-900 dark:bg-amber-800 dark:text-amber-50">要確認</span>
                    )}
                    {!m && (
                      <span className="ml-2 rounded bg-orange-200 px-1 text-xs text-orange-900 dark:bg-orange-800 dark:text-orange-50">
                        新しいスキルかもしれません
                      </span>
                    )}
                  </span>
                  {s.type === "unique" && (
                    <label className="flex items-center gap-1 text-sm">
                      Lv
                      <select className={inputClass} value={s.level ?? 1} onChange={(e) => setSkill(i, { level: Number(e.target.value) })}>
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {r && r.status !== "ok" && m && (
                    <Button variant="ghost" className="px-2 py-0.5 text-emerald-700" onClick={() => setSkill(i, { review: { ...r, status: "ok", reason: undefined } })}>
                      これで合っている
                    </Button>
                  )}
                  <Button variant="ghost" className="px-2 py-0.5" onClick={() => moveSkill(i, -1)} aria-label="上へ">
                    ↑
                  </Button>
                  <Button variant="ghost" className="px-2 py-0.5" onClick={() => moveSkill(i, 1)} aria-label="下へ">
                    ↓
                  </Button>
                  <Button variant="ghost" className="px-2 py-0.5 text-rose-600" onClick={() => setSkills(skills.filter((_, k) => k !== i))}>
                    外す
                  </Button>
                </div>
                {r && r.status !== "ok" && (
                  <div className="ml-12 space-y-1 pb-1 text-xs">
                    <div className="text-slate-600 dark:text-slate-300">
                      読み取った文字:「{r.ocrText}」{r.reason && `(${r.reason})`}
                    </div>
                    {r.alternatives.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span>これかも:</span>
                        {r.alternatives.map((alt) => (
                          <button
                            key={alt.id}
                            className={`rounded border px-2 py-0.5 ${
                              alt.id === s.skillId ? "border-sky-500 bg-sky-100 font-bold dark:bg-sky-900" : "border-slate-300 hover:bg-white dark:border-slate-600 dark:hover:bg-slate-800"
                            }`}
                            onClick={() => chooseSkill(i, alt)}
                          >
                            {alt.nameJa}
                          </button>
                        ))}
                      </div>
                    )}
                    {!m && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button className="px-2 py-0.5 text-xs" onClick={() => setRegistering(i)}>
                          自分のスキルとして登録
                        </Button>
                        <Button className="px-2 py-0.5 text-xs" onClick={() => openUrl(GAMETORA_SOURCE.url).catch(() => {})}>
                          GameTora で調べる
                        </Button>
                      </div>
                    )}
                    {registering === i && (
                      <RegisterSkill
                        name={s.name}
                        onCancel={() => setRegistering(null)}
                        onDone={(skill) => {
                          setRegistering(null);
                          chooseSkill(i, skill);
                        }}
                      />
                    )}
                  </div>
                )}
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
            <select className={inputClass} value={f.stars} onChange={(e) => setFactor(i, { stars: Number(e.target.value) as 1 | 2 | 3 })}>
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

  if (!review) return <div className="mx-auto max-w-4xl p-6">{form}</div>;
  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[minmax(320px,2fr)_3fr]">
      <ImageViewer images={review.images} />
      {form}
    </div>
  );
}
