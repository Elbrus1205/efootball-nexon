export type ShopTelegramAction = "SHOP_OPEN_DISPUTE" | "SHOP_CANCEL_ORDER";

export type ShopCallbackTokens = {
  consume(token: string, userId: string): Promise<{ action: ShopTelegramAction; orderId: string } | null>;
};

export type ShopCallbackOrders = {
  openDispute(orderId: string, userId: string): Promise<void>;
  cancel(orderId: string, userId: string): Promise<void>;
};

export async function handleShopTelegramCallback(input: {
  userId: string;
  token: string;
  tokens: ShopCallbackTokens;
  orders: ShopCallbackOrders;
}) {
  const action = await input.tokens.consume(input.token, input.userId);
  if (!action) return { message: "Действие уже выполнено или срок действия кнопки истёк.", clearKeyboard: true };
  if (action.action === "SHOP_OPEN_DISPUTE") {
    await input.orders.openDispute(action.orderId, input.userId);
    return { message: "Жалоба отправлена. Поддержка получила уведомление.", clearKeyboard: true };
  }
  await input.orders.cancel(action.orderId, input.userId);
  return { message: "Заказ отменён.", clearKeyboard: true };
}
