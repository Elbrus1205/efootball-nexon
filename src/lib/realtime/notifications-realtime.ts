const REALTIME_EVENT = "notification:new";

export function userNotificationChannel(userId: string) {
  return `user-${userId}`;
}

export function isRealtimeConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Отправляет broadcast-сообщение в канал Supabase Realtime через HTTP-эндпоинт.
 * HTTP используется вместо WebSocket, потому что серверные обработчики
 * короткоживущие (serverless) — держать сокет незачем.
 */
export async function broadcastNotification(userId: string, payload: Record<string, unknown>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return;

  const response = await fetch(`${url}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      messages: [
        {
          topic: userNotificationChannel(userId),
          event: REALTIME_EVENT,
          payload,
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Realtime broadcast failed: ${response.status} ${detail}`);
  }
}

export const NOTIFICATION_REALTIME_EVENT = REALTIME_EVENT;
