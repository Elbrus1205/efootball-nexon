import { z } from "zod";

export const FAQ_CATEGORY_ORDER_KEY = "faq:category-order";
export const faqCategoryNameSchema = z.string().trim().min(1, "Введите название раздела.").max(100, "Название раздела должно быть не длиннее 100 символов.");
export const faqCategoryChangesSchema = z.array(z.object({
  originalName: z.string().min(1),
  name: z.string().min(1),
})).max(1000).superRefine((rows, ctx) => {
  for (const row of rows) {
    if (row.name !== row.originalName) {
      const result = faqCategoryNameSchema.safeParse(row.name);
      if (!result.success || result.data !== row.name) ctx.addIssue({ code: "custom", message: "Введите название раздела от 1 до 100 символов без пробелов по краям." });
    }
  }
  if (new Set(rows.map((row) => row.originalName)).size !== rows.length) ctx.addIssue({ code: "custom", message: "Разделы не должны повторяться." });
});
export type FaqCategoryChange = z.infer<typeof faqCategoryChangesSchema>[number];

export function getFaqCategoryRenameError(rows: readonly FaqCategoryChange[]): string | null {
  const normalize = (name: string) => name.trim().toLocaleLowerCase("ru");
  for (const row of rows) {
    if (row.name === row.originalName) continue;
    if (rows.some((other) => other.originalName !== row.originalName &&
      (normalize(other.name) === normalize(row.name) || normalize(other.originalName) === normalize(row.name)))) {
      return `Раздел «${row.name}» уже существует. Выберите другое название.`;
    }
  }
  return null;
}
export const faqCategoryOrderSchema = z.array(z.string().min(1)).max(1000)
  .refine((names) => new Set(names).size === names.length, "Разделы не должны повторяться.");

export function parseFaqCategoryOrder(body: string | null | undefined): string[] {
  try {
    const result = faqCategoryOrderSchema.safeParse(JSON.parse(body ?? "null"));
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

/** New sections follow saved sections alphabetically, independently of question positions. */
export function orderFaqCategories(names: readonly string[], savedOrder: readonly string[]): string[] {
  const remaining = new Set(names);
  const ordered = savedOrder.filter((name) => remaining.delete(name));
  return [...ordered, ...[...remaining].sort((a, b) => a.localeCompare(b, "ru"))];
}

/** Keep the database's question order within each section. */
export function orderFaqItems<T extends { category: string }>(items: readonly T[], savedOrder: readonly string[]): T[] {
  const categories = orderFaqCategories(items.map((item) => item.category || "Общее"), savedOrder);
  const positions = new Map(categories.map((name, index) => [name, index]));
  return [...items].sort((a, b) => positions.get(a.category || "Общее")! - positions.get(b.category || "Общее")!);
}

export function matchesFaqCategories(order: readonly string[], current: readonly string[]): boolean {
  return order.length === current.length && new Set(order).size === order.length && current.every((name) => order.includes(name));
}
