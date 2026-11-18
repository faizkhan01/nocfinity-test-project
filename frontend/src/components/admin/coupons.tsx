"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { formatDate, money } from "@/lib/format";
import type { Paginated } from "@/lib/types";
import { Forbidden } from "./forbidden";
import { Can, useCan } from "./staff-context";
import { Badge, Card, EmptyRow, LoadingRows, Modal, PageHeader, Select, SimplePager, Table, TextInput, Toggle } from "./ui";

type Coupon = {
  id: number;
  code: string;
  description: string | null;
  type: "percentage" | "fixed";
  value: number;
  min_order_cents: number;
  max_discount_cents: number | null;
  usage_limit: number | null;
  per_user_limit: number | null;
  used_count: number;
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  is_expired: boolean;
};

const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const describe = (c: Coupon) => (c.type === "percentage" ? `${c.value}% off` : `${money(c.value)} off`);

export function CouponsView() {
  const can = useCan();
  const client = useQueryClient();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Coupon | "new" | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "coupons", status, page],
    queryFn: () => api<Paginated<Coupon>>(`admin/coupons?page=${page}${status ? `&status=${status}` : ""}`),
    placeholderData: keepPreviousData,
    enabled: can("coupons.view"),
  });

  if (!can("coupons.view")) return <Forbidden />;
  const refresh = () => client.invalidateQueries({ queryKey: ["admin", "coupons"] });

  const remove = async (c: Coupon) => {
    if (!window.confirm(`Delete coupon ${c.code}? Past orders keep the code they used.`)) return;
    try {
      await api(`admin/coupons/${c.id}`, { method: "DELETE" });
      toast.success("Coupon deleted");
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Coupons"
        description="Discounts are validated again at checkout and when the payment is captured."
        actions={
          <Can permission="coupons.manage">
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-4" /> New coupon
            </Button>
          </Can>
        }
      />
      <Card>
        <div className="border-b border-line p-4">
          <Select aria-label="Filter coupons" className="max-w-[200px]" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
            <option value="">All coupons</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="expired">Expired</option>
          </Select>
        </div>
        <Table head={["Code", "Discount", "Min order", "Used", "Valid", "Status", ""]}>
          {isLoading ? (
            <LoadingRows colSpan={7} />
          ) : data?.data.length === 0 ? (
            <EmptyRow colSpan={7}>No coupons.</EmptyRow>
          ) : (
            data?.data.map((c) => (
              <tr key={c.id} className="hover:bg-surface/50">
                <td className="px-4 py-3">
                  <span className="font-mono font-bold">{c.code}</span>
                  {c.description && <span className="block text-xs text-ink/50">{c.description}</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {describe(c)}
                  {c.max_discount_cents && <span className="block text-xs text-ink/50">max {money(c.max_discount_cents)}</span>}
                </td>
                <td className="px-4 py-3">{c.min_order_cents ? money(c.min_order_cents) : "—"}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {c.used_count}
                  {c.usage_limit ? ` / ${c.usage_limit}` : ""}
                  {c.per_user_limit && <span className="block text-xs text-ink/50">{c.per_user_limit} per customer</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-ink/60">
                  {c.starts_at ? formatDate(c.starts_at) : "Now"} → {c.expires_at ? formatDate(c.expires_at) : "No end"}
                </td>
                <td className="px-4 py-3">
                  {c.is_expired ? <Badge tone="red">Expired</Badge> : c.is_active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}
                </td>
                <td className="px-4 py-3">
                  <Can permission="coupons.manage">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setEditing(c)} className="rounded-lg p-2 hover:bg-surface" aria-label={`Edit ${c.code}`}>
                        <Pencil className="size-4" />
                      </button>
                      <button type="button" onClick={() => remove(c)} className="rounded-lg p-2 text-sale hover:bg-sale/10" aria-label={`Delete ${c.code}`}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </Can>
                </td>
              </tr>
            ))
          )}
        </Table>
        {data && <SimplePager page={data.meta.current_page} last={data.meta.last_page} onChange={setPage} />}
      </Card>
      {editing && <CouponModal coupon={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
    </div>
  );
}

function CouponModal({ coupon, onClose, onSaved }: { coupon: Coupon | null; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({
    code: coupon?.code ?? "",
    description: coupon?.description ?? "",
    type: coupon?.type ?? "percentage",
    value: coupon ? String(coupon.type === "fixed" ? coupon.value / 100 : coupon.value) : "",
    min_order: coupon?.min_order_cents ? String(coupon.min_order_cents / 100) : "",
    max_discount: coupon?.max_discount_cents ? String(coupon.max_discount_cents / 100) : "",
    usage_limit: coupon?.usage_limit ? String(coupon.usage_limit) : "",
    per_user_limit: coupon?.per_user_limit ? String(coupon.per_user_limit) : "",
    starts_at: toLocal(coupon?.starts_at ?? null),
    expires_at: toLocal(coupon?.expires_at ?? null),
    is_active: coupon?.is_active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const cents = (s: string) => (s ? Math.round(Number(s) * 100) : null);
  const int = (s: string) => (s ? Number(s) : null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!/^[A-Za-z0-9\-_]{3,40}$/.test(v.code.trim())) found.code = "3–40 letters, numbers, dashes or underscores.";
    const value = Number(v.value);
    if (!(value > 0) || (v.type === "percentage" && (value > 100 || !Number.isInteger(value)))) {
      found.value = v.type === "percentage" ? "Enter a whole percentage from 1 to 100." : "Enter an amount above zero.";
    }
    if (v.starts_at && v.expires_at && v.expires_at <= v.starts_at) found.expires_at = "The expiry must be after the start.";
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setFormError(null);
    try {
      const body = {
        code: v.code.trim().toUpperCase(),
        description: v.description || null,
        type: v.type,
        value: v.type === "fixed" ? cents(v.value) : value,
        min_order_cents: cents(v.min_order) ?? 0,
        max_discount_cents: v.type === "percentage" ? cents(v.max_discount) : null,
        usage_limit: int(v.usage_limit),
        per_user_limit: int(v.per_user_limit),
        starts_at: v.starts_at ? new Date(v.starts_at).toISOString() : null,
        expires_at: v.expires_at ? new Date(v.expires_at).toISOString() : null,
        is_active: v.is_active,
      };
      await api(coupon ? `admin/coupons/${coupon.id}` : "admin/coupons", { method: coupon ? "PUT" : "POST", body });
      toast.success(coupon ? "Coupon saved" : "Coupon created");
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.body.errors) {
        const mapped = error.fieldErrors();
        setErrors({ ...mapped, value: mapped.value, min_order: mapped.min_order_cents, max_discount: mapped.max_discount_cents });
      } else setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={coupon ? `Edit ${coupon.code}` : "New coupon"} open onClose={onClose} wide>
      <form onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Code" value={v.code} maxLength={40} onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase() })} error={errors.code} />
        <TextInput label="Description (optional)" value={v.description} maxLength={255} onChange={(e) => setV({ ...v, description: e.target.value })} />
        <Select label="Type" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as Coupon["type"] })}>
          <option value="percentage">Percentage off</option>
          <option value="fixed">Fixed amount off (USD)</option>
        </Select>
        <TextInput label={v.type === "percentage" ? "Percent (1–100)" : "Amount (USD)"} type="number" min="0" step={v.type === "percentage" ? "1" : "0.01"} value={v.value} onChange={(e) => setV({ ...v, value: e.target.value })} error={errors.value} />
        <TextInput label="Minimum order (USD, optional)" type="number" min="0" step="0.01" value={v.min_order} onChange={(e) => setV({ ...v, min_order: e.target.value })} error={errors.min_order} />
        {v.type === "percentage" ? (
          <TextInput label="Maximum discount (USD, optional)" type="number" min="0" step="0.01" value={v.max_discount} onChange={(e) => setV({ ...v, max_discount: e.target.value })} error={errors.max_discount} />
        ) : (
          <div />
        )}
        <TextInput label="Total usage limit (optional)" type="number" min="1" step="1" value={v.usage_limit} onChange={(e) => setV({ ...v, usage_limit: e.target.value })} error={errors.usage_limit} />
        <TextInput label="Uses per customer (optional)" type="number" min="1" step="1" value={v.per_user_limit} onChange={(e) => setV({ ...v, per_user_limit: e.target.value })} error={errors.per_user_limit} />
        <TextInput label="Starts (optional)" type="datetime-local" value={v.starts_at} onChange={(e) => setV({ ...v, starts_at: e.target.value })} error={errors.starts_at} />
        <TextInput label="Expires (optional)" type="datetime-local" value={v.expires_at} onChange={(e) => setV({ ...v, expires_at: e.target.value })} error={errors.expires_at} />
        <label className="flex items-center justify-between text-sm font-medium sm:col-span-2">
          Active
          <Toggle label="Active" checked={v.is_active} onChange={(is_active) => setV({ ...v, is_active })} />
        </label>
        <div className="sm:col-span-2">
          <FormError message={formError} />
        </div>
        <Button type="submit" loading={saving} className="sm:col-span-2">
          Save coupon
        </Button>
      </form>
    </Modal>
  );
}
