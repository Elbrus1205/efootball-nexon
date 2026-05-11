import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requirePermission } from "@/lib/auth/session";
import { clearSeasons, createSeason } from "@/lib/services/seasons";

function redirectToSeasons(request: Request, params: Record<string, string>) {
  const url = new URL("/admin/seasons", getRequestBaseUrl(request));

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url, 303);
}

function isClearConfirmed(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim().toUpperCase() === "ОЧИСТИТЬ";
}

export async function POST(request: Request) {
  await requirePermission("tournaments.createEdit");

  const formData = await request.formData();
  const action = formData.get("_action");

  try {
    if (action === "clear") {
      if (!isClearConfirmed(formData.get("confirmation"))) {
        throw new Error("Введите ОЧИСТИТЬ для подтверждения очистки сезонов.");
      }

      await clearSeasons();
      revalidatePath("/admin/seasons");
      revalidatePath("/ratings");
      return redirectToSeasons(request, { cleared: "1" });
    }

    await createSeason(formData.get("name"));
    revalidatePath("/admin/seasons");
    revalidatePath("/ratings");
    return redirectToSeasons(request, { created: "1" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить действие с сезонами.";
    return redirectToSeasons(request, { error: message });
  }
}
