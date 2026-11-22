// robots.txt を読んで、指定したパスの取得が許可されているか調べる(簡易版)。

type Group = { agents: string[]; rules: { allow: boolean; path: string }[] };

function parseRobots(text: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase().replace(/-/g, "");
    const value = m[2].trim();
    if (key === "useragent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!current) continue;
      if (key === "disallow" && value) current.rules.push({ allow: false, path: value });
      if (key === "allow" && value) current.rules.push({ allow: true, path: value });
    }
  }
  return groups;
}

/** userAgent(製品名の部分)で path を取得してよいか */
export function isAllowedByRobots(robotsTxt: string, path: string, userAgent: string): boolean {
  const groups = parseRobots(robotsTxt);
  const product = userAgent.split("/")[0].toLowerCase();
  const group =
    groups.find((g) => g.agents.some((a) => a !== "*" && product.includes(a))) ??
    groups.find((g) => g.agents.includes("*"));
  if (!group) return true;

  // 一番長く一致したルールを採用する
  let best: { allow: boolean; path: string } | null = null;
  for (const rule of group.rules) {
    if (path.startsWith(rule.path) && (!best || rule.path.length > best.path.length)) best = rule;
  }
  return best ? best.allow : true;
}
