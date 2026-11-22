import { invoke } from "@tauri-apps/api/core";

export type AppInfo = {
  version: string;
  /** インストーラー版なら true、単体exe版なら false */
  installed: boolean;
};

export type DefaultConfig = {
  update: { releasesPageUrl: string };
  [key: string]: unknown;
};

export const getAppInfo = () => invoke<AppInfo>("app_info");
export const getDefaultConfig = () => invoke<DefaultConfig>("default_config");
