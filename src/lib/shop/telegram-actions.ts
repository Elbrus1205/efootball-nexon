export type ShopTelegramAction =
  | "SHOP_ACCEPT_ORDER"
  | "SHOP_START_ORDER"
  | "SHOP_SELLER_COMPLETE"
  | "SHOP_BUYER_CONFIRM"
  | "SHOP_OPEN_DISPUTE"
  | "SHOP_CANCEL_ORDER";

export type ShopCallbackTokens = {
  consume(token: string, userId: string): Promise<{ action: ShopTelegramAction; orderId: string } | null>;
};

export type ShopCallbackOrders = {
  accept(orderId: string, userId: string): Promise<void>;
  start(orderId: string, userId: string): Promise<void>;
  sellerComplete(orderId: string, userId: string): Promise<void>;
  buyerConfirm(orderId: string, userId: string): Promise<void>;
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
  if (!action) {
    return { message: "Действие уже выполнено или срок действия кнопки истёк.", clearKeyboard: true };
  }

  switch (action.action) {
    case "SHOP_ACCEPT_ORDER":
      await input.orders.accept(action.orderId, input.userId);
      return { message: "Заказ принят.", clearKeyboard: true };
    case "SHOP_START_ORDER":
      await input.orders.start(action.orderId, input.userId);
      return { message: "Выполнение заказа начато.", clearKeyboard: true };
    case "SHOP_SELLER_COMPLETE":
      await input.orders.sellerComplete(action.orderId, input.userId);
      return { message: "Заказ отмечен выполненным.", clearKeyboard: true };
    case "SHOP_BUYER_CONFIRM":
      await input.orders.buyerConfirm(action.orderId, input.userId);
      return { message: "Получение подтверждено.", clearKeyboard: true };
    case "SHOP_OPEN_DISPUTE":
      await input.orders.openDispute(action.orderId, input.userId);
      return { message: "Спор открыт. Поддержка получила уведомление.", clearKeyboard: true };
    case "SHOP_CANCEL_ORDER":
      await input.orders.cancel(action.orderId, input.userId);
      return { message: "Заказ отменён.", clearKeyboard: true };
  }
}
