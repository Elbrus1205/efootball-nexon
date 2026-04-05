import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { profileSchema, registerSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const body = registerSchema.parse(await request.json());
  const normalizedEmail = body.email.trim().toLowerCase();
  const existing = await db.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
  });

  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  const passwordHash = await hash(body.password, 10);

  const user = await db.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name: body.name,
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
      name: body.name,
      favoriteTeam: body.favoriteTeam || null,
      bio: body.bio || null,
      bannerImage: body.bannerImage || null,
      image: body.image || null,
    },
  });

  return NextResponse.json({ user });
}
