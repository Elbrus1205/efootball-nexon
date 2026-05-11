import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { NotificationType } from "@prisma/client";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requirePermission } from "@/lib/auth/session";
import { createNotificationForAllUsers } from "@/lib/services/notifications";
import { deleteSeason, finishSeason } from "@/lib/services/seasons";

function redirectToSeasons(request: Request, params: Record<string, string>) {
  const url = new URL("/admin/seasons", getRequestBaseUrl(request));

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url, 303);
}

function isDeleteConfirmed(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim().toUpperCase() === "РЈР”РђР›РРўР¬";
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requirePermission("tournaments.createEdit");

  const formData = await request.formData();
  const action = String(formData.get("_action") ?? "");

  try {
    if (action === "finish") {
      const season = await finishSeason(params.id);

      await createNotificationForAllUsers({
        title: "РЎРµР·РѕРЅ Р·Р°РІРµСЂС€С‘РЅ",
        body: `Р¤РёРЅР°Р»СЊРЅС‹Р№ СЃРІРёСЃС‚ СЃРµР·РѕРЅР° В«${season.name}В». Р РµР№С‚РёРЅРі Р·Р°С„РёРєСЃРёСЂРѕРІР°РЅ, Р°СЂС…РёРІ РѕС‚РєСЂС‹С‚, Р° Р»СѓС‡С€РёРµ РёРіСЂРѕРєРё СЃРєРѕСЂРѕ РїРѕР»СѓС‡Р°С‚ СЃРµР·РѕРЅРЅС‹Рµ СЃС‚Р°С‚СѓСЃС‹ РїРѕСЃР»Рµ РїСЂРѕРІРµСЂРєРё Р°РґРјРёРЅРёСЃС‚СЂР°С†РёРё.`,
        type: NotificationType.SYSTEM,
        link: "/ratings",
        dedupeWithinHours: 24,
      });

      revalidatePath("/admin/seasons");
      revalidatePath("/admin/statuses");
      revalidatePath("/ratings");
      return redirectToSeasons(request, { finished: "1" });
    }

    if (formData.get("_method") !== "delete") {
      throw new Error("РќРµРёР·РІРµСЃС‚РЅРѕРµ РґРµР№СЃС‚РІРёРµ.");
    }

    if (!isDeleteConfirmed(formData.get("confirmation"))) {
      throw new Error("Р’РІРµРґРёС‚Рµ РЈР”РђР›РРўР¬ РґР»СЏ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ СѓРґР°Р»РµРЅРёСЏ СЃРµР·РѕРЅР°.");
    }

    await deleteSeason(params.id);
    revalidatePath("/admin/seasons");
    revalidatePath("/ratings");
    return redirectToSeasons(request, { deleted: "1" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹РїРѕР»РЅРёС‚СЊ РґРµР№СЃС‚РІРёРµ СЃ СЃРµР·РѕРЅРѕРј.";
    return redirectToSeasons(request, { error: message });
  }
}
