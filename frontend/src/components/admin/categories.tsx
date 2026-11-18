"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CornerDownRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { Forbidden } from "./forbidden";
import { useAdminCategories, type AdminCategory } from "./products/types";
import { Can, useCan } from "./staff-context";
import { Badge, Card, EmptyRow, LoadingRows, Modal, PageHeader, Select, Table, TextInput, Toggle } from "./ui";

type Draft = { id?: number; name: string; parent_id: string; description: string; is_active: boolean; sort_order: string };

export function CategoriesView() {
  const can = useCan();
  const client = useQueryClient();
  const { tree, isLoading } = useAdminCategories();
  const [draft, setDraft] = useState<Draft | null>(null);

  if (!can("categories.view", "categories.manage", "products.view")) return <Forbidden />;

  const refresh = () => client.invalidateQueries({ queryKey: ["admin", "categories"] });

  const remove = async (category: AdminCategory) => {
    if (!window.confirm(`Delete "${category.name}"?`)) return;
    try {
      await api(`admin/categories/${category.id}`, { method: "DELETE" });
      toast.success("Category deleted");
      refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const edit = (c?: AdminCategory, parentId?: number) =>
    setDraft(
      c
        ? { id: c.id, name: c.name, parent_id: c.parent_id ? String(c.parent_id) : "", description: c.description ?? "", is_active: c.is_active, sort_order: String(c.sort_order) }
        : { name: "", parent_id: parentId ? String(parentId) : "", description: "", is_active: true, sort_order: "0" },
    );

  const row = (c: AdminCategory, child = false) => (
    <tr key={c.id} className="hover:bg-surface/50">
      <td className="px-4 py-3">
        <span className={child ? "flex items-center gap-2 pl-6 text-ink/80" : "font-bold"}>
          {child && <CornerDownRight className="size-4 text-ink/30" />}
          {c.name}
        </span>
      </td>
      <td className="px-4 py-3 text-ink/50">{c.slug}</td>
      <td className="px-4 py-3">{c.products_count}</td>
      <td className="px-4 py-3">{c.is_active ? <Badge tone="green">Active</Badge> : <Badge>Hidden</Badge>}</td>
      <td className="px-4 py-3">
        <Can permission="categories.manage">
          <div className="flex justify-end gap-1">
            {!child && (
              <button type="button" onClick={() => edit(undefined, c.id)} className="rounded-lg p-2 hover:bg-surface" aria-label={`Add subcategory to ${c.name}`} title="Add subcategory">
                <Plus className="size-4" />
              </button>
            )}
            <button type="button" onClick={() => edit(c)} className="rounded-lg p-2 hover:bg-surface" aria-label={`Edit ${c.name}`}>
              <Pencil className="size-4" />
            </button>
            <button type="button" onClick={() => remove(c)} className="rounded-lg p-2 text-sale hover:bg-sale/10" aria-label={`Delete ${c.name}`}>
              <Trash2 className="size-4" />
            </button>
          </div>
        </Can>
      </td>
    </tr>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Categories"
        description="Two levels: top-level categories and their subcategories."
        actions={
          <Can permission="categories.manage">
            <Button size="sm" onClick={() => edit()}>
              <Plus className="size-4" /> New category
            </Button>
          </Can>
        }
      />
      <Card>
        <Table head={["Name", "Slug", "Products", "Status", ""]}>
          {isLoading ? <LoadingRows colSpan={5} /> : tree.length === 0 ? <EmptyRow colSpan={5}>No categories yet.</EmptyRow> : tree.flatMap((c) => [row(c), ...c.children.map((child) => row(child, true))])}
        </Table>
      </Card>
      {draft && <CategoryModal draft={draft} parents={tree.filter((c) => c.id !== draft.id)} onClose={() => setDraft(null)} onSaved={refresh} />}
    </div>
  );
}

function CategoryModal({ draft, parents, onClose, onSaved }: { draft: Draft; parents: AdminCategory[]; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState(draft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (values.name.trim().length < 2) return setErrors({ name: "Enter a name." });
    setSaving(true);
    setFormError(null);
    try {
      const body = { name: values.name.trim(), parent_id: values.parent_id ? Number(values.parent_id) : null, description: values.description || null, is_active: values.is_active, sort_order: Number(values.sort_order) || 0 };
      await api(values.id ? `admin/categories/${values.id}` : "admin/categories", { method: values.id ? "PUT" : "POST", body });
      toast.success(values.id ? "Category saved" : "Category created");
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
    <Modal title={values.id ? "Edit category" : "New category"} open onClose={onClose}>
      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        <TextInput label="Name" value={values.name} maxLength={100} onChange={(e) => setValues({ ...values, name: e.target.value })} error={errors.name} />
        <Select label="Parent" value={values.parent_id} onChange={(e) => setValues({ ...values, parent_id: e.target.value })}>
          <option value="">None (top level)</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        {errors.parent_id && <p className="-mt-2 text-xs text-sale">{errors.parent_id}</p>}
        <TextInput label="Description" value={values.description} maxLength={500} onChange={(e) => setValues({ ...values, description: e.target.value })} error={errors.description} />
        <TextInput label="Sort order" type="number" min="0" value={values.sort_order} onChange={(e) => setValues({ ...values, sort_order: e.target.value })} error={errors.sort_order} />
        <label className="flex items-center justify-between text-sm font-medium">
          Visible in the shop
          <Toggle label="Visible" checked={values.is_active} onChange={(v) => setValues({ ...values, is_active: v })} />
        </label>
        <FormError message={formError} />
        <Button type="submit" loading={saving}>
          Save
        </Button>
      </form>
    </Modal>
  );
}
