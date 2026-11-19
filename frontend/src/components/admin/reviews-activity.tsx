"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Stars } from "@/components/shop/stars";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import type { Paginated } from "@/lib/types";
import { Forbidden } from "./forbidden";
import { useCan } from "./staff-context";
import { Badge, Card, EmptyRow, LoadingRows, PageHeader, SimplePager, Table, Toggle } from "./ui";

type AdminReview = {
  id: number;
  rating: number;
  comment: string;
  is_approved: boolean;
  customer: { id: number; name: string; email: string } | null;
  product: { id: number; name: string; slug: string } | null;
  created_at: string;
};

export function ReviewsView() {
  const can = useCan();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "reviews", page],
    queryFn: () => api<Paginated<AdminReview>>(`admin/reviews?page=${page}`),
    placeholderData: keepPreviousData,
    enabled: can("reviews.manage"),
  });

  const refresh = () => client.invalidateQueries({ queryKey: ["admin", "reviews"] });
  const approve = useMutation({
    mutationFn: ({ id, is_approved }: { id: number; is_approved: boolean }) => api(`admin/reviews/${id}`, { method: "PATCH", body: { is_approved } }),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`admin/reviews/${id}`, { method: "DELETE" }),
    onSuccess: () => (toast.success("Review deleted"), refresh()),
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!can("reviews.manage")) return <Forbidden />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reviews" description="Hidden reviews disappear from the shop and stop counting towards the product rating." />
      <Card>
        <Table head={["Review", "Product", "Customer", "Date", "Visible", ""]}>
          {isLoading ? (
            <LoadingRows colSpan={6} />
          ) : data?.data.length === 0 ? (
            <EmptyRow colSpan={6}>No reviews yet.</EmptyRow>
          ) : (
            data?.data.map((r) => (
              <tr key={r.id} className="align-top hover:bg-surface/50">
                <td className="max-w-md px-4 py-3">
                  <Stars rating={r.rating} className="h-3.5" />
                  <p className="mt-1 line-clamp-2 text-ink/70">{r.comment}</p>
                </td>
                <td className="px-4 py-3">
                  {r.product && (
                    <Link href={`/product/${r.product.slug}`} target="_blank" className="hover:underline">
                      {r.product.name}
                    </Link>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.customer?.name}
                  <span className="block text-xs text-ink/50">{r.customer?.email}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink/60">{formatDate(r.created_at)}</td>
                <td className="px-4 py-3">
                  <Toggle label="Visible" checked={r.is_approved} onChange={(is_approved) => approve.mutate({ id: r.id, is_approved })} />
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => window.confirm("Delete this review?") && remove.mutate(r.id)}
                    className="rounded-lg p-2 text-sale hover:bg-sale/10"
                    aria-label="Delete review"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </Table>
        {data && <SimplePager page={data.meta.current_page} last={data.meta.last_page} onChange={setPage} />}
      </Card>
    </div>
  );
}

type Log = {
  id: number;
  action: string;
  staff: { id: number; name: string } | null;
  subject_type: string | null;
  subject_id: number | null;
  properties: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
};

export function ActivityView() {
  const can = useCan();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "activity", page],
    queryFn: () => api<Paginated<Log>>(`admin/activity-logs?page=${page}`),
    placeholderData: keepPreviousData,
    enabled: can("activity_logs.view"),
  });

  if (!can("activity_logs.view")) return <Forbidden />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Activity log" description="Every change made in the admin panel, plus system alerts such as emails that failed to send, newest first." />
      <Card>
        <Table head={["When", "Who", "Action", "Subject", "Details", "IP"]}>
          {isLoading ? (
            <LoadingRows colSpan={6} />
          ) : data?.data.length === 0 ? (
            <EmptyRow colSpan={6}>Nothing logged yet.</EmptyRow>
          ) : (
            data?.data.map((log) => (
              <tr key={log.id} className="align-top hover:bg-surface/50">
                <td className="whitespace-nowrap px-4 py-3 text-ink/60">{formatDate(log.created_at, true)}</td>
                <td className="px-4 py-3">{log.staff?.name ?? "System"}</td>
                <td className="px-4 py-3">
                  <Badge>{log.action}</Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink/60">{log.subject_type ? `${log.subject_type} #${log.subject_id}` : "—"}</td>
                <td className="max-w-xs px-4 py-3">
                  {log.properties && <code className="line-clamp-2 break-all text-xs text-ink/50">{JSON.stringify(log.properties)}</code>}
                </td>
                <td className="px-4 py-3 text-xs text-ink/50">{log.ip_address}</td>
              </tr>
            ))
          )}
        </Table>
        {data && <SimplePager page={data.meta.current_page} last={data.meta.last_page} onChange={setPage} />}
      </Card>
    </div>
  );
}
