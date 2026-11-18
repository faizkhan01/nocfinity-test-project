import type { Metadata } from "next";
import { ReviewsView } from "@/components/admin/reviews-activity";

export const metadata: Metadata = { title: "Reviews" };

export default function Page() {
  return <ReviewsView />;
}
