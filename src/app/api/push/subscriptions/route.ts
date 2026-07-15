import { z } from "zod";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getWebPushPublicKey } from "@/lib/services/web-push";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function GET() {
  await requireAuth();
  return NextResponse.json({ publicKey: await getWebPushPublicKey() });
}

export async function POST(request: Request) {
  const session = await requireAuth();
  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректная push-подписка." }, { status: 400 });
  }

  await db.webPushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    create: {
      userId: session.user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    },
    update: {
      userId: session.user.id,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await requireAuth();
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!endpoint) return NextResponse.json({ error: "Push-подписка не указана." }, { status: 400 });

  await db.webPushSubscription.deleteMany({
    where: { endpoint, userId: session.user.id },
  });
  return NextResponse.json({ ok: true });
}
