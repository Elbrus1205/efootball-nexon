"use client";

import { Auth, Config, ConfigAuthMode } from "@vkid/sdk";

const VK_INTENT_KEY = "vkid:intent";

export type VkAuthIntent = {
  mode: "auth" | "bind";
  callbackUrl: string;
  legalAccepted?: boolean;
  appId?: number;
};

function getCanonicalOrigin() {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

function getVkAppId(appIdOverride?: string | number | null) {
  const raw = String(appIdOverride ?? process.env.NEXT_PUBLIC_VK_APP_ID ?? "").trim();
  if (!raw) return null;

  const appId = Number(raw);
  return Number.isFinite(appId) ? appId : null;
}

function getVkRedirectUrl() {
  return `${getCanonicalOrigin()}/vk/callback`;
}

export function initVkId(appIdOverride?: string | number | null) {
  const appId = getVkAppId(appIdOverride);

  if (!appId) {
    throw new Error("VK ID не настроен.");
  }

  Config.init({
    app: appId,
    redirectUrl: getVkRedirectUrl(),
    mode: ConfigAuthMode.Redirect,
    scope: "email",
  });

  return {
    appId,
    redirectUrl: getVkRedirectUrl(),
  };
}

export function saveVkIntent(intent: VkAuthIntent) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(VK_INTENT_KEY, JSON.stringify(intent));
}

export function readVkIntent(): VkAuthIntent | null {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(VK_INTENT_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as VkAuthIntent;
  } catch {
    return null;
  }
}

export function clearVkIntent() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(VK_INTENT_KEY);
}

export async function startVkIdAuth(intent: VkAuthIntent, appIdOverride?: string | number | null) {
  try {
    const { appId } = initVkId(appIdOverride ?? intent.appId);
    saveVkIntent({ ...intent, appId });
    await Auth.login();
  } catch (error) {
    clearVkIntent();
    throw error;
  }
}

export async function exchangeVkCode(code: string, deviceId: string, appIdOverride?: string | number | null) {
  initVkId(appIdOverride);
  return Auth.exchangeCode(code, deviceId);
}
