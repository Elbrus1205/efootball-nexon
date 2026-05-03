import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ProfileStatusApprovalStatus, UserRole } from "@prisma/client";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { approveProfileStatus } from "@/lib/profile-statuses";

function redirectToSeasons(request: Request, params: Record<string, string>) {
  const url = new URL("/admin/seasons", getRequestBaseUrl(request));

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireRole([UserRole.FOUNDER]);
  const formData = await request.formData();
  const action = String(formData.get("_action") ?? "");
  const status = await db.userProfileStatus.findUnique({
    where: { id: params.id },
  });

  if (!status) {
    return redirectToSeasons(request, { error: "Статус не найден." });
  }

  if (action === "approve") {
    await approveProfileStatus(status, session.user.id);
    revalidatePath("/admin/seasons");
    revalidatePath(`/players/${status.userId}`);
    revalidatePath("/dashboard");
    return redirectToSeasons(request, { statusApproved: "1" });
  }

  if (action === "reject") {
    await db.userProfileStatus.update({
      where: { id: status.id },
      data: {
        approvalStatus: ProfileStatusApprovalStatus.REJECTED,
        selectedOrder: null,
        reviewedAt: new Date(),
        reviewedById: session.user.id,
      },
    });

    revalidatePath("/admin/seasons");
    return redirectToSeasons(request, { statusRejected: "1" });
  }

  return redirectToSeasons(request, { error: "Некорректное действие со статусом." });
}
