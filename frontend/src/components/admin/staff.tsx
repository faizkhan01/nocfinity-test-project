"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import type { Paginated, Staff } from "@/lib/types";
import { passwordRule } from "@/lib/validation";
import { Forbidden } from "./forbidden";
import { useRoles } from "./roles";
import { Can, useCan, useStaff } from "./staff-context";
import { Badge, Card, EmptyRow, LoadingRows, Modal, PageHeader, SimplePager, Table, TextInput, Toggle } from "./ui";

export function StaffView() {
  const can = useCan();
  const me = useStaff();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Staff | "new" | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "staff", page],
    queryFn: () => api<Paginated<Staff>>(`admin/staff?page=${page}`),
    placeholderData: keepPreviousData,
    enabled: can("staff.view"),
  });

  if (!can("staff.view")) return <Forbidden />;
  const refresh = () => client.invalidateQueries({ queryKey: ["admin", "staff"] });

  const remove = async (s: Staff) => {
    if (!window.confirm(`Delete ${s.name}'s staff account? They will be signed out immediately.`)) return;
    try {
      await api(`admin/staff/${s.id}`, { method: "DELETE" });
      toast.success("Staff account deleted");
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Staff"
        description="Staff sign in at /admin with their own account; what they can do comes from their roles."
        actions={
          <Can permission="staff.manage">
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-4" /> Add staff
            </Button>
          </Can>
        }
      />
      <Card>
        <Table head={["Name", "Roles", "Status", "Last sign in", ""]}>
          {isLoading ? (
            <LoadingRows colSpan={5} />
          ) : data?.data.length === 0 ? (
            <EmptyRow colSpan={5}>No staff yet.</EmptyRow>
          ) : (
            data?.data.map((s) => {
              const protectedAccount = s.is_super_admin || s.id === me.id;
              return (
                <tr key={s.id} className="hover:bg-surface/50">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 font-medium">
                      {s.is_super_admin && <Lock className="size-3.5" aria-label="Protected account" />}
                      {s.name}
                      {s.id === me.id && <Badge>You</Badge>}
                      {s.two_factor_enabled && <Badge tone="green">2FA</Badge>}
                    </span>
                    <span className="text-xs text-ink/50">{s.email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {s.roles.map((r) => (
                        <Badge key={r.id} tone="blue">
                          {r.name}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">{s.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Deactivated</Badge>}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink/60">{s.last_login_at ? formatDate(s.last_login_at, true) : "Never"}</td>
                  <td className="px-4 py-3">
                    <Can permission="staff.manage">
                      {!protectedAccount && (
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => setEditing(s)} className="rounded-lg p-2 hover:bg-surface" aria-label={`Edit ${s.name}`}>
                            <Pencil className="size-4" />
                          </button>
                          <button type="button" onClick={() => remove(s)} className="rounded-lg p-2 text-sale hover:bg-sale/10" aria-label={`Delete ${s.name}`}>
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      )}
                    </Can>
                  </td>
                </tr>
              );
            })
          )}
        </Table>
        {data && <SimplePager page={data.meta.current_page} last={data.meta.last_page} onChange={setPage} />}
      </Card>
      {editing && <StaffModal staff={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
    </div>
  );
}

function StaffModal({ staff, onClose, onSaved }: { staff: Staff | null; onClose: () => void; onSaved: () => void }) {
  const me = useStaff();
  const roles = useRoles();
  const [v, setV] = useState({ name: staff?.name ?? "", email: staff?.email ?? "", password: "", is_active: staff?.is_active ?? true });
  const [roleIds, setRoleIds] = useState<number[]>(staff?.roles.map((r) => r.id) ?? []);
  const [resetTwoFactor, setResetTwoFactor] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Only a Super Admin may hand out the Super Admin role; the API enforces the same rule.
  const assignable = (roles.data ?? []).filter((r) => !r.is_super_admin || me.is_super_admin);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (v.name.trim().length < 2) found.name = "Enter a name.";
    if (!/^\S+@\S+\.\S+$/.test(v.email)) found.email = "Enter a valid email.";
    if (!staff || v.password) {
      const check = passwordRule.safeParse(v.password);
      if (!check.success) found.password = check.error.issues[0].message;
    }
    if (roleIds.length === 0) found.roles = "Choose at least one role.";
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setFormError(null);
    try {
      await api(staff ? `admin/staff/${staff.id}` : "admin/staff", {
        method: staff ? "PUT" : "POST",
        body: { name: v.name.trim(), email: v.email.trim(), password: v.password || null, is_active: v.is_active, roles: roleIds, reset_two_factor: resetTwoFactor },
      });
      toast.success(staff ? "Staff account saved" : "Staff account created");
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.body.errors) setErrors(error.fieldErrors());
      else setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={staff ? `Edit ${staff.name}` : "Add staff"} open onClose={onClose}>
      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        <TextInput label="Name" value={v.name} maxLength={100} onChange={(e) => setV({ ...v, name: e.target.value })} error={errors.name} />
        <TextInput label="Email" type="email" value={v.email} maxLength={255} onChange={(e) => setV({ ...v, email: e.target.value })} error={errors.email} />
        <TextInput
          label={staff ? "New password (leave blank to keep)" : "Password"}
          type="password"
          autoComplete="new-password"
          value={v.password}
          onChange={(e) => setV({ ...v, password: e.target.value })}
          error={errors.password}
        />
        <fieldset className="text-sm">
          <legend className="font-medium">Roles</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {assignable.map((r) => (
              <label key={r.id} className="flex items-start gap-2 rounded-xl border border-line p-3">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-black"
                  checked={roleIds.includes(r.id)}
                  onChange={() => setRoleIds((ids) => (ids.includes(r.id) ? ids.filter((x) => x !== r.id) : [...ids, r.id]))}
                />
                <span>
                  <span className="block font-medium">{r.name}</span>
                  <span className="text-xs text-ink/50">{r.is_super_admin ? "All permissions" : `${r.permissions.length} permissions`}</span>
                </span>
              </label>
            ))}
          </div>
          {errors.roles && <p className="mt-1 text-xs text-sale">{errors.roles}</p>}
        </fieldset>
        {staff?.two_factor_enabled && (
          <label className="flex items-start gap-2 rounded-xl border border-line p-3 text-sm">
            <input type="checkbox" className="mt-0.5 accent-black" checked={resetTwoFactor} onChange={(e) => setResetTwoFactor(e.target.checked)} />
            <span>
              <span className="block font-medium">Reset two-factor authentication</span>
              <span className="text-xs text-ink/50">For a lost phone. They are signed out and must set 2FA up again.</span>
            </span>
          </label>
        )}
        <label className="flex items-center justify-between text-sm font-medium">
          Active (deactivating signs them out)
          <Toggle label="Active" checked={v.is_active} onChange={(is_active) => setV({ ...v, is_active })} />
        </label>
        <FormError message={formError} />
        <Button type="submit" loading={saving}>
          Save
        </Button>
      </form>
    </Modal>
  );
}
