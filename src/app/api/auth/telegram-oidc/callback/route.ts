import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createTelegramOidcResultPayloadIdentifier,
  createTelegramOidcToken,
  getTelegramOidcClientId,
  getTelegramOidcClientSecret,
  getTelegramOidcFinishPath,
  parseTelegramOidcStatePayloadIdentifier,
} from "@/lib/telegram-oidc";

const TELEGRAM_ISSUER = "https://oauth.telegram.org";
const telegramJwks = createRemoteJWKSet(new URL("https://oauth.telegram.org/.well-known/jwks.json"));

type TelegramOidcClaims = JWTPayload & {
  id?: string | number;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  username?: string;
  picture?: string;
};

function buildErrorRedirect(baseUrl: string, fallbackPath: string, message: string) {
  const url = new URL(fallbackPath, baseUrl);
  url.searchParams.set("telegramError", message);
  return NextResponse.redirect(url);
}

function getRequestOrigin(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.split(",")[0]?.trim() || requestUrl.host;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || requestUrl.protocol.replace(":", "") || "https";

  return `${protocol}://${host}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getSetCookieHeaders(headers: Headers) {
  const extendedHeaders = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof extendedHeaders.getSetCookie === "function") {
    return extendedHeaders.getSetCookie();
  }

  const headerValue = headers.get("set-cookie");
  return headerValue ? [headerValue] : [];
}

async function buildNextAuthCompletionResponse(baseUrl: string, resultToken: string) {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`, {
    cache: "no-store",
  });

  const csrfPayload = (await csrfResponse.json().catch(() => null)) as { csrfToken?: string } | null;
  const csrfToken = csrfPayload?.csrfToken?.trim();
  if (!csrfResponse.ok || !csrfToken) {
    throw new Error("csrf-bootstrap-failed");
  }

  const response = new NextResponse(
    `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Завершаем вход через Telegram</title>
  </head>
  <body>
    <form id="telegram-auth-complete" method="POST" action="/api/auth/callback/telegram">
      <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
      <input type="hidden" name="token" value="${escapeHtml(resultToken)}" />
      <input type="hidden" name="callbackUrl" value="/dashboard" />
    </form>
    <script>
      document.getElementById("telegram-auth-complete")?.submit();
    </script>
    <noscript>
      <p>Нажмите кнопку, чтобы завершить вход через Telegram.</p>
      <button type="submit" form="telegram-auth-complete">Продолжить</button>
    </noscript>
  </body>
</html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );

  for (const cookie of getSetCookieHeaders(csrfResponse.headers)) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}

export async function GET(request: NextRequest) {
  const baseUrl = getRequestOrigin(request);
  const clientId = getTelegramOidcClientId();
  const clientSecret = getTelegramOidcClientSecret();
  if (!clientId || !clientSecret) {
    return buildErrorRedirect(baseUrl, "/login", "Telegram Login не настроен.");
  }

  const code = request.nextUrl.searchParams.get("code")?.trim();
  const state = request.nextUrl.searchParams.get("state")?.trim();
  const providerError = request.nextUrl.searchParams.get("error")?.trim();

  if (providerError) {
    return buildErrorRedirect(baseUrl, "/login", "Telegram отменил авторизацию или вернул ошибку.");
  }

  if (!code || !state) {
    return buildErrorRedirect(baseUrl, "/login", "Telegram не вернул код авторизации.");
  }

  const stateRecord = await db.verificationToken.findUnique({ where: { token: state } });
  if (!stateRecord || stateRecord.expires < new Date()) {
    if (stateRecord) {
      await db.verificationToken.delete({ where: { token: state } }).catch(() => null);
    }

    return buildErrorRedirect(baseUrl, "/login", "Сессия входа через Telegram истекла. Попробуйте ещё раз.");
  }

  const statePayload = parseTelegramOidcStatePayloadIdentifier(stateRecord.identifier);
  if (!statePayload) {
    await db.verificationToken.delete({ where: { token: state } }).catch(() => null);
    return buildErrorRedirect(baseUrl, "/login", "Не удалось прочитать параметры входа через Telegram.");
  }

  const finishPath = getTelegramOidcFinishPath(statePayload.mode);
  const redirectUri = `${baseUrl}/api/auth/telegram-oidc/callback`;

  try {
    const tokenResponse = await fetch("https://oauth.telegram.org/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: statePayload.codeVerifier,
      }),
      cache: "no-store",
    });

    const tokenPayload = (await tokenResponse.json().catch(() => null)) as
      | {
          id_token?: string;
          error?: string;
          error_description?: string;
        }
      | null;

    if (!tokenResponse.ok || !tokenPayload?.id_token) {
      throw new Error(tokenPayload?.error_description || tokenPayload?.error || "token-exchange-failed");
    }

    const verification = await jwtVerify(tokenPayload.id_token, telegramJwks, {
      issuer: TELEGRAM_ISSUER,
      audience: clientId,
    });

    const claims = verification.payload as TelegramOidcClaims;
    if (claims.nonce !== statePayload.nonce) {
      throw new Error("invalid-nonce");
    }

    const telegramId = String(claims.id ?? claims.sub ?? "").trim();
    if (!telegramId) {
      throw new Error("missing-telegram-id");
    }

    const resultToken = createTelegramOidcToken();
    const firstName = claims.given_name?.trim() || null;
    const lastName = claims.family_name?.trim() || null;
    const fullName = claims.name?.trim() || [firstName, lastName].filter(Boolean).join(" ").trim() || null;

    await db.verificationToken.create({
      data: {
        token: resultToken,
        identifier: createTelegramOidcResultPayloadIdentifier({
          mode: statePayload.mode,
          legalAccepted: statePayload.legalAccepted,
          profile: {
            subject: String(claims.sub ?? telegramId),
            telegramId,
            username: claims.preferred_username?.trim() || claims.username?.trim() || null,
            firstName,
            lastName,
            fullName,
            picture: claims.picture?.trim() || null,
          },
        }),
        expires: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    await db.verificationToken.delete({ where: { token: state } }).catch(() => null);

    console.info("[telegram-oidc] callback-success", {
      mode: statePayload.mode,
      telegramId,
      username: claims.preferred_username?.trim() || claims.username?.trim() || null,
    });

    if (statePayload.mode === "connect") {
      const finishUrl = new URL(finishPath, baseUrl);
      finishUrl.searchParams.set("telegramConnectToken", resultToken);
      return NextResponse.redirect(finishUrl);
    }

    try {
      return await buildNextAuthCompletionResponse(baseUrl, resultToken);
    } catch (error) {
      console.error("[telegram-oidc] completion-bootstrap-failed", {
        mode: statePayload.mode,
        telegramId,
        error: error instanceof Error ? error.message : "unknown-error",
      });

      const finishUrl = new URL(finishPath, baseUrl);
      finishUrl.searchParams.set("telegramToken", resultToken);
      finishUrl.searchParams.set("telegramError", "Автоматическое завершение входа не сработало. Попробуйте ещё раз.");
      return NextResponse.redirect(finishUrl);
    }
  } catch (error) {
    await db.verificationToken.delete({ where: { token: state } }).catch(() => null);
    console.error("[telegram-oidc] callback-failed", {
      mode: statePayload.mode,
      error: error instanceof Error ? error.message : "unknown-error",
    });
    return buildErrorRedirect(
      baseUrl,
      finishPath,
      error instanceof Error ? `Не удалось завершить вход через Telegram: ${error.message}.` : "Не удалось завершить вход через Telegram.",
    );
  }
}
