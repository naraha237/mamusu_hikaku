import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// @ts-expect-error type error without @types/node package
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

/**
 * 開発用:ブラウザで画面を確かめるとき、画像の読み取りを Rust の試験用プログラム
 * (src-tauri/target/release/examples/analyze.exe)で行う。npm run dev のときだけ動く。
 */
function devAnalyzePlugin(): Plugin {
  return {
    name: "dev-analyze",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__dev/analyze", async (req, res) => {
        const { execFile } = await import("node:child_process");
        const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
        const { tmpdir } = await import("node:os");
        const { join } = await import("node:path");
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => {
          const dir = mkdtempSync(join(tmpdir(), "mamusu-"));
          const file = join(dir, "image.bin");
          writeFileSync(file, Buffer.concat(chunks));
          const exe = join(process.cwd(), "src-tauri/target/release/examples/analyze.exe");
          execFile(exe, [file], { env: { ...process.env, MAMUSU_KEEP_PORTRAIT: "1" }, maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
            rmSync(dir, { recursive: true, force: true });
            res.setHeader("Content-Type", "application/json");
            if (err) {
              res.statusCode = 500;
              res.end(JSON.stringify(String(err)));
            } else res.end(stdout);
          });
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), devAnalyzePlugin()],

  // 同梱のスキル一覧(約640KB)を含むため、警告の目安を上げる
  build: { chunkSizeWarningLimit: 2000 },

  // Tauri 用の設定(`tauri dev` / `tauri build` のときに使う)
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
