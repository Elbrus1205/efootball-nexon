import type { Prisma } from "@prisma/client";
import { FAQ_CATEGORY_ORDER_KEY, parseFaqCategoryOrder } from "./category-order";

export async function getFaqCategoryOrder(client: Pick<Prisma.TransactionClient, "siteContent">) {
  const setting = await client.siteContent.findUnique({ where: { key: FAQ_CATEGORY_ORDER_KEY }, select: { body: true } });
  return parseFaqCategoryOrder(setting?.body);
}
