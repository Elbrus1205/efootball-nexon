import crypto from "crypto";

function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error("Email provider is not configured");
  }

  return { apiKey, from };
}

export function hashVerificationCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function generateVerificationCode() {
  return String(crypto.randomInt(100000, 1_000_000));
}

export async function sendEmailVerificationCode(params: {
  email: string;
  code: string;
}) {
  const { apiKey, from } = getEmailConfig();

  const html = `
    <div style="font-family:Arial,sans-serif;background:#1D1D1D;color:#fff;padding:24px">
      <div style="max-width:560px;margin:0 auto;background:#1D1D1D;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:28px">
        <div style="font-size:24px;font-weight:700;margin-bottom:8px">Подтверждение email</div>
        <div style="font-size:14px;line-height:1.6;color:#b7c0d1;margin-bottom:20px">
          Введите этот код в разделе безопасности, чтобы подтвердить адрес электронной почты.
        </div>
        <div style="font-size:34px;letter-spacing:10px;font-weight:700;background:#1D1D1D;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:18px 20px;text-align:center;margin-bottom:18px">
          ${params.code}
        </div>
        <div style="font-size:13px;line-height:1.6;color:#8f9bb2">
          Код действует 10 минут. Если это были не вы, просто проигнорируйте письмо.
        </div>
      </div>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(8_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: params.email,
      subject: "Код подтверждения email — eFootball Nexon",
      html,
    }),
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    throw new Error(payload || "Failed to send email");
  }
}

export async function sendGuardianConsentCode(params: {
  email: string;
  code: string;
}) {
  const { apiKey, from } = getEmailConfig();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "https://efootball-nexon.com";

  const html = `
    <div style="font-family:Arial,sans-serif;background:#1D1D1D;color:#fff;padding:24px">
      <div style="max-width:560px;margin:0 auto;background:#1D1D1D;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:28px">
        <div style="font-size:24px;font-weight:700;margin-bottom:8px">Согласие законного представителя</div>
        <div style="font-size:14px;line-height:1.7;color:#b7c0d1;margin-bottom:18px">
          Ваш email указан при регистрации пользователя 12–17 лет. Передайте код регистрирующемуся только в том случае, если вы являетесь его законным представителем, ознакомились с документами сайта и согласны на обработку персональных данных несовершеннолетнего и публикацию его турнирного профиля.
        </div>
        <div style="font-size:34px;letter-spacing:10px;font-weight:700;background:#1D1D1D;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:18px 20px;text-align:center;margin-bottom:18px">
          ${params.code}
        </div>
        <div style="font-size:13px;line-height:1.7;color:#8f9bb2;margin-bottom:14px">
          Код действует 10 минут. Использование кода подтверждает ваше согласие. Если вы не давали согласия на регистрацию, никому не сообщайте код.
        </div>
        <div style="font-size:13px;line-height:1.7">
          <a href="${appUrl}/terms" style="color:#21F1A8">Пользовательское соглашение</a><br />
          <a href="${appUrl}/consent" style="color:#21F1A8">Согласие на обработку персональных данных</a><br />
          <a href="${appUrl}/privacy" style="color:#21F1A8">Политика обработки персональных данных</a>
        </div>
      </div>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(8_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: params.email,
      subject: "Согласие представителя — eFootball Nexon",
      html,
    }),
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    throw new Error(payload || "Failed to send guardian consent email");
  }
}

export async function sendPasswordResetLink(params: {
  email: string;
  resetUrl: string;
}) {
  const { apiKey, from } = getEmailConfig();

  const html = `
    <div style="font-family:Arial,sans-serif;background:#1D1D1D;color:#fff;padding:24px">
      <div style="max-width:560px;margin:0 auto;background:#1D1D1D;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:28px">
        <div style="font-size:24px;font-weight:700;margin-bottom:8px">Сброс пароля</div>
        <div style="font-size:14px;line-height:1.6;color:#b7c0d1;margin-bottom:20px">
          Нажмите на кнопку ниже, чтобы задать новый пароль для аккаунта eFootball Nexon.
        </div>
        <a href="${params.resetUrl}" style="display:inline-block;background:#21F1A8;color:#1D1D1D;text-decoration:none;font-weight:700;border-radius:12px;padding:14px 18px;margin-bottom:18px">
          Сменить пароль
        </a>
        <div style="font-size:13px;line-height:1.7;color:#8c96aa">
          Ссылка действует 1 час. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.
        </div>
      </div>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(8_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: params.email,
      subject: "Сброс пароля — eFootball Nexon",
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to send email");
  }
}

export async function sendPasswordChangeCode(params: {
  email: string;
  code: string;
}) {
  const { apiKey, from } = getEmailConfig();

  const html = `
    <div style="font-family:Arial,sans-serif;background:#1D1D1D;color:#fff;padding:24px">
      <div style="max-width:560px;margin:0 auto;background:#1D1D1D;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:28px">
        <div style="font-size:24px;font-weight:700;margin-bottom:8px">Подтверждение смены пароля</div>
        <div style="font-size:14px;line-height:1.6;color:#b7c0d1;margin-bottom:20px">
          Введите этот код в разделе безопасности, чтобы подтвердить создание или смену пароля.
        </div>
        <div style="font-size:34px;letter-spacing:10px;font-weight:700;background:#1D1D1D;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:18px 20px;text-align:center;margin-bottom:18px">
          ${params.code}
        </div>
        <div style="font-size:13px;line-height:1.7;color:#8c96aa">
          Код действует 10 минут. Если вы не запрашивали смену пароля, просто проигнорируйте это письмо.
        </div>
      </div>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(8_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: params.email,
      subject: "Код подтверждения смены пароля",
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to send email");
  }
}

export async function sendAccountDeletionCode(params: {
  email: string;
  code: string;
}) {
  const { apiKey, from } = getEmailConfig();

  const html = `
    <div style="font-family:Arial,sans-serif;background:#1D1D1D;color:#fff;padding:24px">
      <div style="max-width:560px;margin:0 auto;background:#1D1D1D;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:28px">
        <div style="font-size:24px;font-weight:700;margin-bottom:8px">Подтверждение удаления аккаунта</div>
        <div style="font-size:14px;line-height:1.7;color:#b7c0d1;margin-bottom:20px">
          Введите этот код в Danger Zone, чтобы подтвердить удаление аккаунта. Для завершения также потребуются пароль и код из Telegram.
        </div>
        <div style="font-size:34px;letter-spacing:10px;font-weight:700;background:#1D1D1D;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:18px 20px;text-align:center;margin-bottom:18px">
          ${params.code}
        </div>
        <div style="font-size:13px;line-height:1.7;color:#8c96aa">
          Код действует 10 минут. Если вы не запрашивали удаление аккаунта, просто проигнорируйте это письмо.
        </div>
      </div>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(8_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: params.email,
      subject: "Код подтверждения удаления аккаунта",
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to send email");
  }
}
