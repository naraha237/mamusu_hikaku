import type { ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

/** 既定のブラウザで開くリンク */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="text-sky-700 underline hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100"
      onClick={(e) => {
        e.preventDefault();
        openUrl(href).catch(() => {});
      }}
    >
      {children}
    </a>
  );
}
