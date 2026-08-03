export class ShopError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "ShopError";
    this.code = code;
    this.status = status;
  }
}

export function shopErrorResponse(error: unknown) {
  if (error instanceof ShopError) {
    return { error: error.message, code: error.code, status: error.status };
  }
  return { error: "Не удалось выполнить действие магазина.", code: "SHOP_INTERNAL_ERROR", status: 500 };
}
