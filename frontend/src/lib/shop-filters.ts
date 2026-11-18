/** Query keys the shop page accepts; anything else in the URL is ignored and never forwarded to the API. */
export const FILTER_KEYS = ["search", "category", "min_price", "max_price", "colors", "sizes", "styles", "sort", "on_sale", "page"] as const;

export type ShopParams = Partial<Record<(typeof FILTER_KEYS)[number], string>>;

export const SORTS = [
  { value: "popular", label: "Most Popular" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
] as const;

export const PER_PAGE = 9;

export function pickParams(raw: Record<string, string | string[] | undefined>): ShopParams {
  const out: ShopParams = {};
  for (const key of FILTER_KEYS) {
    const value = raw[key];
    const single = Array.isArray(value) ? value.join(",") : value;
    if (single) out[key] = single.slice(0, 200);
  }
  return out;
}

export function shopHref(params: ShopParams, changes: ShopParams = {}): string {
  const merged = { ...params, ...changes };
  const query = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = merged[key];
    if (value) query.set(key, value);
  }
  const qs = query.toString();
  return qs ? `/shop?${qs}` : "/shop";
}

export function listOf(value?: string): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}
