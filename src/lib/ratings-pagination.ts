export const RATINGS_PAGE_SIZE = 10;

export function getRatingsPagination(totalPlayers: number, requestedPage?: string | string[]) {
  const totalPages = Math.max(1, Math.ceil(totalPlayers / RATINGS_PAGE_SIZE));
  const parsed = typeof requestedPage === "string" && /^\d+$/.test(requestedPage) ? Number(requestedPage) : 1;
  const page = Math.min(totalPages, Math.max(1, Number.isSafeInteger(parsed) ? parsed : 1));
  const offset = (page - 1) * RATINGS_PAGE_SIZE;
  return { page, totalPages, offset, end: Math.min(offset + RATINGS_PAGE_SIZE, totalPlayers) };
}

export function getRatingPageNumbers(page: number, totalPages: number): (number | "gap-before" | "gap-after")[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const start = Math.max(2, Math.min(page - 1, totalPages - 3));
  const end = Math.min(totalPages - 1, Math.max(page + 1, 4));
  return [1, ...(start > 2 ? ["gap-before" as const] : []),
    ...Array.from({ length: end - start + 1 }, (_, index) => start + index),
    ...(end < totalPages - 1 ? ["gap-after" as const] : []), totalPages];
}

export function ratingPageHref(seasonId: string | null, page: number) {
  const query = new URLSearchParams({ season: seasonId ?? "all" });
  if (page > 1) query.set("page", String(page));
  return `/ratings?${query}`;
}
