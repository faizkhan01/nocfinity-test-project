"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/format";
import { Forbidden } from "./forbidden";
import { useCan } from "./staff-context";
import { Badge, Card, Modal, PageHeader, TextInput } from "./ui";

export type Role = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  is_super_admin: boolean;
  permissions: string[];
  staff_count: number;
};

type PermissionGroup = { group: string; permissions: { name: string; description: string }[] };

export function useRoles(enabled = true) {
  return useQuery({ queryKey: ["admin", "roles"], queryFn: async () => (await api<{ data: Role[] }>("admin/roles")).data, enabled });
}

export function RolesMatrix() {
  const can = useCan();
  const client = useQueryClient();
  const editable = can("roles.manage");
  const roles = useRoles(can("roles.view"));
  const groups = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: async () => (await api<{ data: PermissionGroup[] }>("admin/permissions")).data,
    enabled: can("roles.view"),
  });

  const [drafts, setDrafts] = useState<Record<number, Set<string>>>({});
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Role | "new" | null>(null);

  const current = useMemo(() => {
    const map: Record<number, Set<string>> = {};
    roles.data?.forEach((r) => (map[r.id] = drafts[r.id] ?? new Set(r.permissions)));
    return map;
  }, [roles.data, drafts]);

  if (!can("roles.view")) return <Forbidden />;

  const dirty = Object.keys(drafts).map(Number);

  const toggle = (role: Role, permission: string) => {
    const next = new Set(current[role.id]);
    if (next.has(permission)) next.delete(permission);
    else next.add(permission);
    setDrafts((d) => ({ ...d, [role.id]: next }));
  };

  const toggleGroup = (role: Role, group: PermissionGroup) => {
    const next = new Set(current[role.id]);
    const all = group.permissions.every((p) => next.has(p.name));
    group.permissions.forEach((p) => (all ? next.delete(p.name) : next.add(p.name)));
    setDrafts((d) => ({ ...d, [role.id]: next }));
  };

  const save = async () => {
    setSaving(true);
    try {
      for (const id of dirty) {
        const role = roles.data!.find((r) => r.id === id)!;
        await api(`admin/roles/${id}`, { method: "PUT", body: { name: role.name, description: role.description, permissions: [...current[id]] } });
      }
      setDrafts({});
      await client.invalidateQueries({ queryKey: ["admin", "roles"] });
      toast.success("Permissions saved. Changes apply to staff on their next request.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (role: Role) => {
    if (!window.confirm(`Delete the "${role.name}" role?`)) return;
    try {
      await api(`admin/roles/${role.id}`, { method: "DELETE" });
      toast.success("Role deleted");
      client.invalidateQueries({ queryKey: ["admin", "roles"] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const list = roles.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Roles & Permissions"
        description={editable ? "Tick a box to grant a permission to a role. Super Admin always has every permission." : "You can view roles but not change them."}
        actions={
          editable && (
            <>
              {dirty.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setDrafts({})} disabled={saving}>
                  Discard
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
                <Plus className="size-4" /> New role
              </Button>
              <Button size="sm" onClick={save} disabled={dirty.length === 0} loading={saving}>
                Save changes{dirty.length ? ` (${dirty.length})` : ""}
              </Button>
            </>
          )
        }
      />

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="sticky left-0 z-10 w-72 bg-white px-4 py-4 text-left font-medium text-ink/50">
                Permission
              </th>
              {list.map((role) => (
                <th key={role.id} scope="col" className={cn("px-3 py-4 text-center align-bottom", drafts[role.id] && "bg-amber-50 dark:bg-amber-400/10")}>
                  <div className="flex flex-col items-center gap-1">
                    <span className="flex items-center gap-1 font-bold">
                      {role.is_super_admin && <Lock className="size-3.5" />}
                      {role.name}
                    </span>
                    <span className="text-xs font-normal text-ink/50">{role.staff_count} staff</span>
                    {editable && !role.is_super_admin && (
                      <span className="flex gap-1">
                        <button type="button" onClick={() => setEditing(role)} className="rounded p-1 hover:bg-surface" aria-label={`Rename ${role.name}`}>
                          <Pencil className="size-3.5" />
                        </button>
                        {!role.is_system && (
                          <button type="button" onClick={() => remove(role)} className="rounded p-1 text-sale hover:bg-sale/10" aria-label={`Delete ${role.name}`}>
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.data?.map((group) => (
              <Fragment key={group.group}>
                <tr className="bg-surface/70">
                  <th scope="rowgroup" className="sticky left-0 z-10 bg-surface/70 px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-ink/60">
                    {group.group}
                  </th>
                  {list.map((role) => (
                    <td key={role.id} className="px-3 py-2 text-center">
                      {editable && !role.is_super_admin && (
                        <button type="button" onClick={() => toggleGroup(role, group)} className="text-xs text-ink/50 underline hover:text-ink">
                          toggle all
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
                {group.permissions.map((p) => (
                  <tr key={p.name} className="border-b border-line/60 hover:bg-surface/40">
                    <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-2.5 text-left font-normal">
                      <span className="block font-medium">{p.description}</span>
                      <code className="text-xs text-ink/40">{p.name}</code>
                    </th>
                    {list.map((role) => {
                      const checked = role.is_super_admin || current[role.id]?.has(p.name);
                      return (
                        <td key={role.id} className={cn("px-3 py-2.5 text-center", drafts[role.id] && "bg-amber-50/60 dark:bg-amber-400/5")}>
                          <input
                            type="checkbox"
                            className="size-4 cursor-pointer accent-ink disabled:cursor-not-allowed"
                            aria-label={`${role.name}: ${p.description}`}
                            checked={checked}
                            disabled={!editable || role.is_super_admin}
                            onChange={() => toggle(role, p.name)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </Card>

      {editing && <RoleModal role={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => client.invalidateQueries({ queryKey: ["admin", "roles"] })} />}
    </div>
  );
}

function RoleModal({ role, onClose, onSaved }: { role: Role | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Enter a role name.");
    setSaving(true);
    setError(null);
    try {
      await api(role ? `admin/roles/${role.id}` : "admin/roles", {
        method: role ? "PUT" : "POST",
        body: { name: name.trim(), description: description || null, permissions: role?.permissions ?? [] },
      });
      toast.success(role ? "Role updated" : "Role created. Tick its permissions in the matrix.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? (err.fieldErrors().name ?? err.message) : errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={role ? `Edit ${role.name}` : "New role"} open onClose={onClose}>
      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        <TextInput label="Name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        <TextInput label="Description (optional)" value={description} maxLength={255} onChange={(e) => setDescription(e.target.value)} />
        {role?.is_system && <Badge>Built-in role: it can be renamed but not deleted</Badge>}
        <FormError message={error} />
        <Button type="submit" loading={saving}>
          {role ? "Save" : "Create role"}
        </Button>
      </form>
    </Modal>
  );
}
