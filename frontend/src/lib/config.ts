export const API_URL = process.env.API_URL ?? "http://localhost:8000";

export const COOKIE = {
  customer: "shop_customer_token",
  admin: "shop_admin_token",
  cart: "shop_cart_token",
} as const;

export const isProduction = process.env.NODE_ENV === "production";
