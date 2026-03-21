import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { tournamentSchema } from "@/lib/validators";
import { slugify } from "@/lib/utils";

export async function POST(request: Request) {
  await requireRole([UserRole.ADMIN]);

  const formData = await request.formData();
  const body = tournamentSchema.parse({
    title: formData.get("title"),
    description: formData.get("description"),
    rules: formData.get("rules"),
    startsAt: formData.get("startsAt"),
    registrationEndsAt: formData.get("registrationEndsAt"),
    maxParticipants: formData.get("maxParticipants"),
    prizePool: formData.get("prizePool"),
    format: formData.get("format"),
  });

  await db.tournament.create({
    data: {
      title: body.title,
      slug: `${slugify(body.title)}-${Date.now()}`,
      description: body.description,
      rules: body.rules,
      startsAt: new Date(body.startsAt),
      registrationEndsAt: new Date(body.registrationEndsAt),
      maxParticipants: body.maxParticipants,
      prizePool: body.prizePool || null,
      format: body.format,
      status: body.status,
      coverImage: body.coverImage || null,
    },
  });

  return NextResponse.redirect(new URL(`/admin/tournaments`, process.env.NEXTAUTH_URL));
}
