import { NextResponse } from "next/server";
import { AFFILIATE_REF_COOKIE } from "@/lib/affiliate";
import { db } from "@/lib/db";

function readHeader(request: Request, name: string) {
  return request.headers.get(name)?.split(",")[0]?.trim() ?? null;
}

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const partner = await db.affiliatePartner.findFirst({
    where: {
      referralSlug: params.slug,
      isActive: true,
    },
    select: { id: true, referralSlug: true },
  });

  const redirectUrl = new URL("/coins", request.url);
  const response = NextResponse.redirect(redirectUrl, 303);

  if (!partner) {
    return response;
  }

  await db.affiliateClick.create({
    data: {
      partnerId: partner.id,
      ipAddress: readHeader(request, "x-forwarded-for") ?? readHeader(request, "x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    },
  });

  response.cookies.set(AFFILIATE_REF_COOKIE, partner.referralSlug, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return response;
}
