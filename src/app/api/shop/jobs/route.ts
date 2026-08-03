import { NextResponse } from "next/server";
import { runShopJobs } from "@/lib/shop/jobs";

export async function POST(request: Request) {
  const secret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || new URL(request.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Недействительный ключ cron." }, { status: 401 });
  return NextResponse.json(await runShopJobs());
}
