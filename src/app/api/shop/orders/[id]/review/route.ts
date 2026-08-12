import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Отзывы принимаются в Telegram-чате магазина." }, { status: 410 });
}
