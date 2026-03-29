import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { generateFallbackNickname } from "@/lib/player-name";
import { profileSchema, registerSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const body = registerSchema.parse(await request.json());
  const existing = await db.user.findUnique({ where: { email: body.email } });

  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  const passwordHash = await hash(body.password, 10);

  const user = await db.user.create({
    data: {
      email: body.email,
      passwordHash,
      name: body.name,
      nickname: generateFallbackNickname(body.email),
    },
  });

  return NextResponse.json({ userId: user.id });
}

export async function PATCH(request: Request) {
  const session = await requireAuth();
  const body = profileSchema.parse(await request.json());

  const user = await db.user.update({
    where: { id: session.user.id },
    data: {
      nickname: body.nickname,
      efootballUid: body.efootballUid,
      favoriteTeam: body.favoriteTeam || null,
      image: body.image || null,
    },
  });

  return NextResponse.json({ user });
}
