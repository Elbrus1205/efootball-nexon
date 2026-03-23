import { Badge } from "@/components/ui/badge";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function AuditDiff({
  before,
  after,
  limit = 6,
}: {
  before?: unknown;
  after?: unknown;
  limit?: number;
}) {
  if (!isPlainObject(before) && !isPlainObject(after)) return null;

  const beforeObject = isPlainObject(before) ? before : {};
  const afterObject = isPlainObject(after) ? after : {};
  const keys = Array.from(new Set([...Object.keys(beforeObject), ...Object.keys(afterObject)]));

  const changed = keys
    .filter((key) => JSON.stringify(beforeObject[key]) !== JSON.stringify(afterObject[key]))
    .slice(0, limit);

  if (!changed.length) return null;

  return (
    <div className="space-y-2">
      {changed.map((key) => (
        <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="neutral">{key}</Badge>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-400">
              <div className="mb-1 uppercase tracking-[0.16em] text-zinc-500">Before</div>
              <div className="break-all text-zinc-300">{formatValue(beforeObject[key])}</div>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs text-zinc-200">
              <div className="mb-1 uppercase tracking-[0.16em] text-primary">After</div>
              <div className="break-all">{formatValue(afterObject[key])}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
