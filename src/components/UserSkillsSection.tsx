import { useState } from "react";
import { SKILL_TYPE_LABEL } from "../lib/skills/search";
import { useSkillMaster } from "../lib/skills/SkillMasterContext";
import type { MasterSkill, SkillType } from "../lib/skills/types";
import { newId } from "../lib/uma/types";
import { Button, ConfirmDialog, inputClass } from "./ui";

/** 自分で追加したスキルの一覧(追加・編集・削除) */
export function UserSkillsSection() {
  const { userSkills, saveUserSkill, removeUserSkill } = useSkillMaster();
  const [editing, setEditing] = useState<MasterSkill | null>(null);
  const [deleting, setDeleting] = useState<MasterSkill | null>(null);

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex items-center gap-3">
        <h3 className="flex-1 text-lg font-bold">自分で追加したスキル</h3>
        <Button onClick={() => setEditing({ id: `user-${newId()}`, nameJa: "", type: "normal" })}>＋ 追加する</Button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        一覧にまだ載っていないスキルを登録できます。スキルの一覧が新しくなっても消えません。
      </p>
      {editing && (
        <div className="flex flex-wrap items-end gap-2 rounded bg-slate-50 p-3 dark:bg-slate-800">
          <label className="flex flex-col gap-1 text-sm">
            名前
            <input className={`${inputClass} w-56`} value={editing.nameJa} onChange={(e) => setEditing({ ...editing, nameJa: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            種類
            <select className={inputClass} value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as SkillType })}>
              {(Object.keys(SKILL_TYPE_LABEL) as SkillType[]).map((t) => (
                <option key={t} value={t}>
                  {SKILL_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            説明(なくてもよい)
            <input className={inputClass} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value || undefined })} />
          </label>
          <Button
            variant="primary"
            disabled={!editing.nameJa.trim()}
            onClick={async () => {
              await saveUserSkill({ ...editing, nameJa: editing.nameJa.trim() }).catch(() => {});
              setEditing(null);
            }}
          >
            保存
          </Button>
          <Button onClick={() => setEditing(null)}>やめる</Button>
        </div>
      )}
      {userSkills.length === 0 ? (
        <p className="text-sm text-slate-500">まだありません。</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded border border-slate-200 text-sm dark:divide-slate-700 dark:border-slate-700">
          {userSkills.map((s) => (
            <li key={s.id} className="flex items-center gap-2 px-2 py-1">
              <span className="w-10 text-center text-xs text-slate-500">{SKILL_TYPE_LABEL[s.type]}</span>
              <span className="flex-1">
                {s.nameJa}
                {s.description && <span className="ml-2 text-xs text-slate-500">{s.description}</span>}
              </span>
              <Button variant="ghost" className="px-2 py-0.5" onClick={() => setEditing(s)}>
                直す
              </Button>
              <Button variant="ghost" className="px-2 py-0.5 text-rose-600" onClick={() => setDeleting(s)}>
                消す
              </Button>
            </li>
          ))}
        </ul>
      )}
      {deleting && (
        <ConfirmDialog
          danger
          confirmLabel="消す"
          message={<p>「{deleting.nameJa}」を消しますか?(登録したウマ娘のスキルからは消えません)</p>}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await removeUserSkill(deleting.id).catch(() => {});
            setDeleting(null);
          }}
        />
      )}
    </section>
  );
}
