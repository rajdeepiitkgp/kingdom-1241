import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { ItemIcon } from "@/components/kvk/ItemIcon";
import { PrepBoardSkeleton } from "@/components/kvk/PrepBoard";
import { PrepGate } from "@/components/kvk/PrepGate";
import { KVK_EVENT_IMAGE } from "@/components/kvk/prep-labels";
import { PageGuide } from "@/components/tour/PageGuide";
import { PageHeader } from "@/components/ui/SectionTitle";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { KVK_TOURS } from "@/lib/kvk/tours";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await rootLocale());
  return { title: dict["prep.title"] };
}

/**
 * The KvK prep week: public (every player should know it), with the council's
 * buff days behind the battle plan's password. The header is part of the
 * static shell; the board streams in behind Suspense once the gate has read
 * the cookie (`PrepGate`). The schedule and the table live in
 * `src/lib/kvk/prep.ts`, and the client picks today and fills in the countdowns.
 */
export default async function PrepPage() {
  const locale = await rootLocale();
  const dict = await getDictionary(locale);

  return (
    <div>
      <PageHeader icon={<ItemIcon image={KVK_EVENT_IMAGE} emoji="📅" className="size-10" />} title={dict["prep.title"]} subtitle={dict["prep.subtitle"]} guide={<PageGuide tour={KVK_TOURS.prep} dict={dict} />} />
      <Suspense fallback={<PrepBoardSkeleton />}>
        <PrepGate dict={dict} locale={locale} />
      </Suspense>
    </div>
  );
}
