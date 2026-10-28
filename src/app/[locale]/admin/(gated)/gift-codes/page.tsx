import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { GiftCodesAdmin } from "@/components/admin/GiftCodesAdmin";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { listGiftCodes } from "@/lib/admin/gift-codes-data";
import { requireEditor } from "@/lib/auth/server";
import { KINGSHOT_SITE } from "@/lib/gift-codes/kingshot";

export const metadata: Metadata = { title: "Gift codes" };

export default async function AdminGiftCodesPage() {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <GiftCodes locale={locale} />
    </Suspense>
  );
}

async function GiftCodes({ locale }: { locale: string }) {
  const user = await requireEditor(locale);
  if (!user) return null;
  const data = await listGiftCodes();
  return (
    <div className="space-y-5">
      <SectionTitle icon="🎁" title="Gift codes" />
      <p className="text-sm font-semibold text-ink-muted">
        The codes on Home. New ones come by themselves from {KINGSHOT_SITE}, checked every hour, and leave Home when it stops listing them. Add a code
        here when players have one before {KINGSHOT_SITE} does, and write what a code gives if you know.
      </p>
      <GiftCodesAdmin data={data} locale={locale} />
    </div>
  );
}
