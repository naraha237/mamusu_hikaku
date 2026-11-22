// docs/家族向けの使い方.md から、同じ内容の PDF を作る。
//   npm run docs:pdf
// Markdown を HTML にして、PC に入っている Chrome か Edge の「PDF に印刷」で PDF にする。
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { marked } from "marked";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = resolve(ROOT, "docs/家族向けの使い方.md");
const OUT = resolve(ROOT, "docs/家族向けの使い方.pdf");

const BROWSERS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];

const CSS = `
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: "Yu Gothic UI", "Meiryo", sans-serif; font-size: 11pt; line-height: 1.7; color: #1e293b; }
  h1 { font-size: 20pt; border-bottom: 3px solid #84cc16; padding-bottom: 4px; }
  h2 { font-size: 15pt; margin-top: 1.4em; border-left: 6px solid #84cc16; padding-left: 8px; page-break-after: avoid; }
  h3 { font-size: 12pt; margin-top: 1em; }
  blockquote { background: #eff6ff; border-left: 4px solid #3b82f6; margin: 0.5em 0; padding: 0.4em 1em; }
  code { background: #f1f5f9; padding: 0 4px; border-radius: 3px; font-size: 10pt; }
  table { border-collapse: collapse; width: 100%; font-size: 10pt; }
  th, td { border: 1px solid #cbd5e1; padding: 4px 8px; vertical-align: top; }
  th { background: #ecfccb; }
  hr { border: none; border-top: 1px dashed #cbd5e1; margin: 1.2em 0; }
  strong { color: #be123c; }
`;

const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) {
  console.error("Chrome か Edge が見つかりませんでした。");
  process.exit(1);
}

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>ウマ娘 比較ノート 使い方</title><style>${CSS}</style></head><body>${marked.parse(readFileSync(SRC, "utf8"))}</body></html>`;
const dir = mkdtempSync(join(tmpdir(), "mamusu-docs-"));
const htmlPath = join(dir, "guide.html");
writeFileSync(htmlPath, html);
try {
  execFileSync(browser, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${OUT}`, pathToFileURL(htmlPath).href], {
    stdio: "ignore",
  });
  console.log(`作りました: ${OUT}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
