"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { Cart } from "@/lib/types";

export const cartKey = ["cart"] as const;

export function useCart() {
  return useQuery({ queryKey: cartKey, queryFn: async () => (await api<{ data: Cart }>("cart")).data });
}

/** Every cart mutation returns the full, server-priced cart, which replaces the cached one. */
export function useCartMutation<V>(request: (vars: V) => Promise<{ data: Cart }>, options: { success?: string } = {}) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: request,
    onSuccess: ({ data }) => {
      client.setQueryData(cartKey, data);
      if (options.success) toast.success(options.success);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useAddToCart() {
  return useCartMutation(
    (item: { product_id: number; quantity: number; color?: string | null; size?: string | null }) =>
      api<{ data: Cart }>("cart/items", { method: "POST", body: item }),
    { success: "Added to cart" },
  );
}

export function useUpdateCartItem() {
  return useCartMutation(({ id, quantity }: { id: number; quantity: number }) =>
    api<{ data: Cart }>(`cart/items/${id}`, { method: "PATCH", body: { quantity } }),
  );
}

export function useRemoveCartItem() {
  return useCartMutation((id: number) => api<{ data: Cart }>(`cart/items/${id}`, { method: "DELETE" }), { success: "Removed from cart" });
}
