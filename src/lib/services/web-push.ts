import { Prisma } from "@prisma/client";
import webpush from "web-push";
import { db } from "@/lib/db";

const VAPID_SETTING_KEY = "__web_push_vapid_keys";
const VAPID_SUBJECT = "mailto:support@efootball-nexon.com";

type VapidKeys = {
  publicKey: string;
  privateKey: string;
};

export type PhonePushPayload = {
  title: string;
  body: string;
  link?: string | null;
  tag?: string;
};

let vapidKeysPromise: Promise<VapidKeys> | null = null;

function parseVapidKeys(value: string | null | undefined): VapidKeys | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<VapidKeys>;
    return parsed.publicKey && parsed.privateKey
      ? { publicKey: parsed.publicKey, privateKey: parsed.privateKey }
      : null;
  } catch {
    return null;
  }
}

async function loadOrCreateVapidKeys() {
  const configuredPublicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const configuredPrivateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  if (configuredPublicKey && configuredPrivateKey) {
    return { publicKey: configuredPublicKey, privateKey: configuredPrivateKey };
  }

  const existing = await db.siteContent.findUnique({ where: { key: VAPID_SETTING_KEY } });
  const existingKeys = parseVapidKeys(existing?.body);
  if (existingKeys) return existingKeys;

  const generated = webpush.generateVAPIDKeys();
  try {
    await db.siteContent.create({
      data: { key: VAPID_SETTING_KEY, body: JSON.stringify(generated) },
    });
    return generated;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const concurrent = await db.siteContent.findUnique({ where: { key: VAPID_SETTING_KEY } });
    const concurrentKeys = parseVapidKeys(concurrent?.body);
    if (!concurrentKeys) throw new Error("Web Push VAPID keys could not be loaded");
    return concurrentKeys;
  }
}

async function getVapidKeys() {
  vapidKeysPromise ??= loadOrCreateVapidKeys();
  return vapidKeysPromise;
}

export async function getWebPushPublicKey() {
  return (await getVapidKeys()).publicKey;
}

export async function sendWebPushNotification(userId: string, payload: PhonePushPayload) {
  const subscriptions = await db.webPushSubscription.findMany({ where: { userId } });
  if (!subscriptions.length) return;

  const keys = await getVapidKeys();
  webpush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey);
  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.link || "/",
    tag: payload.tag || "efootball-nexon",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
  });

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          message,
        );
      } catch (error) {
        const statusCode = error && typeof error === "object" && "statusCode" in error
          ? Number(error.statusCode)
          : 0;
        if (statusCode === 404 || statusCode === 410) {
          await db.webPushSubscription.delete({ where: { id: subscription.id } }).catch(() => null);
          return;
        }
        console.error("Failed to send phone push notification", { userId, statusCode });
      }
    }),
  );
}
