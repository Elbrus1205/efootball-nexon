import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";

function isOrderAdmin(role: UserRole) {
  return role === UserRole.FOUNDER || role === UserRole.ORGANIZER;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  const order = await db.coinServiceOrder.findUnique({
    where: { id: params.id },
    select: {
      buyerId: true,
      executorId: true,
      paymentReceiptFileName: true,
      paymentReceiptMimeType: true,
      paymentReceiptData: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  if (!isOrderAdmin(session.user.role) && order.buyerId !== session.user.id && order.executorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!order.paymentReceiptData || !order.paymentReceiptMimeType) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  const fileName = order.paymentReceiptFileName || "receipt";

  return new Response(order.paymentReceiptData, {
    headers: {
      "Content-Type": order.paymentReceiptMimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
