import type { FormatBlueprint } from "@/lib/format-blueprint";

export const TOURNAMENT_BUILDER_DRAFT_KEY = "efootball-nexon:tournament-builder-draft:v1";

export type TournamentBuilderDraft = {
  savedAt: string;
  fields: Record<string, string[]>;
};

export function createTournamentBuilderDraft(formData: FormData): TournamentBuilderDraft {
  const fields: Record<string, string[]> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    fields[name] = [...(fields[name] ?? []), value];
  }
  return { savedAt: new Date().toISOString(), fields };
}

export function parseTournamentBuilderDraft(raw: string | null): TournamentBuilderDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { savedAt?: unknown; fields?: unknown };
    if (typeof parsed.savedAt !== "string" || !parsed.fields || typeof parsed.fields !== "object" || Array.isArray(parsed.fields)) return null;
    const fields = Object.fromEntries(Object.entries(parsed.fields).flatMap(([name, values]) =>
      Array.isArray(values) && values.every((value): value is string => typeof value === "string") ? [[name, values]] : [],
    ));
    return { savedAt: parsed.savedAt, fields };
  } catch {
    return null;
  }
}

export function getDraftFormatBlueprint(draft: TournamentBuilderDraft | null): FormatBlueprint | null {
  const value = draft?.fields.formatBlueprintJson?.[0];
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as FormatBlueprint;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
