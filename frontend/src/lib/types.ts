export type Paginated<T> = {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number; from?: number | null; to?: number | null };
};

export type Color = { name: string; hex: string };

export type ProductSummary = {
  id: number;
  name: string;
  slug: string;
  price_cents: number;
  discount_price_cents: number | null;
  final_price_cents: number;
  discount_percent: number | null;
  image: string | null;
  rating_avg: number;
  rating_count: number;
  in_stock: boolean;
  category?: { id: number; name: string; slug: string };
};

export type Product = ProductSummary & {
  sku: string;
  short_description: string | null;
  description: string | null;
  images: { id: number; url: string; alt: string }[];
  colors: Color[];
  sizes: string[];
  style: string | null;
  stock: number;
  stock_status: "in_stock" | "low_stock" | "out_of_stock";
  category: { id: number; name: string; slug: string; parent: { id: number; name: string; slug: string } | null } | null;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parent_id: number | null;
  children?: Category[];
};

export type Facets = {
  colors: Color[];
  sizes: string[];
  styles: string[];
  price: { min_cents: number; max_cents: number };
};

export type Review = {
  id: number;
  rating: number;
  comment: string;
  author: string | null;
  verified_buyer: boolean;
  created_at: string;
};

export type CartItem = {
  id: number;
  product: { id: number; name: string; slug: string; image: string | null; stock: number };
  color: string | null;
  size: string | null;
  quantity: number;
  unit_price_cents: number;
  original_price_cents: number;
  line_total_cents: number;
  issue: string | null;
};

export type Cart = {
  items: CartItem[];
  coupon: { code: string; type: "percentage" | "fixed"; value: number; error: string | null } | null;
  item_count: number;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  has_issues: boolean;
};

export type OrderStatus = "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled";

export type Address = {
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postal_code: string;
  country: string;
};

export type Order = {
  id?: number;
  order_number: string;
  status: OrderStatus;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  coupon_code: string | null;
  item_count?: number | null;
  items?: {
    id: number;
    product_id: number | null;
    product_slug: string | null;
    name: string;
    sku: string;
    image: string | null;
    color: string | null;
    size: string | null;
    unit_price_cents: number;
    quantity: number;
    line_total_cents: number;
  }[];
  shipping: Address;
  notes: string | null;
  cancellation_reason: string | null;
  payment?: { status: string; failure_message: string | null; reference?: string } | null;
  customer?: { id: number; name: string; email: string; phone: string | null } | null;
  history?: { from: OrderStatus | null; to: OrderStatus; note: string | null; by: string | null; at: string }[];
  allowed_transitions?: OrderStatus[];
  can_cancel?: boolean;
  placed_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
};

export type Customer = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  email_verified: boolean;
  created_at: string;
};

export type Staff = {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  is_super_admin: boolean;
  two_factor_enabled: boolean;
  roles: { id: number; name: string; slug: string }[];
  last_login_at: string | null;
  created_at: string;
  permissions?: string[];
};

export type ApiErrorBody = { message: string; code?: string; errors?: Record<string, string[]> };
