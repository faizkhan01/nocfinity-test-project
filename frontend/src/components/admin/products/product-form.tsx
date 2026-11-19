"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { assetUrl, cn } from "@/lib/format";
import { Card, Select, TextInput, Toggle } from "../ui";
import { useAdminCategories, type AdminProduct } from "./types";
import { MediaImage } from "@/components/ui/media-image";

const SIZE_PRESETS = ["XX-Small", "X-Small", "Small", "Medium", "Large", "X-Large", "XX-Large", "3X-Large", "4X-Large"];
const STYLES = ["casual", "formal", "party", "gym"];
const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Errors = Record<string, string>;

const dollars = (cents: number | null | undefined) => (cents == null ? "" : (cents / 100).toFixed(2));
const toCents = (value: string) => Math.round(Number(value) * 100);

export function ProductForm({ product }: { product?: AdminProduct }) {
  const router = useRouter();
  const client = useQueryClient();
  const { flat } = useAdminCategories();

  const [values, setValues] = useState({
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    category_id: product ? String(product.category_id) : "",
    short_description: product?.short_description ?? "",
    description: product?.description ?? "",
    price: dollars(product?.price_cents),
    discount_price: dollars(product?.discount_price_cents),
    stock: product ? String(product.stock) : "0",
    low_stock_threshold: product ? String(product.low_stock_threshold) : "5",
    style: product?.style ?? "",
    is_active: product?.is_active ?? true,
    is_featured: product?.is_featured ?? false,
  });
  const [colors, setColors] = useState(product?.colors ?? []);
  const [sizes, setSizes] = useState<string[]>(product?.sizes ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [removed, setRemoved] = useState<number[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const existing = (product?.images ?? []).filter((img) => !removed.includes(img.id));
  const imageCount = existing.length + files.length;
  const FIELD_ERROR: Record<string, string> = { price: "price_cents", discount_price: "discount_price_cents" };
  const set = (patch: Partial<typeof values>) => {
    setValues((v) => ({ ...v, ...patch }));
    // Clear a field's error as soon as it is edited.
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !Object.keys(patch).some((f) => (FIELD_ERROR[f] ?? f) === k))));
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (values.name.trim().length < 2) e.name = "Enter a product name.";
    if (!/^[A-Za-z0-9\-_]+$/.test(values.sku.trim())) e.sku = "Use letters, numbers, dashes or underscores.";
    if (!values.category_id) e.category_id = "Choose a category.";
    if (!(Number(values.price) > 0)) e.price_cents = "Enter a price above zero.";
    if (values.discount_price && !(Number(values.discount_price) > 0 && Number(values.discount_price) < Number(values.price))) {
      e.discount_price_cents = "The discount price must be lower than the price.";
    }
    if (!Number.isInteger(Number(values.stock)) || Number(values.stock) < 0) e.stock = "Stock must be a whole number of 0 or more.";
    if (imageCount === 0) e.images = "Add at least one product image.";
    colors.forEach((c, i) => {
      if (!c.name.trim()) e[`colors.${i}.name`] = "Name the colour.";
    });
    return e;
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list).filter((f) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return toast.error(`${f.name}: use JPG, PNG or WebP.`), false;
      if (f.size > MAX_IMAGE_BYTES) return toast.error(`${f.name} is larger than 5 MB.`), false;
      return true;
    });
    setFiles((current) => [...current, ...picked].slice(0, MAX_IMAGES - existing.length));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== "images")));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    const data = new FormData();
    if (product) data.append("_method", "PUT");
    data.append("name", values.name.trim());
    data.append("sku", values.sku.trim());
    data.append("category_id", values.category_id);
    data.append("short_description", values.short_description);
    data.append("description", values.description);
    data.append("price_cents", String(toCents(values.price)));
    data.append("discount_price_cents", values.discount_price ? String(toCents(values.discount_price)) : "");
    data.append("stock", values.stock);
    data.append("low_stock_threshold", values.low_stock_threshold || "5");
    data.append("style", values.style);
    data.append("is_active", values.is_active ? "1" : "0");
    data.append("is_featured", values.is_featured ? "1" : "0");
    colors.forEach((c, i) => {
      data.append(`colors[${i}][name]`, c.name.trim());
      data.append(`colors[${i}][hex]`, c.hex);
    });
    sizes.forEach((s) => data.append("sizes[]", s));
    files.forEach((f) => data.append("images[]", f));
    removed.forEach((id) => data.append("remove_image_ids[]", String(id)));

    setSaving(true);
    try {
      await api(product ? `admin/products/${product.id}` : "admin/products", { method: "POST", body: data });
      await client.invalidateQueries({ queryKey: ["admin", "products"] });
      toast.success(product ? "Product saved" : "Product created");
      router.push("/admin/products");
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.body.errors) {
        setErrors(error.fieldErrors());
        setFormError("Please fix the highlighted fields.");
      } else {
        setFormError(errorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  };

  const imageError = errors.images ?? Object.entries(errors).find(([k]) => k.startsWith("images."))?.[1];

  return (
    <form onSubmit={submit} noValidate className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-6">
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="font-bold">Details</h2>
          <TextInput label="Name" value={values.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} maxLength={255} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="SKU" value={values.sku} onChange={(e) => set({ sku: e.target.value.toUpperCase() })} error={errors.sku} maxLength={64} />
            <Select label="Category" value={values.category_id} onChange={(e) => set({ category_id: e.target.value })}>
              <option value="">Choose…</option>
              {flat.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parent_id ? `— ${c.name}` : c.name}
                </option>
              ))}
            </Select>
          </div>
          {errors.category_id && <p className="-mt-2 text-xs text-sale">{errors.category_id}</p>}
          <TextInput label="Short description" value={values.short_description} onChange={(e) => set({ short_description: e.target.value })} error={errors.short_description} maxLength={500} />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Description</span>
            <textarea
              value={values.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={6}
              maxLength={10000}
              className="rounded-xl border border-line p-3 outline-none focus:ring-2 focus:ring-ink"
            />
            <span className="text-xs text-ink/50">Plain text. Line breaks are kept; HTML is shown as text.</span>
          </label>
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Images</h2>
            <span className="text-xs text-ink/50">
              {imageCount}/{MAX_IMAGES} · JPG, PNG or WebP up to 5 MB · first image is the cover
            </span>
          </div>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {existing.map((img) => (
              <li key={img.id} className="relative aspect-square overflow-hidden rounded-xl bg-product">
                <MediaImage src={assetUrl(img.url)!} alt="" fill sizes="160px" className="object-cover" />
                <button type="button" onClick={() => setRemoved((r) => [...r, img.id])} aria-label="Remove image" className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 shadow">
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
            {previews.map((src, i) => (
              <li key={src} className="relative aspect-square overflow-hidden rounded-xl bg-product">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img src={src} alt="" className="size-full object-cover" />
                <span className="absolute bottom-1.5 left-1.5 rounded bg-ink px-1.5 text-[10px] text-white">New</span>
                <button type="button" onClick={() => setFiles((f) => f.filter((_, j) => j !== i))} aria-label="Remove new image" className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 shadow">
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
            {imageCount < MAX_IMAGES && (
              <li>
                <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-ink/50 hover:border-ink/40 hover:text-ink">
                  <span className="flex flex-col items-center gap-1 text-xs">
                    <ImagePlus className="size-6" />
                    Add images
                  </span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => addFiles(e.target.files)} />
                </label>
              </li>
            )}
          </ul>
          {imageError && <p className="text-xs text-sale">{imageError}</p>}
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Colours</h2>
            <button type="button" onClick={() => setColors((c) => [...c, { name: "", hex: "#000000" }])} className="flex items-center gap-1 text-sm font-medium">
              <Plus className="size-4" /> Add colour
            </button>
          </div>
          {colors.length === 0 && <p className="text-sm text-ink/50">No colour options. Customers won&apos;t choose a colour.</p>}
          {colors.map((c, i) => (
            <div key={i} className="flex items-end gap-3">
              <input
                type="color"
                value={c.hex}
                aria-label="Colour"
                onChange={(e) => setColors((list) => list.map((x, j) => (j === i ? { ...x, hex: e.target.value.toUpperCase() } : x)))}
                className="h-10 w-12 cursor-pointer rounded-lg border border-line"
              />
              <TextInput
                className="flex-1"
                placeholder="Colour name"
                aria-label="Colour name"
                value={c.name}
                maxLength={40}
                error={errors[`colors.${i}.name`]}
                onChange={(e) => setColors((list) => list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <button type="button" onClick={() => setColors((list) => list.filter((_, j) => j !== i))} aria-label="Remove colour" className="mb-2 p-1 text-ink/50 hover:text-sale">
                <X className="size-4" />
              </button>
            </div>
          ))}
          <h2 className="mt-2 font-bold">Sizes</h2>
          <div className="flex flex-wrap gap-2">
            {SIZE_PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={sizes.includes(s)}
                onClick={() => setSizes((list) => (list.includes(s) ? list.filter((x) => x !== s) : SIZE_PRESETS.filter((p) => p === s || list.includes(p))))}
                className={cn("rounded-full px-3.5 py-1.5 text-sm", sizes.includes(s) ? "bg-ink text-white" : "bg-surface text-ink/60")}
              >
                {s}
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-6 lg:sticky lg:top-24">
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="font-bold">Pricing & stock</h2>
          <TextInput label="Price (USD)" type="number" min="0.01" step="0.01" value={values.price} onChange={(e) => set({ price: e.target.value })} error={errors.price_cents} />
          <TextInput
            label="Discount price (optional)"
            type="number"
            min="0.01"
            step="0.01"
            value={values.discount_price}
            onChange={(e) => set({ discount_price: e.target.value })}
            error={errors.discount_price_cents}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Stock" type="number" min="0" step="1" value={values.stock} onChange={(e) => set({ stock: e.target.value })} error={errors.stock} />
            <TextInput label="Low-stock alert" type="number" min="0" step="1" value={values.low_stock_threshold} onChange={(e) => set({ low_stock_threshold: e.target.value })} error={errors.low_stock_threshold} />
          </div>
          <Select label="Dress style" value={values.style} onChange={(e) => set({ style: e.target.value })}>
            <option value="">None</option>
            {STYLES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </Select>
        </Card>
        <Card className="flex flex-col gap-4 p-5">
          <label className="flex items-center justify-between text-sm font-medium">
            Active (visible in the shop)
            <Toggle label="Active" checked={values.is_active} onChange={(v) => set({ is_active: v })} />
          </label>
          <label className="flex items-center justify-between text-sm font-medium">
            Featured
            <Toggle label="Featured" checked={values.is_featured} onChange={(v) => set({ is_featured: v })} />
          </label>
        </Card>
        <FormError message={formError} />
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={saving}>
            {product ? "Save changes" : "Create product"}
          </Button>
        </div>
      </div>
    </form>
  );
}
