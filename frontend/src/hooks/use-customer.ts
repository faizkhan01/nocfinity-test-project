"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { Customer } from "@/lib/types";

export const customerKey = ["customer"] as const;

/** The signed-in customer, or null for guests (the BFF returns 401 when there is no session). */
export function useCustomer() {
  return useQuery({
    queryKey: customerKey,
    queryFn: async () => {
      try {
        return (await api<{ data: Customer | null }>("auth/me")).data;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 5 * 60_000,
  });
}
