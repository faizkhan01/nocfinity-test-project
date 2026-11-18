import { AnnouncementBar } from "@/components/shop/announcement-bar";
import { Footer } from "@/components/shop/footer";
import { Header } from "@/components/shop/header";
import { hasSession } from "@/lib/api/server";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const signedIn = await hasSession("customer");

  return (
    <div className="flex min-h-dvh flex-col">
      {!signedIn && <AnnouncementBar />}
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
