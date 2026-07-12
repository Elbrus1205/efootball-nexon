import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ProfileStatusApprovalStatus } from "@prisma/client";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { approveProfileStatus } from "@/lib/profile-statuses";

function redirectToStatuses(request: Request, params: Record<string, string>) {
  const url = new URL("/admin/statuses", getRequestBaseUrl(request));

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requirePermission("profileStatuses.manage");
  const formData = await request.formData();
  const action = String(formData.get("_action") ?? "");
  const status = await db.userProfileStatus.findUnique({
    where: { id: params.id },
  });

  if (!status) {
    return redirectToStatuses(request, { error: "Статус не найден." });
  }

  if (action === "approve") {
    await approveProfileStatus(status, session.user.id);
    revalidatePath("/admin/statuses");
    revalidatePath("/admin/seasons");
    revalidatePath(`/players/${status.userId}`);
    revalidatePath("/dashboard");
    return redirectToStatuses(request, { statusApproved: "1" });
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

    revalidatePath("/admin/statuses");
    revalidatePath("/admin/seasons");
    return redirectToStatuses(request, { statusRejected: "1" });
  }

  return redirectToStatuses(request, { error: "Некорректное действие со статусом." });
}
