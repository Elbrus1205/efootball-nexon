"use client";

import { Auth, Config, ConfigAuthMode } from "@vkid/sdk";

const VK_INTENT_KEY = "vkid:intent";

export type VkAuthIntent = {
  mode: "auth" | "bind";
  callbackUrl: string;
  legalAccepted?: boolean;
};

function getCanonicalOrigin() {
  if (typeof window === "undefined") return "";

  const host = window.location.hostname.toLowerCase();
  const protocol = window.location.protocol;

  if (host === "efootball-nexon.ru") {
    return `${protocol}//www.efootball-nexon.ru`;
  }

  return window.location.origin;
}

function getVkAppId() {
  const raw = process.env.NEXT_PUBLIC_VK_APP_ID?.trim();
  if (!raw) return null;

  const appId = Number(raw);
  return Number.isFinite(appId) ? appId : null;
}

function getVkRedirectUrl() {
  return `${getCanonicalOrigin()}/vk/callback`;
}

export function initVkId() {
  const appId = getVkAppId();

  if (!appId) {
    throw new Error("VK ID is not configured.");
  }

  Config.init({
    app: appId,
    redirectUrl: getVkRedirectUrl(),
    mode: ConfigAuthMode.Redirect,
    scope: "",
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

export async function startVkIdAuth(intent: VkAuthIntent) {
  initVkId();
  saveVkIntent(intent);
  await Auth.login();
}

export async function exchangeVkCode(code: string, deviceId: string) {
  initVkId();
  return Auth.exchangeCode(code, deviceId);
}
