export type ShopPermission = "shop.support" | "shop.manage";

export type ShopAction =
  | "VIEW_ORDER"
  | "ACCEPT_ORDER"
  | "START_ORDER"
  | "MARK_SELLER_COMPLETED"
  | "CONFIRM_ORDER"
  | "OPEN_DISPUTE"
  | "RESOLVE_DISPUTE"
  | "MANAGE_CATALOG"
  | "CHANGE_ORDER_PRICE"
  | "VIEW_INTERNAL_AUDIT";

export type ShopAccessContext = {
  userId: string;
  buyerId: string;
  sellerUserId?: string | null;
  isActiveSeller?: boolean;
  permissions: string[];
};

export function canPerformShopAction(action: ShopAction, context: ShopAccessContext) {
  const isBuyer = context.userId === context.buyerId;
  const isSeller = Boolean(context.isActiveSeller && context.sellerUserId === context.userId);
  const isSupport = context.permissions.includes("shop.support");
  const isManager = context.permissions.includes("shop.manage");

  switch (action) {
    case "VIEW_ORDER":
      return isBuyer || isSeller || isSupport || isManager;
    case "ACCEPT_ORDER":
    case "START_ORDER":
    case "MARK_SELLER_COMPLETED":
      return isSeller || isManager;
    case "CONFIRM_ORDER":
      return isBuyer || isManager;
    case "OPEN_DISPUTE":
      return isBuyer || isSupport || isManager;
    case "RESOLVE_DISPUTE":
      return isSupport || isManager;
    case "MANAGE_CATALOG":
    case "VIEW_INTERNAL_AUDIT":
      return isManager;
    case "CHANGE_ORDER_PRICE":
      return isManager;
    default:
      return false;
  }
}
