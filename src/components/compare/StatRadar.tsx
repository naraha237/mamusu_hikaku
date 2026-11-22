import { useState } from "react";
import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { COLUMN_COLORS } from "../../lib/compare";
import { STAT_KEYS, STAT_LABEL, umaLabel, type UmaEntry } from "../../lib/uma/types";

/** ステータス5種を重ねたレーダーチャート。凡例をクリックで表示/非表示 */
export function StatRadar({ umas }: { umas: UmaEntry[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const data = STAT_KEYS.map((k) => {
    const row: Record<string, string | number> = { stat: STAT_LABEL[k] };
    for (const u of umas) row[u.id] = u.stats[k];
    return row;
  });
  const max = Math.max(1200, ...umas.flatMap((u) => STAT_KEYS.map((k) => u.stats[k])));

  return (
    <div className="h-96 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke="#94a3b8" strokeOpacity={0.4} />
          <PolarAngleAxis dataKey="stat" tick={{ fill: "currentColor", fontSize: 13 }} />
          <PolarRadiusAxis domain={[0, Math.ceil(max / 100) * 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} angle={90} />
          {umas.map((u, i) => (
            <Radar
              key={u.id}
              name={umaLabel(u)}
              dataKey={u.id}
              stroke={COLUMN_COLORS[i % COLUMN_COLORS.length].line}
              fill={COLUMN_COLORS[i % COLUMN_COLORS.length].line}
              fillOpacity={0.12}
              strokeWidth={2}
              hide={hidden.has(u.id)}
            />
          ))}
          <Tooltip contentStyle={{ background: "rgba(15,23,42,0.9)", border: "none", color: "#fff" }} />
          <Legend
            onClick={(e) => {
              const id = String(e.dataKey);
              setHidden((h) => {
                const next = new Set(h);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            wrapperStyle={{ cursor: "pointer" }}
            formatter={(value, entry) => (
              <span style={{ opacity: hidden.has(String(entry.dataKey)) ? 0.35 : 1 }}>{value}</span>
            )}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
