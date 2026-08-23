import { requirePermission } from "@/lib/auth/session";
import { TournamentBuilderForm } from "@/components/admin/tournament-builder-form";

export default async function AdminTournamentBuilderPage(
  props: {
    searchParams?: Promise<{ error?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  await requirePermission("tournaments.createEdit");

  return (
    <div className="space-y-6">
      {searchParams?.error ? (
        <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm leading-6 text-red-100">
          <span className="font-semibold">Не удалось сохранить турнир.</span> {searchParams.error}
        </div>
      ) : null}

      <TournamentBuilderForm action="/api/admin/tournaments" submitLabel="Создать турнир" secondaryLabel="Сохранить как черновик" restoreDraft={Boolean(searchParams?.error)} />
    </div>
  );
}
