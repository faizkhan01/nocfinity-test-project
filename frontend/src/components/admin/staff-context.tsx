"use client";

import { createContext, useContext } from "react";
import type { Staff } from "@/lib/types";

const StaffContext = createContext<Staff | null>(null);

export function StaffProvider({ staff, children }: { staff: Staff; children: React.ReactNode }) {
  return <StaffContext.Provider value={staff}>{children}</StaffContext.Provider>;
}

export function useStaff(): Staff {
  const staff = useContext(StaffContext);
  if (!staff) throw new Error("useStaff must be used inside the admin layout");
  return staff;
}

/** UI-only check for hiding controls; the API enforces the same permission on every request. */
export function useCan() {
  const staff = useStaff();
  return (...permissions: string[]) => staff.is_super_admin || permissions.some((p) => staff.permissions?.includes(p));
}

export function Can({ permission, children }: { permission: string | string[]; children: React.ReactNode }) {
  const can = useCan();
  return can(...(Array.isArray(permission) ? permission : [permission])) ? <>{children}</> : null;
}
