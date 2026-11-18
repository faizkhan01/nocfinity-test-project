export const ADMIN_THEME_COOKIE = "shop_admin_theme";

export const ADMIN_THEMES = ["light", "dark", "system"] as const;

export type AdminTheme = (typeof ADMIN_THEMES)[number];

export function parseAdminTheme(value: string | undefined): AdminTheme {
  return ADMIN_THEMES.includes(value as AdminTheme) ? (value as AdminTheme) : "system";
}
