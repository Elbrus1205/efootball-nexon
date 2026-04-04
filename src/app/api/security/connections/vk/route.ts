import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { fetchVkUserProfile } from "@/lib/auth/vk";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = (await request.json().catch(() => null)) as { accessToken?: string } | null;

    if (!payload?.accessToken) {
      return NextResponse.json({ error: "Не удалось получить токен VK." }, { status: 400 });
    }

    const profile = await fetchVkUserProfile(payload.accessToken);

    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        vkId: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });
    }

    if (currentUser.vkId && currentUser.vkId !== profile.vkId) {
      return NextResponse.json(
        { error: "Изменить привязку VK можно только через администратора." },
        { status: 403 },
      );
    }

    const existingOwner = await db.user.findUnique({
      where: { vkId: profile.vkId },
      select: { id: true },
    });

    if (existingOwner && existingOwner.id !== session.user.id) {
      return NextResponse.json({ error: "Этот VK уже привязан к другому аккаунту." }, { status: 409 });
    }

    await db.user.update({
      where: { id: session.user.id },
      data: {
        vkId: profile.vkId,
      },
    });

    return NextResponse.json({
      ok: true,
      message: profile.fullName ? `VK ${profile.fullName} успешно привязан.` : "VK успешно привязан.",
    });
  } catch (error) {
    console.error("vk connection error", error);
    return NextResponse.json({ error: "Не удалось привязать VK." }, { status: 500 });
  }
}
