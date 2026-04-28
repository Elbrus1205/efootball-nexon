import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createTelegramOidcCodeChallenge,
  createTelegramOidcNonce,
  createTelegramOidcPkceVerifier,
  createTelegramOidcStatePayloadIdentifier,
  createTelegramOidcToken,
  getTelegramOidcClientId,
  getTelegramOidcClientSecret,
  type TelegramOidcMode,
} from "@/lib/telegram-oidc";

function normalizeMode(value?: string | null): TelegramOidcMode {
  return value === "register" || value === "connect" ? value : "login";
}

function getRequestOrigin(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.split(",")[0]?.trim() || requestUrl.host;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || requestUrl.protocol.replace(":", "") || "https";

  return `${protocol}://${host}`;
}

export async function GET(request: NextRequest) {
  const clientId = getTelegramOidcClientId();
  const clientSecret = getTelegramOidcClientSecret();
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Telegram Login is not configured." }, { status: 500 });
  }

  const mode = normalizeMode(request.nextUrl.searchParams.get("mode"));
  const legalAccepted = request.nextUrl.searchParams.get("legalAccepted") === "1";
  const state = createTelegramOidcToken();
  const codeVerifier = createTelegramOidcPkceVerifier();
  const nonce = createTelegramOidcNonce();
  const codeChallenge = createTelegramOidcCodeChallenge(codeVerifier);
  const baseUrl = getRequestOrigin(request);
  const redirectUri = `${baseUrl}/api/auth/telegram-oidc/callback`;

  await db.verificationToken.create({
    data: {
      token: state,
      identifier: createTelegramOidcStatePayloadIdentifier({
        mode,
        legalAccepted,
        nonce,
        codeVerifier,
      }),
      expires: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const authorizationUrl = new URL("https://oauth.telegram.org/auth");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", "openid profile telegram:bot_access");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("nonce", nonce);
  authorizationUrl.searchParams.set("code_challenge", codeChallenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(authorizationUrl);
}
