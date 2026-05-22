import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { acceptCurrentRegulations, getRegulationsAcceptance, getRegulationsChangeHighlights } from "@/lib/regulations";

export async function GET() {
  const session = await requireAuth();
  const acceptance = await getRegulationsAcceptance(session.user.id);
  const highlights = acceptance.accepted ? [] : await getRegulationsChangeHighlights();

  return NextResponse.json({
    accepted: acceptance.accepted,
    acceptedAt: acceptance.acceptedAt,
    acceptedVersion: acceptance.acceptedVersion,
    regulations: {
      body: acceptance.document.body,
      version: acceptance.document.version,
      updatedAt: acceptance.document.updatedAt?.toISOString() ?? null,
      highlights,
    },
  });
}

export async function POST(request: Request) {
  const session = await requireAuth();
  const body = await request.json().catch(() => ({}));

  if (body.accepted !== true) {
    return NextResponse.json({ error: "Подтвердите, что вы прочитали и приняли регламент." }, { status: 400 });
  }

  const acceptance = await acceptCurrentRegulations(session.user.id, request.headers);

  return NextResponse.json({
    ok: true,
    accepted: true,
    acceptedAt: acceptance.acceptedAt,
    regulations: {
      body: acceptance.document.body,
      version: acceptance.document.version,
      updatedAt: acceptance.document.updatedAt?.toISOString() ?? null,
    },
  });
}
